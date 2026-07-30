export type SessionRole = "viewer" | "admin";

export const SESSION_COOKIE = "latam_dashboard_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function envValue(key: string) {
  const workerEnv = (
    globalThis as typeof globalThis & {
      __LATAM_DASHBOARD_ENV?: Record<string, string | undefined>;
    }
  ).__LATAM_DASHBOARD_ENV;
  return workerEnv?.[key] || process.env[key] || "";
}

function getSecret() {
  return envValue("DASHBOARD_AUTH_SECRET");
}

export function authIsConfigured() {
  return Boolean(
    getSecret() &&
      envValue("DASHBOARD_VIEWER_PASSWORD") &&
      envValue("DASHBOARD_ADMIN_PASSWORD"),
  );
}

function base64UrlEncode(bytes: Uint8Array) {
  let text = "";
  bytes.forEach((byte) => {
    text += String.fromCharCode(byte);
  });
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(
    Math.ceil(value.length / 4) * 4,
    "=",
  );
  const text = atob(padded);
  return Uint8Array.from(text, (char) => char.charCodeAt(0));
}

async function sign(data: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64UrlEncode(new Uint8Array(signature));
}

function timingSafeEqual(a: string, b: string) {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (left[index] || 0) ^ (right[index] || 0);
  }
  return diff === 0;
}

export function roleForPassword(password: string): SessionRole | null {
  if (timingSafeEqual(password, envValue("DASHBOARD_ADMIN_PASSWORD"))) {
    return "admin";
  }
  if (timingSafeEqual(password, envValue("DASHBOARD_VIEWER_PASSWORD"))) {
    return "viewer";
  }
  return null;
}

export async function createSessionCookie(role: SessionRole) {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ role, expiresAt })));
  const signature = await sign(payload);
  const value = `${payload}.${signature}`;
  return `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

function cookieValue(cookieHeader: string | null, name: string) {
  return (
    cookieHeader
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`))
      ?.slice(name.length + 1) || ""
  );
}

export async function readSessionRole(request: Request): Promise<SessionRole | null> {
  const value = cookieValue(request.headers.get("cookie"), SESSION_COOKIE);
  const [payload, signature] = value.split(".");
  if (!payload || !signature || signature !== (await sign(payload))) return null;

  try {
    const decoded = new TextDecoder().decode(base64UrlDecode(payload));
    const session = JSON.parse(decoded) as { role?: string; expiresAt?: number };
    if (session.expiresAt && session.expiresAt < Math.floor(Date.now() / 1000)) return null;
    return session.role === "admin" || session.role === "viewer" ? session.role : null;
  } catch {
    return null;
  }
}
