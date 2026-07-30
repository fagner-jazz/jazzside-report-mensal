import {
  authIsConfigured,
  createSessionCookie,
  roleForPassword,
} from "../session-utils";

export async function POST(request: Request) {
  if (!authIsConfigured()) {
    return Response.json(
      { error: "Login ainda não configurado no ambiente de produção." },
      { status: 503 },
    );
  }

  const payload = (await request.json().catch(() => ({}))) as { password?: string };
  const password = payload.password || "";
  const role = roleForPassword(password);

  if (!role) {
    return Response.json({ error: "Senha inválida." }, { status: 401 });
  }

  return Response.json(
    { authenticated: true, role },
    { headers: { "Set-Cookie": await createSessionCookie(role) } },
  );
}
