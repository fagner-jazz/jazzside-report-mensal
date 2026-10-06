export type MatrixPayload = {
  monthKey: string;
  fileName: string;
  sheetName: string;
  rows: unknown[][];
};

export type CampaignMetricRow = {
  load_id?: string | null;
  month_ref: string;
  source_file: string;
  source_sheet: string;
  source_row: number;
  campaign_name: string | null;
  campaign_link: string | null;
  source_category: string | null;
  dashboard_group: "TRADE" | "CORP" | "OUTROS";
  pos: string | null;
  classification_original: string | null;
  operational_segment: string;
  cta: string | null;
  has_cta: boolean;
  subject: string | null;
  original_send_value: string | null;
  send_at: string | null;
  date_normalization_rule: string;
  counter_normalization_rule: string;
  emails_sent: number;
  emails_delivered: number;
  unique_opens: number;
  total_clicks: number;
  unique_clicks: number;
  unsubscribes: number;
  bounces: number;
};

export type LoadValidation = {
  ok: boolean;
  monthKey: string;
  monthRef: string;
  fileName: string;
  sheetName: string;
  sourceRows: number;
  normalizedRows: number;
  duplicateMonth: boolean;
  errors: string[];
  warnings: string[];
  alerts: string[];
  quality: {
    source_records: number;
    zero_send_rows: number;
    scaled_counter_rows: number;
    dates_outside_month: number;
    missing_send_dates: number;
    delivered_gt_sent: number;
    opens_gt_delivered: number;
    unique_clicks_gt_delivered: number;
    total_clicks_lt_unique: number;
    unsubscribes_gt_delivered: number;
    bounces_gt_sent: number;
  };
  totals: Metrics;
  byGroup: Array<{ label: string; metrics: Metrics }>;
  bySegment: Array<{ label: string; group: string; metrics: Metrics }>;
  comparison: Array<{
    label: string;
    current: number;
    average: number;
    deltaPct: number | null;
    severity: "ok" | "warning" | "alert";
  }>;
};

type Metrics = {
  communications: number;
  sent: number;
  delivered: number;
  opens: number;
  clicks: number;
  totalClicks: number;
  unsubscribes: number;
  bounces: number;
  ctaSent: number;
  ctaClicks: number;
  delivery: number;
  openRate: number;
  ctr: number;
  qualifiedCtr: number;
  ctor: number;
  optout: number;
  bounce: number;
};

const TRADE_SEGMENTS = new Set(["CONS", "CONSOLIDADORES", "CORPRTV", "CORPORATIVAS", "OPERATORS", "OTAS"]);
const CORP_SEGMENTS = new Set(["GE", "LC"]);
const COMMUNICATION_TYPES = new Set(["INFORMATIVO", "NEWSLETTER", "MEGAPROMO", "MALHAAEREA"]);
const CAMPAIGN_CATEGORY_TOKENS = new Set(["TRADE", "CORP", "CLUBLATAM"]);

const COLUMN_ALIASES: Record<string, string[]> = {
  campaign_name: ["nombre campana", "nombre campanha", "nome campanha", "nome", "campaign name"],
  campaign_link: ["link campana", "link campanha", "link_campaign", "link"],
  source_category: ["categoria trade/corp", "categoria", "category", "categoría trade/corp"],
  pos: ["pos"],
  classification_original: ["clasificacion", "classificacion", "classificacao", "classificação", "classification"],
  cta: ["cta"],
  subject: ["subject", "assunto"],
  send_at: ["fecha envio", "fecha_envio", "data envio", "data_envio", "send date"],
  send_time: ["hora envio", "hora_envio", "send time", "time"],
  emails_sent: ["total_sent", "total sent", "emails enviados", "enviados"],
  emails_delivered: ["total_delivered", "total delivered", "emails recebidos", "entregues", "recebidos"],
  unique_opens: ["unique_opens", "unique opens", "aberturas unicas", "aberturas únicas"],
  total_clicks: ["click totales", "click_totales", "cliques totais", "total clicks"],
  unique_clicks: ["unique_clicks", "unique clicks", "cliques unicos", "cliques únicos"],
  unsubscribes: ["unsuscribe", "unsubscribe", "unsubscribes", "descadastros", "opt out", "opt-out"],
  bounces: ["bounce", "bounces"],
};

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ÃÁÀÂÄ]/g, "A")
    .replace(/[ÉÈÊË]/g, "E")
    .replace(/[ÍÌÎÏ]/g, "I")
    .replace(/[ÓÒÔÖÕ]/g, "O")
    .replace(/[ÚÙÛÜ]/g, "U")
    .replace(/[Ç]/g, "C");
}

