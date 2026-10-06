import { readSessionRole } from "../../auth/session-utils";
import { buildValidation, normalizeMatrix, type MatrixPayload } from "../load-utils";
import { loadMonthlyHistory } from "../history";
import {
  insertBatches,
  supabaseAdminConfigured,
  supabaseRest,
  verifySupabaseAdminConnection,
} from "../supabase-admin";

type CommitPayload = MatrixPayload & {
  replaceMonth?: boolean;
};

function campaignInsertRow(row: ReturnType<typeof normalizeMatrix>["rows"][number]) {
  return {
    month_ref: row.month_ref,
    source_file: row.source_file,
    source_sheet: row.source_sheet,
    source_row: row.source_row,
    campaign_name: row.campaign_name,
    campaign_link: row.campaign_link,
    source_category: row.source_category,
    dashboard_group: row.dashboard_group,
    pos: row.pos,
    classification_original: row.classification_original,
    operational_segment: row.operational_segment,
    cta: row.cta,
    has_cta: row.has_cta,
    subject: row.subject,
    original_send_value: row.original_send_value,
    send_at: row.send_at,
    date_normalization_rule: row.date_normalization_rule,
    counter_normalization_rule: row.counter_normalization_rule,
    emails_sent: row.emails_sent,
    emails_delivered: row.emails_delivered,
    unique_opens: row.unique_opens,
    total_clicks: row.total_clicks,
    unique_clicks: row.unique_clicks,
    unsubscribes: row.unsubscribes,
    bounces: row.bounces,
  };
}

function rpcInsertedCount(value: unknown) {
  if (typeof value === "number") return value;
  if (Array.isArray(value)) {
    const first = value[0] as Record<string, unknown> | number | undefined;
    if (typeof first === "number") return first;
    if (first && typeof first === "object") {
      return Number(
        first.commit_email_marketing_campaign_metrics_v2 ??
          first.inserted_count ??
          Object.values(first)[0],
      );
    }
  }
  if (value && typeof value === "object") {
    const item = value as Record<string, unknown>;
    return Number(item.commit_email_marketing_campaign_metrics_v2 ?? item.inserted_count ?? Object.values(item)[0]);
  }
  return Number(value);
}

async function commitCampaignRowsAtomically(monthRef: string, rows: ReturnType<typeof campaignInsertRow>[]) {
  const insertedPayload = await supabaseRest<unknown>("rpc/commit_email_marketing_campaign_metrics_v2", {
    method: "POST",
    body: {
      p_month_ref: monthRef,
      p_replace: true,
      p_rows: rows,
    },
  });
  return rpcInsertedCount(insertedPayload);
}

export async function POST(request: Request) {
  try {
    const role = await readSessionRole(request);
    if (role !== "admin") {
      return Response.json({ error: "Apenas admin pode aprovar cargas." }, { status: 403 });
    }
    if (!supabaseAdminConfigured()) {
      return Response.json({ error: "Chave segura do Supabase ainda não configurada no Worker." }, { status: 503 });
    }

    await verifySupabaseAdminConnection();

    const payload = (await request.json().catch(() => null)) as CommitPayload | null;
    if (!payload) return Response.json({ error: "Payload inválido." }, { status: 400 });

    const normalized = normalizeMatrix(payload);
    if (!normalized.quality) {
      return Response.json({ error: "Carga inválida.", validation: { errors: normalized.errors } }, { status: 400 });
    }

    const history = await loadMonthlyHistory(6).catch(() => {
      normalized.warnings.push(
        "Comparação histórica indisponível no momento. A aprovação seguirá com validação estrutural da planilha.",
      );
      return [];
    });
    const duplicateMonth = history.some((item) => item.month_key === payload.monthKey);
    const validation = buildValidation(
      payload,
      normalized.rows,
      normalized.quality,
      normalized.errors,
      normalized.warnings,
      history.filter((item) => item.month_key !== payload.monthKey) as never,
      duplicateMonth,
    );

    if (!validation.ok) {
      return Response.json({ error: "Existem erros críticos na carga. Corrija a planilha antes de aprovar.", validation }, { status: 400 });
    }
    let loadId: string | null = null;
    const commitWarnings: string[] = [];
    try {
      const [load] = await supabaseRest<Array<{ id: string }>>("email_marketing_loads", {
        method: "POST",
        prefer: "return=representation",
        body: [{
          load_label: `carga_${payload.monthKey}_${new Date().toISOString()}`,
          source_json: `${payload.fileName} :: ${payload.sheetName}`,
          records_loaded: normalized.rows.length,
          notes: payload.replaceMonth
            ? "Carga mensal aprovada via dashboard com substituição do mês."
            : "Carga mensal aprovada via dashboard.",
        }],
      });
      loadId = load?.id || null;
    } catch {
      commitWarnings.push(
        "Registro de auditoria da carga não foi criado, mas a gravação dos dados oficiais seguirá normalmente.",
      );
    }

    const monthRef = encodeURIComponent(validation.monthRef);
    const campaignRows = normalized.rows.map(campaignInsertRow);
    const qualityRow = {
      load_id: loadId,
      month_ref: validation.monthRef,
      source_file: payload.fileName,
      source_sheet: payload.sheetName,
      ...normalized.quality,
    };

    const insertedCount = await commitCampaignRowsAtomically(validation.monthRef, campaignRows);
    if (insertedCount !== campaignRows.length) {
      throw new Error(
        `Carga interrompida: o banco inseriu ${insertedCount} de ${campaignRows.length} registros validados.`,
      );
    }
    try {
      if (payload.replaceMonth) {
        await supabaseRest(`email_marketing_quality_checks?month_ref=eq.${monthRef}`, { method: "DELETE" });
      }
      await insertBatches("email_marketing_quality_checks", [qualityRow]);
    } catch {
      commitWarnings.push(
        "Quality check da carga não foi gravado, mas os disparos oficiais foram publicados no painel.",
      );
    }

    return Response.json({
      ok: true,
      loadId,
      warnings: commitWarnings,
      validation: commitWarnings.length
        ? { ...validation, warnings: [...validation.warnings, ...commitWarnings] }
        : validation,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha inesperada ao aprovar a carga." },
      { status: 500 },
    );
  }
}
