import { authIsConfigured, readSessionRole } from "../session-utils";

export async function GET(request: Request) {
  if (!authIsConfigured()) {
    return Response.json({ authenticated: false, configured: false });
  }

  const role = await readSessionRole(request);
  return Response.json({
    authenticated: Boolean(role),
    configured: true,
    role,
  });
}
