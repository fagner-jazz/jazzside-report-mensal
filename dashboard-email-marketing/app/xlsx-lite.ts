type ZipEntry = {
  name: string;
  compression: number;
  compressed: Uint8Array;
  uncompressedSize: number;
};

export type ParsedWorkbook = {
  sheets: Array<{
    name: string;
    rows: unknown[][];
  }>;
};

const decoder = new TextDecoder("utf-8");

function u16(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function u32(bytes: Uint8Array, offset: number) {
  return (
    bytes[offset] |
    (bytes[offset + 1] << 8) |
    (bytes[offset + 2] << 16) |
    (bytes[offset + 3] << 24)
  ) >>> 0;
}

function xmlText(value: string) {
  return new DOMParser().parseFromString(value, "application/xml");
}

async function inflateRaw(bytes: Uint8Array) {
  if (!("DecompressionStream" in globalThis)) {
    throw new Error("Este navegador não liberou o descompactador necessário para ler XLSX.");
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function readZip(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  const entries = new Map<string, ZipEntry>();
  for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
    if (u32(bytes, offset) !== 0x06054b50) continue;
    const totalEntries = u16(bytes, offset + 10);
    let cursor = u32(bytes, offset + 16);
    for (let index = 0; index < totalEntries; index += 1) {
      if (u32(bytes, cursor) !== 0x02014b50) break;
      const compression = u16(bytes, cursor + 10);
      const compressedSize = u32(bytes, cursor + 20);
      const uncompressedSize = u32(bytes, cursor + 24);
      const fileNameLength = u16(bytes, cursor + 28);
      const extraLength = u16(bytes, cursor + 30);
      const commentLength = u16(bytes, cursor + 32);
      const localOffset = u32(bytes, cursor + 42);
      const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + fileNameLength));

      const localNameLength = u16(bytes, localOffset + 26);
      const localExtraLength = u16(bytes, localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      entries.set(name, {
        name,
        compression,
        compressed: bytes.slice(dataStart, dataStart + compressedSize),
        uncompressedSize,
      });
      cursor += 46 + fileNameLength + extraLength + commentLength;
    }
    return entries;
  }
  throw new Error("Não foi possível ler a estrutura interna do arquivo XLSX.");
}

async function entryText(entries: Map<string, ZipEntry>, name: string) {
  const entry = entries.get(name);
  if (!entry) return "";
  if (entry.compression === 0) return decoder.decode(entry.compressed);
  if (entry.compression === 8) return decoder.decode(await inflateRaw(entry.compressed));
  throw new Error(`Compressão não suportada no XLSX: ${entry.compression}`);
}

function columnIndex(cellRef: string) {
  const letters = cellRef.replace(/[0-9]/g, "");
  let index = 0;
  for (const letter of letters) {
    index = index * 26 + letter.toUpperCase().charCodeAt(0) - 64;
  }
  return Math.max(0, index - 1);
}

function parseSharedStrings(xml: string) {
  if (!xml) return [];
  const doc = xmlText(xml);
  return Array.from(doc.getElementsByTagName("si")).map((node) =>
    Array.from(node.getElementsByTagName("t"))
      .map((item) => item.textContent || "")
      .join(""),
  );
}

function parseWorkbook(xml: string, relsXml: string) {
  const workbook = xmlText(xml);
  const rels = xmlText(relsXml);
  const relationPathById = new Map(
    Array.from(rels.getElementsByTagName("Relationship")).map((node) => [
      node.getAttribute("Id") || "",
      `xl/${node.getAttribute("Target") || ""}`.replace("xl//", "xl/"),
    ]),
  );
  return Array.from(workbook.getElementsByTagName("sheet")).map((sheet) => {
    const id = sheet.getAttribute("r:id") || sheet.getAttribute("id") || "";
    return {
      name: sheet.getAttribute("name") || "Aba sem nome",
      path: relationPathById.get(id) || "",
    };
  }).filter((sheet) => sheet.path);
}

function parseSheet(xml: string, sharedStrings: string[]) {
  const doc = xmlText(xml);
  const rows: unknown[][] = [];
  Array.from(doc.getElementsByTagName("row")).forEach((rowNode) => {
    const row: unknown[] = [];
    Array.from(rowNode.getElementsByTagName("c")).forEach((cell) => {
      const ref = cell.getAttribute("r") || "";
      const index = columnIndex(ref);
      const type = cell.getAttribute("t");
      const valueNode = cell.getElementsByTagName("v")[0];
      const inlineNode = cell.getElementsByTagName("t")[0];
      const raw = valueNode?.textContent ?? inlineNode?.textContent ?? "";
      if (type === "s") {
        row[index] = sharedStrings[Number(raw)] ?? "";
      } else if (type === "inlineStr" || type === "str") {
        row[index] = raw;
      } else if (raw !== "" && !Number.isNaN(Number(raw))) {
        row[index] = Number(raw);
      } else {
        row[index] = raw;
      }
    });
    rows.push(row);
  });
  return rows;
}

export async function parseXlsx(buffer: ArrayBuffer): Promise<ParsedWorkbook> {
  const entries = await readZip(buffer);
  const workbookXml = await entryText(entries, "xl/workbook.xml");
  const relsXml = await entryText(entries, "xl/_rels/workbook.xml.rels");
  const sharedStrings = parseSharedStrings(await entryText(entries, "xl/sharedStrings.xml"));
  const sheets = parseWorkbook(workbookXml, relsXml);
  return {
    sheets: await Promise.all(
      sheets.map(async (sheet) => ({
        name: sheet.name,
        rows: parseSheet(await entryText(entries, sheet.path), sharedStrings),
      })),
    ),
  };
}