function normalizeHeader(value: unknown) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asText(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value).trim();
}

function hasCta(value: unknown) {
  return new Set(["X", "TRUE", "SIM", "YES", "1"]).has(normalizeText(value));
}

function number(rawValue: unknown) {
  if (rawValue === null || rawValue === undefined || rawValue === "") return { value: 0, scaled: false };
  let result: number;
  if (typeof rawValue === "number") {
    result = rawValue;
  } else {
    const text = String(rawValue).trim().replace(/\./g, "").replace(",", ".");
    result = Number(text);
  }
  if (!Number.isFinite(result)) return { value: 0, scaled: false };
  if (!Number.isInteger(result) && Math.abs(result * 1000 - Math.round(result * 1000)) < 0.000001) {
    return { value: Math.round(result * 1000), scaled: true };
  }
  return { value: Math.round(result), scaled: false };
}

function safe(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0;
}

function monthStart(monthKey: string) {
  return `${monthKey}-01`;
}

function excelDate(serial: number) {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial * 86400000));
}

function parsedTime(
  hourText?: string,
  minuteText?: string,
  secondText?: string,
  meridiemText?: string,
) {
  let hour = Number(hourText || 0);
  const minute = Number(minuteText || 0);
  const second = Number(secondText || 0);
  const meridiem = String(meridiemText || "").toUpperCase();
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return { hour, minute, second };
}

function normalizeTimeValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const totalSeconds = Math.round((Math.abs(value) % 1) * 86400);
    return {
      hour: Math.floor(totalSeconds / 3600),
      minute: Math.floor((totalSeconds % 3600) / 60),
      second: totalSeconds % 60,
    };
  }
  if (value instanceof Date) {
    return { hour: value.getHours(), minute: value.getMinutes(), second: value.getSeconds() };
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
  if (!match) return null;
  return parsedTime(match[1], match[2], match[3], match[4]);
}

function withSeparateTime(date: Date, time: ReturnType<typeof normalizeTimeValue>) {
  if (!time) return date;
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    time.hour,
    time.minute,
    time.second,
  ));
}

