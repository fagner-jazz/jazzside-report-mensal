import { env as cloudflareEnv } from "cloudflare:workers";

export type SessionRole = "client" | "team" | "admin";

export const SESSION_COOKIE = "latam_dashboard_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function envValue(key: string) {
  const runtimeEnv = cloudflareEnv as Record<string, string | undefined>;
  const workerEnv = (
    globalThis as typeof globalThis & {
      __LATAM_DASHBOARD_ENV?: Record<string, string | undefined>;
    }
  ).__LATAM_DASHBOARD_ENV;
  return runtimeEnv[key] || workerEnv?.[key] || process.env[key] || "";
}

function getSecret() {
  return envValue("DASHBOARD_AUTH_SECRET");
}

export function authIsConfigured() {
  return Boolean(
    getSecret() &&
      (envValue("DASHBOARD_CLIENT_PASSWORD") || envValue("DASHBOARD_VIEWER_PASSWORD")) &&
      envValue("DASHBOARD_ADMIN_PASSWORD"),
  );
}

function configuredUsername(key: string, fallback: string) {
  return (envValue(key) || fallback).trim().toLocaleLowerCase("pt-BR");
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

export function roleForCredentials(username: string, password: string): SessionRole | null {
  const normalizedUsername = username.trim().toLocaleLowerCase("pt-BR");
  const adminPassword = envValue("DASHBOARD_ADMIN_PASSWORD");
  const teamPassword = envValue("DASHBOARD_TEAM_PASSWORD");
  const clientPassword = envValue("DASHBOARD_CLIENT_PASSWORD") || envValue("DASHBOARD_VIEWER_PASSWORD");

  if (
    normalizedUsername === configuredUsername("DASHBOARD_ADMIN_USERNAME", "admin") &&
    adminPassword &&
    timingSafeEqual(password, adminPassword)
  ) {
    return "admin";
  }
  if (
    normalizedUsername === configuredUsername("DASHBOARD_TEAM_USERNAME", "equipe") &&
    teamPassword &&
    timingSafeEqual(password, teamPassword)
  ) {
    return "team";
  }
  if (
    normalizedUsername === configuredUsername("DASHBOARD_CLIENT_USERNAME", "latam") &&
    clientPassword &&
    timingSafeEqual(password, clientPassword)
  ) {
    return "client";
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
    if (session.role === "viewer") return "client";
    return session.role === "admin" || session.role === "team" || session.role === "client"
      ? session.role
      : null;
  } catch {
    return null;
  }
}
