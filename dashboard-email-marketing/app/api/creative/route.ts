import { readSessionRole } from "../auth/session-utils";
import { supabaseAdminConfigured, supabaseRest } from "../load/supabase-admin";

type CreativePayload = {
  dispatchId?: string;
  monthKey?: string;
  campaignName?: string;
  subject?: string | null;
  campaignLink?: string | null;
  html?: string;
};

type CreativeRecord = {
  dispatch_id: string;
  month_key: string;
  campaign_name: string;
  subject: string | null;
  campaign_link: string | null;
  html_source: string;
  updated_at: string | null;
};

function friendlyCreativeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Falha ao acessar a tabela de peças.";
  if (
    message.includes("email_marketing_creatives") &&
    (message.includes("404") || message.includes("PGRST") || message.includes("does not exist"))
  ) {
    return "A tabela email_marketing_creatives ainda não existe no Supabase. A prévia e análise funcionam, mas o salvamento precisa da criação da tabela.";
  }
  return message;
}

export async function GET(request: Request) {
  const role = await readSessionRole(request);
  if (!role) {
    return Response.json({ error: "Sessão inválida." }, { status: 401 });
  }
  if (!supabaseAdminConfigured()) {
    return Response.json({ record: null, configured: false });
  }

  const url = new URL(request.url);
  const dispatchId = url.searchParams.get("dispatchId")?.trim();
  if (!dispatchId) {
    return Response.json({ record: null });
  }

  try {
    const rows = await supabaseRest<CreativeRecord[]>(
      `email_marketing_creatives?select=dispatch_id,month_key,campaign_name,subject,campaign_link,html_source,updated_at&dispatch_id=eq.${encodeURIComponent(dispatchId)}&limit=1`,
    );
    return Response.json({ record: rows[0] || null, configured: true });
  } catch (error) {
    return Response.json({ record: null, configured: true, error: friendlyCreativeError(error) }, { status: 200 });
  }
}

export async function POST(request: Request) {
  const role = await readSessionRole(request);
  if (role !== "admin" && role !== "team") {
    return Response.json({ error: "Apenas admin ou equipe podem salvar peças." }, { status: 403 });
  }
  if (!supabaseAdminConfigured()) {
    return Response.json({ error: "Chave segura do Supabase ainda não configurada no Worker." }, { status: 503 });
  }

  const payload = (await request.json().catch(() => null)) as CreativePayload | null;
  if (!payload) return Response.json({ error: "Payload inválido." }, { status: 400 });

  const dispatchId = payload.dispatchId?.trim();
  const monthKey = payload.monthKey?.trim();
  const campaignName = payload.campaignName?.trim();
  const html = payload.html?.trim();
  if (!dispatchId || !monthKey || !campaignName || !html) {
    return Response.json({ error: "Disparo, mês, campanha e HTML são obrigatórios." }, { status: 400 });
  }
  if (html.length > 1_500_000) {
    return Response.json({ error: "HTML muito grande para salvar neste MVP. Limite atual: 1,5 MB." }, { status: 413 });
  }

  const row = {
    dispatch_id: dispatchId,
    month_key: monthKey,
    campaign_name: campaignName,
    subject: payload.subject || null,
    campaign_link: payload.campaignLink || null,
    html_source: html,
    updated_at: new Date().toISOString(),
  };

  try {
    const rows = await supabaseRest<CreativeRecord[]>(
      "email_marketing_creatives?on_conflict=dispatch_id",
      {
        method: "POST",
        prefer: "resolution=merge-duplicates,return=representation",
        body: row,
      },
    );
    return Response.json({ ok: true, record: rows[0] || row });
  } catch (error) {
    return Response.json({ ok: false, error: friendlyCreativeError(error) }, { status: 400 });
  }
}