function normalizeDate(value: unknown, monthKey: string, timeValue?: unknown) {
  const [, expectedMonthText] = monthKey.split("-");
  const expectedMonth = Number(expectedMonthText);
  const expectedYear = Number(monthKey.slice(0, 4));
  const candidates: Array<{ date: Date; rule: string }> = [];
  const separateTime = normalizeTimeValue(timeValue);

  if (typeof value === "number") {
    const date = withSeparateTime(excelDate(value), separateTime);
    candidates.push({ date, rule: "Excel serial date converted to datetime" });
    candidates.push({
      date: new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCDate() - 1,
        date.getUTCMonth() + 1,
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
      )),
      rule: separateTime
        ? "Excel date and separate time converted to datetime: day/month swapped (approved)"
        : "Excel date: day/month swapped (approved)",
    });
  }

  const text = String(value ?? "").trim();
  const numericDate = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?$/i,
  );
  if (numericDate) {
    const first = Number(numericDate[1]);
    const second = Number(numericDate[2]);
    const year = Number(numericDate[3]);
    const time = separateTime || parsedTime(numericDate[4], numericDate[5], numericDate[6], numericDate[7]);
    candidates.push({ date: new Date(Date.UTC(year, first - 1, second, time.hour, time.minute, time.second)), rule: "Text date MM/DD/YYYY converted to datetime" });
    candidates.push({ date: new Date(Date.UTC(year, second - 1, first, time.hour, time.minute, time.second)), rule: "Text date DD/MM/YYYY converted to datetime" });
  }
  const isoDate = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (isoDate) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]);
    const day = Number(isoDate[3]);
    const time = separateTime || parsedTime(isoDate[4], isoDate[5], isoDate[6]);
    candidates.push({ date: new Date(Date.UTC(year, month - 1, day, time.hour, time.minute, time.second)), rule: "ISO text date converted to datetime" });
    candidates.push({ date: new Date(Date.UTC(year, day - 1, month, time.hour, time.minute, time.second)), rule: "ISO text date: day/month swapped (approved)" });
  }
  const englishDate = text.match(/^([A-Za-z]{3,9})\s+(\d{1,2})\s+(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (englishDate) {
    const month = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]
      .indexOf(englishDate[1].slice(0, 3).toUpperCase());
    if (month >= 0) {
      const time = separateTime || parsedTime(englishDate[4], englishDate[5], englishDate[6], englishDate[7]);
      candidates.push({
        date: new Date(Date.UTC(Number(englishDate[3]), month, Number(englishDate[2]), time.hour, time.minute, time.second)),
        rule: "English text date MMM DD YYYY hh:mmAM/PM converted to datetime",
      });
    }
  }
  if (value instanceof Date) {
    candidates.push({ date: withSeparateTime(value, separateTime), rule: "Date object converted to datetime" });
    const date = withSeparateTime(value, separateTime);
    candidates.push({
      date: new Date(Date.UTC(
        date.getUTCFullYear(),
        date.getUTCDate() - 1,
        date.getUTCMonth() + 1,
        date.getUTCHours(),
        date.getUTCMinutes(),
        date.getUTCSeconds(),
      )),
      rule: separateTime
        ? "Date object and separate time converted to datetime: day/month swapped (approved)"
        : "Date object: day/month swapped (approved)",
    });
  }

  const selected =
    candidates.find((candidate) => candidate.date.getUTCFullYear() === expectedYear && candidate.date.getUTCMonth() + 1 === expectedMonth) ||
    candidates.find((candidate) => !Number.isNaN(candidate.date.valueOf()));

  if (!selected) return { iso: null, rule: "Unsupported date value", outsideMonth: true };
  let selectedDate = selected.date;
  let selectedRule = selected.rule;
  if (selectedDate.getUTCHours() > 0 && selectedDate.getUTCHours() < 9) {
    selectedDate = new Date(selectedDate.getTime() + 12 * 60 * 60 * 1000);
    selectedRule = `${selectedRule}; horário 01h-08h ajustado para PM por regra operacional LATAM`;
  }
  return {
    iso: selectedDate.toISOString(),
    rule: selectedRule,
    outsideMonth: selectedDate.getUTCMonth() + 1 !== expectedMonth,
  };
}

function findHeader(rows: unknown[][]) {
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 15); rowIndex += 1) {
    const headerValues = rows[rowIndex].map(normalizeHeader);
    const found = new Map<string, number>();
    Object.entries(COLUMN_ALIASES).forEach(([field, aliases]) => {
      const aliasSet = new Set(aliases.map(normalizeHeader));
      const index = headerValues.findIndex((header) => aliasSet.has(header));
      if (index >= 0) found.set(field, index);
    });
    if (found.has("campaign_name") && found.has("emails_sent") && found.has("emails_delivered")) {
      return { rowIndex, found };
    }
  }
  return null;
}

function cell(row: unknown[], columns: Map<string, number>, key: string) {
  const index = columns.get(key);
  return index === undefined ? null : row[index];
}

function extractOperationalSegment(row: { classification_original: string | null; campaign_name: string | null }) {
  const rawClassification = row.classification_original || "";
  const normalizedClassification = normalizeText(rawClassification);
  if (!COMMUNICATION_TYPES.has(normalizedClassification)) {
    return rawClassification || "SEM CLASSIFICACAO";
  }
  const tokens = String(row.campaign_name ?? "").split("_").map(normalizeText).filter(Boolean);
  const categoryIndex = tokens.findIndex((token) => CAMPAIGN_CATEGORY_TOKENS.has(token));
  const firstAfterCategory = categoryIndex >= 0 ? tokens[categoryIndex + 1] : null;
  const secondAfterCategory = categoryIndex >= 0 ? tokens[categoryIndex + 2] : null;
  if (firstAfterCategory === "PONTUAL" && secondAfterCategory && !COMMUNICATION_TYPES.has(secondAfterCategory)) {
    return secondAfterCategory;
  }
  return firstAfterCategory || rawClassification || "SEM CLASSIFICACAO";
}

