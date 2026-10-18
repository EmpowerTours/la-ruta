// Session token + cookies. Adapted from Hunt's lib/auth/mera.ts: an opaque
// HMAC-SHA256 token (not a JWT), version prefix inside the MAC, HttpOnly,
// SameSite=Lax, 7 days. La Ruta uses its own cookie name and its own secret,
// so a Hunt session is NOT a La Ruta session; the user signs in once per app
// with the same passkey and gets the same wallet.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isAddress } from "viem";

export const SESSION_COOKIE = "ruta_session";
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const TOKEN_VERSION = "v1";
const MIN_SECRET_LENGTH = 32;

function secret(): Buffer | null {
  const s = process.env.AUTH_SESSION_SECRET;
  if (!s || s.length < MIN_SECRET_LENGTH) return null;
  return Buffer.from(s, "utf8");
}

function mac(body: string, key: Buffer): string {
  return createHmac("sha256", key).update(body).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Sign an arbitrary JSON payload with a purpose tag (session, oauth state...). */
export function sealPayload(purpose: string, payload: object): string {
  const key = secret();
  if (!key) throw new Error("AUTH_SESSION_SECRET is not configured");
  const body = `${TOKEN_VERSION}.${purpose}.${Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")}`;
  return `${body}.${mac(body, key)}`;
}

export function openPayload<T>(purpose: string, token: string | null): T | null {
  const key = secret();
  if (!key || typeof token !== "string" || token.length === 0 || token.length > 4096) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const prefix = `${TOKEN_VERSION}.${purpose}.`;
  if (!body.startsWith(prefix)) return null;
  if (!safeEqual(token.slice(dot + 1), mac(body, key))) return null;
  try {
    return JSON.parse(Buffer.from(body.slice(prefix.length), "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

interface SessionPayload {
  w: string;
  iat: number;
  exp: number;
}

export function issueSession(wallet: string, nowMs = Date.now()): string {
  if (!isAddress(wallet, { strict: false })) throw new Error("issueSession requires a wallet address");
  const iat = Math.floor(nowMs / 1000);
  return sealPayload("s", { w: wallet.toLowerCase(), iat, exp: iat + SESSION_TTL_SECONDS } satisfies SessionPayload);
}

export function readSession(token: string | null, nowMs = Date.now()): { ok: true; wallet: string } | { ok: false } {
  const p = openPayload<SessionPayload>("s", token);
  if (!p || typeof p.w !== "string" || !isAddress(p.w, { strict: false })) return { ok: false };
  if (!(typeof p.exp === "number" && Number.isFinite(p.exp) && p.exp * 1000 > nowMs)) return { ok: false };
  return { ok: true, wallet: p.w.toLowerCase() };
}

export function newNonce(): string {
  return randomBytes(24).toString("base64url");
}

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0 || part.slice(0, eq).trim() !== name) continue;
    const raw = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

function secure(): string {
  return process.env.NODE_ENV === "production" ? "; Secure" : "";
}

/** Host-only cookie (no Domain attribute): never sent to Hunt or other subdomains. */
export function cookieHeader(name: string, value: string, maxAgeSeconds: number, path = "/"): string {
  return `${name}=${value}; Path=${path}; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure()}`;
}

export function sessionCookieHeader(token: string): string {
  return cookieHeader(SESSION_COOKIE, token, SESSION_TTL_SECONDS);
}

export function clearSessionCookieHeader(): string {
  return cookieHeader(SESSION_COOKIE, "", 0);
}
