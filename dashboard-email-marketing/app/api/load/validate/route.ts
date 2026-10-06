import { readSessionRole } from "../../auth/session-utils";
import { buildValidation, normalizeMatrix, type MatrixPayload } from "../load-utils";
import { loadMonthlyHistory } from "../history";
import { supabaseAdminConfigured } from "../supabase-admin";

export async function POST(request: Request) {
  try {
    const role = await readSessionRole(request);
    if (role !== "admin") {
      return Response.json({ error: "Apenas admin pode validar cargas." }, { status: 403 });
    }
    if (!supabaseAdminConfigured()) {
      return Response.json({ error: "Chave segura do Supabase ainda não configurada no Worker." }, { status: 503 });
    }

    const payload = (await request.json().catch(() => null)) as MatrixPayload | null;
    if (!payload) return Response.json({ error: "Payload inválido." }, { status: 400 });

    const normalized = normalizeMatrix(payload);
    if (!normalized.quality) {
      return Response.json({
        validation: {
          ok: false,
          monthKey: payload.monthKey,
          fileName: payload.fileName,
          sheetName: payload.sheetName,
          errors: normalized.errors,
          warnings: normalized.warnings,
        },
      });
    }

    const history = await loadMonthlyHistory(6).catch(() => {
      normalized.warnings.push(
        "Comparação histórica indisponível no momento. A validação da planilha seguirá sem benchmark histórico.",
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
    return Response.json({ validation });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falha inesperada ao validar a carga." },
      { status: 500 },
    );
  }
}