function dashboardGroup(sourceCategory: string | null, segment: string): "TRADE" | "CORP" | "OUTROS" {
  const normalizedSegment = normalizeText(segment).replace(/[^A-Z0-9]+/g, "");
  if (normalizedSegment === "MALHASETEMBROCORP" && normalizeText(sourceCategory) === "CORP") return "CORP";
  if (TRADE_SEGMENTS.has(normalizedSegment)) return "TRADE";
  if (CORP_SEGMENTS.has(normalizedSegment)) return "CORP";
  return "OUTROS";
}

function metrics(rows: CampaignMetricRow[]): Metrics {
  const visibleRows = rows.filter((row) => normalizeText(row.operational_segment) !== "LATAMERS");
  const total = visibleRows.reduce(
    (acc, row) => {
      acc.communications += 1;
      acc.sent += row.emails_sent;
      acc.delivered += row.emails_delivered;
      acc.opens += row.unique_opens;
      acc.clicks += row.unique_clicks;
      acc.totalClicks += row.total_clicks;
      acc.unsubscribes += row.unsubscribes;
      acc.bounces += row.bounces;
      if (row.has_cta) {
        acc.ctaSent += row.emails_sent;
        acc.ctaClicks += row.unique_clicks;
      }
      return acc;
    },
    {
      communications: 0,
      sent: 0,
      delivered: 0,
      opens: 0,
      clicks: 0,
      totalClicks: 0,
      unsubscribes: 0,
      bounces: 0,
      ctaSent: 0,
      ctaClicks: 0,
      delivery: 0,
      openRate: 0,
      ctr: 0,
      qualifiedCtr: 0,
      ctor: 0,
      optout: 0,
      bounce: 0,
    },
  );
  total.delivery = safe(total.delivered, total.sent);
  total.openRate = safe(total.opens, total.delivered);
  total.ctr = safe(total.clicks, total.sent);
  total.qualifiedCtr = safe(total.ctaClicks, total.ctaSent);
  total.ctor = safe(total.clicks, total.opens);
  total.optout = safe(total.unsubscribes, total.sent);
  total.bounce = safe(total.bounces, total.sent);
  return total;
}

function grouped(rows: CampaignMetricRow[], key: "dashboard_group" | "operational_segment") {
  const map = new Map<string, CampaignMetricRow[]>();
  rows
    .filter((row) => normalizeText(row.operational_segment) !== "LATAMERS")
    .forEach((row) => {
      const label = row[key];
      map.set(label, [...(map.get(label) || []), row]);
    });
  return map;
}

