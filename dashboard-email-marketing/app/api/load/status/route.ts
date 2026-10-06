import { readSessionRole } from "../../auth/session-utils";
import { supabaseAdminConfigured, supabaseRest } from "../supabase-admin";

export async function GET(request: Request) {
  const role = await readSessionRole(request);
  if (!role) {
    return Response.json({ updatedAt: null }, { status: 401 });
  }

  if (!supabaseAdminConfigured()) {
    return Response.json({ updatedAt: null, configured: false });
  }

  try {
    const rows = await supabaseRest<Array<{ loaded_at: string | null }>>(
      "email_marketing_loads?select=loaded_at&order=loaded_at.desc&limit=1",
    );
    return Response.json({
      updatedAt: rows[0]?.loaded_at || null,
      configured: true,
    });
  } catch (error) {
    return Response.json(
      {
        updatedAt: null,
        configured: true,
        error: error instanceof Error ? error.message : "Falha ao consultar última carga.",
      },
      { status: 200 },
    );
  }
}
