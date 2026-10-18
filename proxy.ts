import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Origin/Referer allowlist on mutating API requests (adapted from Hunt's
// proxy.ts). Route Handlers get no built-in CSRF check in Next 16.
//
// Exempt: server-to-server routes that carry a bearer and fail closed without it:
//   /api/cron/            CRON_SECRET
//   /api/la-ruta/review-agent   LA_RUTA_REVIEW_TOKEN (Reach)

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const EXEMPT_PREFIXES = ["/api/cron/", "/api/la-ruta/review-agent"];

function originOf(value: string): string | null {
  try {
    const u = new URL(value);
    return `${u.protocol}//${u.host}`.toLowerCase();
  } catch {
    return null;
  }
}

function isOwnDomain(candidate: string): boolean {
  const parent = process.env.NEXT_PUBLIC_RP_ID?.trim().toLowerCase();
  if (!parent || !parent.includes(".") || parent === "localhost") return false;
  try {
    const host = new URL(candidate).host.toLowerCase();
    return host === parent || host.endsWith(`.${parent}`);
  } catch {
    return false;
  }
}

function allowedOrigins(req: NextRequest): Set<string> {
  const allowed = new Set<string>();
  for (const entry of (process.env.ALLOWED_ORIGINS ?? "").split(",")) {
    const o = entry.trim() ? originOf(entry.trim()) : null;
    if (o) allowed.add(o);
  }
  const app = process.env.NEXT_PUBLIC_APP_URL ? originOf(process.env.NEXT_PUBLIC_APP_URL) : null;
  if (app) allowed.add(app);
  allowed.add(`${req.nextUrl.protocol}//${req.nextUrl.host}`.toLowerCase());
  return allowed;
}

export function proxy(req: NextRequest) {
  if (!MUTATING.has(req.method)) return NextResponse.next();
  const path = req.nextUrl.pathname;
  if (EXEMPT_PREFIXES.some((p) => path.startsWith(p))) return NextResponse.next();
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const candidate = origin ? originOf(origin) : referer ? originOf(referer) : null;
  if (candidate === null || !(allowedOrigins(req).has(candidate) || isOwnDomain(candidate))) {
    return NextResponse.json({ error: "cross-origin request refused" }, { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: "/api/:path*" };