export function normalizeMatrix(payload: MatrixPayload) {
  const errors: string[] = [];
  const warnings: string[] = [];
  const monthKey = String(payload.monthKey || "").trim();
  if (!/^\d{4}-\d{2}$/.test(monthKey)) errors.push("Informe o mês de referência no formato YYYY-MM.");

  const header = findHeader(payload.rows || []);
  if (!header) {
    return {
      rows: [] as CampaignMetricRow[],
      quality: null,
      errors: [...errors, "Não encontrei cabeçalhos mínimos: nome da campanha, enviados e recebidos."],
      warnings,
    };
  }

  const normalized: CampaignMetricRow[] = [];
  let scaled = 0;
  let datesOutside = 0;
  for (let rowIndex = header.rowIndex + 1; rowIndex < payload.rows.length; rowIndex += 1) {
    const row = payload.rows[rowIndex] || [];
    const campaignName = asText(cell(row, header.found, "campaign_name"));
    const sent = number(cell(row, header.found, "emails_sent"));
    const delivered = number(cell(row, header.found, "emails_delivered"));
    const opens = number(cell(row, header.found, "unique_opens"));
    const totalClicks = number(cell(row, header.found, "total_clicks"));
    const uniqueClicks = number(cell(row, header.found, "unique_clicks"));
    const unsubscribes = number(cell(row, header.found, "unsubscribes"));
    const bounces = number(cell(row, header.found, "bounces"));
    if (!campaignName && sent.value === 0 && delivered.value === 0) continue;
    if ([sent, delivered, opens, totalClicks, uniqueClicks, unsubscribes, bounces].some((item) => item.scaled)) scaled += 1;
    const rawSendAt = cell(row, header.found, "send_at");
    const rawSendTime = cell(row, header.found, "send_time");
    const date = normalizeDate(rawSendAt, monthKey, rawSendTime);
    if (date.outsideMonth) datesOutside += 1;
    const base = {
      classification_original: asText(cell(row, header.found, "classification_original")),
      campaign_name: campaignName,
    };
    const operationalSegment = extractOperationalSegment(base);
    const cta = asText(cell(row, header.found, "cta"));
    const sourceCategory = asText(cell(row, header.found, "source_category"));
    normalized.push({
      month_ref: monthStart(monthKey),
      source_file: payload.fileName || "arquivo_sem_nome.xlsx",
      source_sheet: payload.sheetName || "aba_sem_nome",
      source_row: rowIndex + 1,
      campaign_name: campaignName,
      campaign_link: asText(cell(row, header.found, "campaign_link")),
      source_category: sourceCategory,
      dashboard_group: dashboardGroup(sourceCategory, operationalSegment),
      pos: asText(cell(row, header.found, "pos")),
      classification_original: base.classification_original,
      operational_segment: operationalSegment,
      cta,
      has_cta: hasCta(cta),
      subject: asText(cell(row, header.found, "subject")),
      original_send_value: [asText(rawSendAt), asText(rawSendTime)].filter(Boolean).join(" ") || null,
      send_at: date.iso,
      date_normalization_rule: date.rule,
      counter_normalization_rule: [sent, delivered, opens, totalClicks, uniqueClicks, unsubscribes, bounces].some((item) => item.scaled)
        ? "Decimal counter scaled by 1,000 (thousands separator normalization)"
        : "No counter normalization",
      emails_sent: sent.value,
      emails_delivered: delivered.value,
      unique_opens: opens.value,
      total_clicks: totalClicks.value,
      unique_clicks: uniqueClicks.value,
      unsubscribes: unsubscribes.value,
      bounces: bounces.value,
    });
  }

  const quality = {
    source_records: normalized.length,
    zero_send_rows: normalized.filter((row) => row.emails_sent === 0).length,
    scaled_counter_rows: scaled,
    dates_outside_month: datesOutside,
    missing_send_dates: normalized.filter((row) => !row.send_at).length,
    delivered_gt_sent: normalized.filter((row) => row.emails_delivered > row.emails_sent).length,
    opens_gt_delivered: normalized.filter((row) => row.unique_opens > row.emails_delivered).length,
    unique_clicks_gt_delivered: normalized.filter((row) => row.unique_clicks > row.emails_delivered).length,
    total_clicks_lt_unique: normalized.filter((row) => row.total_clicks < row.unique_clicks).length,
    unsubscribes_gt_delivered: normalized.filter((row) => row.unsubscribes > row.emails_delivered).length,
    bounces_gt_sent: normalized.filter((row) => row.bounces > row.emails_sent).length,
  };

  if (normalized.length === 0) errors.push("A aba selecionada não possui linhas de disparo válidas.");
  if (quality.delivered_gt_sent) errors.push(`${quality.delivered_gt_sent} linha(s) com recebidos maiores que enviados.`);
  if (quality.opens_gt_delivered) errors.push(`${quality.opens_gt_delivered} linha(s) com aberturas maiores que recebidos.`);
  if (quality.unique_clicks_gt_delivered) errors.push(`${quality.unique_clicks_gt_delivered} linha(s) com cliques únicos maiores que recebidos.`);
  if (quality.total_clicks_lt_unique) errors.push(`${quality.total_clicks_lt_unique} linha(s) com cliques totais menores que cliques únicos.`);
  if (quality.bounces_gt_sent) errors.push(`${quality.bounces_gt_sent} linha(s) com bounces maiores que enviados.`);
  if (quality.missing_send_dates) errors.push(`${quality.missing_send_dates} linha(s) sem data e horário de envio reconhecidos. Revise o formato da coluna antes de publicar.`);
  if (quality.dates_outside_month) warnings.push(`${quality.dates_outside_month} linha(s) ficaram fora do mês selecionado após normalização de data.`);
  if (quality.scaled_counter_rows) warnings.push(`${quality.scaled_counter_rows} linha(s) tiveram contadores fracionários tratados como milhar, regra já documentada no histórico.`);

  return { rows: normalized, quality, errors, warnings };
}

