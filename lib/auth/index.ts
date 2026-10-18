// The auth boundary. Routes import from here. Every failure is an AuthError (401).
import { timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/db/prisma";
import { readCookie, readSession, SESSION_COOKIE } from "./session";

export class AuthError extends Error {
  constructor(message: string, readonly status = 401) {
    super(message);
    this.name = "AuthError";
  }
}

export interface SessionPlayer {
  id: string;
  walletAddress: string;
  suspendedAt: Date | null;
}

export function sessionWallet(req: Request): string {
  const s = readSession(readCookie(req, SESSION_COOKIE));
  if (!s.ok) throw new AuthError("unauthenticated");
  return s.wallet;
}

/** The signed-in player. Sign-in creates the RutaPlayer row; this never does. */
export async function requirePlayer(req: Request): Promise<SessionPlayer> {
  const walletAddress = sessionWallet(req);
  let player: SessionPlayer | null;
  try {
    player = await prisma.rutaPlayer.findUnique({
      where: { walletAddress },
      select: { id: true, walletAddress: true, suspendedAt: true },
    });
  } catch {
    throw new AuthError("invalid session");
  }
  if (!player) throw new AuthError("unauthenticated");
  return player;
}

/**
 * Admins: wallets listed in LA_RUTA_ADMIN_WALLETS (comma separated), signed in
 * with the passkey session. Hunt's admin uses a separate SIWE flow because it
 * moves money; La Ruta's admin moves none (picks are recorded, transfers are
 * done by hand outside this app), so the session is enough here.
 */
export function adminWallets(env: NodeJS.ProcessEnv = process.env): Set<string> {
  return new Set(
    (env.LA_RUTA_ADMIN_WALLETS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^0x[0-9a-f]{40}$/.test(s)),
  );
}

export function requireAdmin(req: Request): string {
  const wallet = sessionWallet(req);
  if (!adminWallets().has(wallet)) throw new AuthError("forbidden", 403);
  return wallet;
}

/** Constant-time bearer check. A missing or short configured token rejects everything. */
export function bearerMatches(req: Request, configured: string | undefined): boolean {
  if (!configured || configured.length < 32) return false;
  const h = req.headers.get("authorization") ?? "";
  if (!h.startsWith("Bearer ")) return false;
  const given = Buffer.from(h.slice(7), "utf8");
  const want = Buffer.from(configured, "utf8");
  return given.length === want.length && timingSafeEqual(given, want);
}

/** Reach, the review agent: may only act on FLAGGED submissions. */
export function requireReviewAgent(req: Request): "reach" {
  if (!bearerMatches(req, process.env.LA_RUTA_REVIEW_TOKEN)) throw new AuthError("unauthorized");
  return "reach";
}

export function requireCron(req: Request): void {
  if (!bearerMatches(req, process.env.CRON_SECRET)) throw new AuthError("unauthorized");
}

/** Rate-limit key only. Never an authorisation input. */
export function clientIp(req: Request): string {
  const f = req.headers.get("x-forwarded-for");
  const first = f?.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip")?.trim() || "unknown";
}
