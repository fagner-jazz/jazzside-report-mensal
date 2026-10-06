import {
  authIsConfigured,
  createSessionCookie,
  roleForCredentials,
} from "../session-utils";

export async function POST(request: Request) {
  if (!authIsConfigured()) {
    return Response.json(
      { error: "Login ainda não configurado no ambiente de produção." },
      { status: 503 },
    );
  }

  const payload = (await request.json().catch(() => ({}))) as { username?: string; password?: string };
  const username = payload.username || "";
  const password = payload.password || "";
  const role = roleForCredentials(username, password);

  if (!role) {
    return Response.json({ error: "Usuário ou senha inválidos." }, { status: 401 });
  }

  return Response.json(
    { authenticated: true, role },
    { headers: { "Set-Cookie": await createSessionCookie(role) } },
  );
}