export function buildValidation(
  payload: MatrixPayload,
  rows: CampaignMetricRow[],
  quality: NonNullable<ReturnType<typeof normalizeMatrix>["quality"]>,
  errors: string[],
  warnings: string[],
  history: Array<{ month_key: string; emails_sent: number; emails_delivered: number; unique_opens: number; unique_clicks: number; bounces: number; unsubscribes: number; open_rate: number; unique_ctr: number; qualified_ctr: number; ctor: number; bounce_rate: number; unsubscribe_rate: number }>,
  duplicateMonth: boolean,
): LoadValidation {
  const total = metrics(rows);
  const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  const metricsToCompare = [
    { label: "Emails enviados", current: total.sent, average: average(history.map((item) => Number(item.emails_sent))) },
    { label: "Emails recebidos", current: total.delivered, average: average(history.map((item) => Number(item.emails_delivered))) },
    { label: "Open Rate", current: total.openRate, average: average(history.map((item) => Number(item.open_rate))) },
    { label: "CTR", current: total.ctr, average: average(history.map((item) => Number(item.unique_ctr))) },
    { label: "CTR qualificado", current: total.qualifiedCtr, average: average(history.map((item) => Number(item.qualified_ctr))) },
    { label: "CTOR", current: total.ctor, average: average(history.map((item) => Number(item.ctor))) },
    { label: "Bounce", current: total.bounce, average: average(history.map((item) => Number(item.bounce_rate))) },
    { label: "Opt-out", current: total.optout, average: average(history.map((item) => Number(item.unsubscribe_rate))) },
  ].map((item) => {
    const deltaPct = item.average ? (item.current - item.average) / item.average : null;
    const severity = deltaPct === null || Math.abs(deltaPct) < 0.25 ? "ok" : Math.abs(deltaPct) < 0.5 ? "warning" : "alert";
    return { ...item, deltaPct, severity };
  });

  const alerts = metricsToCompare
    .filter((item) => item.severity !== "ok")
    .map((item) => `${item.label} está ${item.deltaPct && item.deltaPct > 0 ? "acima" : "abaixo"} da média histórica do painel.`);
  if (duplicateMonth) {
    warnings.push("Já existe carga para este mês. Para reprocessar, marque substituição explícita na aprovação.");
  }

  const byGroup = Array.from(grouped(rows, "dashboard_group").entries())
    .map(([label, items]) => ({ label, metrics: metrics(items) }))
    .sort((a, b) => b.metrics.sent - a.metrics.sent);
  const bySegment = Array.from(grouped(rows, "operational_segment").entries())
    .map(([label, items]) => ({ label, group: items[0]?.dashboard_group || "", metrics: metrics(items) }))
    .sort((a, b) => b.metrics.sent - a.metrics.sent);

  return {
    ok: errors.length === 0,
    monthKey: payload.monthKey,
    monthRef: monthStart(payload.monthKey),
    fileName: payload.fileName,
    sheetName: payload.sheetName,
    sourceRows: payload.rows.length,
    normalizedRows: rows.length,
    duplicateMonth,
    errors,
    warnings,
    alerts,
    quality,
    totals: total,
    byGroup,
    bySegment,
    comparison: metricsToCompare,
  };
}
