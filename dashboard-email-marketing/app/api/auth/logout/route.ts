import { clearSessionCookie } from "../session-utils";

export async function POST() {
  return Response.json(
    { authenticated: false },
    { headers: { "Set-Cookie": clearSessionCookie() } },
  );
}
