import { env as cloudflareEnv } from "cloudflare:workers";

const SUPABASE_URL = "https://fidfdgnnoqamhftczcer.supabase.co";
const SUPABASE_PROJECT_REF = "fidfdgnnoqamhftczcer";

function serviceRoleKey() {
  const raw = (
    (cloudflareEnv as Record<string, string | undefined>).SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    ""
  ).trim();
  const embeddedSecret = raw.match(/sb_secret_[A-Za-z0-9_-]+/)?.[0];
  if (embeddedSecret) return embeddedSecret;
  const embeddedLegacyKey = raw.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0];
  if (embeddedLegacyKey) return embeddedLegacyKey;
  const hasWrappingQuotes =
    raw.length >= 2 &&
    ((raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'")));
  return (hasWrappingQuotes ? raw.slice(1, -1) : raw).trim();
}

type LegacyKeyClaims = {
  exp?: number;
  ref?: string;
  role?: string;
};

function decodeLegacyClaims(key: string): LegacyKeyClaims | null {
  if (!key.startsWith("eyJ")) return null;
  try {
    const payload = key.split(".")[1];
    if (!payload) return null;
    const padded = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(payload.length / 4) * 4, "=");
    return JSON.parse(atob(padded)) as LegacyKeyClaims;
  } catch {
    return null;
  }
}

export function assertSupabaseAdminCredential() {
  const key = serviceRoleKey();
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no Worker.");
  if (key.startsWith("cfut_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY recebeu um token da Cloudflare. Configure nessa variável uma Secret Key do Supabase (sb_secret_...) ou a chave service_role legada.",
    );
  }
  if (key.startsWith("sb_publishable_")) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY está usando uma chave publicável. A carga exige uma Secret Key do Supabase (sb_secret_...) ou a chave service_role legada.",
    );
  }
  if (key.startsWith("sb_secret_")) return;

  const claims = decodeLegacyClaims(key);
  if (!claims) {
    const safeShape = `${key.slice(0, 3).replace(/[^A-Za-z0-9]/g, "?")}… (${key.length} caracteres)`;
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY possui formato desconhecido: ${safeShape}. Use uma Secret Key do Supabase (sb_secret_...) ou a chave service_role legada.`,
    );
  }
  if (claims.role !== "service_role") {
    throw new Error(`A chave configurada no Worker possui papel ${claims.role || "indefinido"}; a carga exige service_role.`);
  }
  if (claims.ref && claims.ref !== SUPABASE_PROJECT_REF) {
    throw new Error("A chave administrativa configurada pertence a outro projeto Supabase.");
  }
  if (claims.exp && claims.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error("A chave service_role configurada no Worker está expirada.");
  }
}

export function supabaseAdminConfigured() {
  return Boolean(serviceRoleKey());
}

export async function supabaseRest<T = unknown>(
  pathname: string,
  { method = "GET", body, prefer }: { method?: string; body?: unknown; prefer?: string } = {},
): Promise<T> {
  assertSupabaseAdminCredential();
  const key = serviceRoleKey();

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${pathname}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Client-Info": "latam-email-dashboard-worker/1.0",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    const requestId =
      response.headers.get("x-request-id") ||
      response.headers.get("x-kong-request-id") ||
      response.headers.get("cf-ray");
    const gatewayDetail = [
      response.statusText ? `status=${response.statusText}` : "",
      requestId ? `request_id=${requestId}` : "",
      response.headers.get("content-type") ? `content_type=${response.headers.get("content-type")}` : "",
    ]
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `Supabase REST ${response.status} em ${pathname}: ${
        data === null ? "resposta vazia do gateway" : JSON.stringify(data)
      }${gatewayDetail ? ` (${gatewayDetail})` : ""}`,
    );
  }
  return data as T;
}

export async function verifySupabaseAdminConnection() {
  const result = await supabaseRest<unknown>("rpc/commit_email_marketing_campaign_metrics_v2", {
    method: "POST",
    body: {
      p_month_ref: "2000-01-01",
      p_replace: false,
      p_rows: [],
    },
  });
  const inserted = typeof result === "number" ? result : Number(result);
  if (inserted !== 0) {
    throw new Error("O teste seguro da conexão administrativa retornou um resultado inesperado.");
  }
}

export async function upsertBatches(table: string, rows: unknown[], onConflict: string, batchSize = 250) {
  for (let index = 0; index < rows.length; index += batchSize) {
    await supabaseRest(`${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=minimal",
      body: rows.slice(index, index + batchSize),
    });
  }
}

export async function insertBatches(table: string, rows: unknown[], batchSize = 50) {
  for (let index = 0; index < rows.length; index += batchSize) {
    const batch = rows.slice(index, index + batchSize);
    try {
      await supabaseRest(table, {
        method: "POST",
        prefer: "return=minimal",
        body: batch,
      });
    } catch (error) {
      const first = batch[0] as Record<string, unknown> | undefined;
      const last = batch[batch.length - 1] as Record<string, unknown> | undefined;
      const sourceRange =
        first && last && "source_row" in first && "source_row" in last
          ? ` Linhas fonte ${String(first.source_row)} a ${String(last.source_row)}.`
          : "";
      throw new Error(`${error instanceof Error ? error.message : "Falha ao inserir lote."}${sourceRange}`);
    }
  }
}
