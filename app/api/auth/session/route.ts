import { z } from "zod";

import { clientIp, sessionWallet } from "@/lib/auth";
import { verifySessionSignature } from "@/lib/auth/eip712";
import { clearSessionCookieHeader, issueSession, sessionCookieHeader } from "@/lib/auth/session";
import { SESSION_STATEMENT } from "@/lib/auth/typedData";
import { prisma } from "@/lib/db/prisma";
import { handleError, json } from "@/lib/http";
import { checkLimit, retryAfter } from "@/lib/ratelimit";

const LoginInput = z.object({
  wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  statement: z.literal(SESSION_STATEMENT),
  clientTs: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]),
  nonce: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
  signature: z.string().regex(/^0x[0-9a-fA-F]{130,}$/),
});

/** Log in with a passkey-wallet signature. Unlike Hunt, signing in here creates the RutaPlayer: joining is open. */
export async function POST(req: Request) {
  try {
    const limit = await checkLimit("auth", clientIp(req));
    if (!limit.ok) return json({ error: "slow down" }, 429, { "retry-after": retryAfter(limit.resetAt) });
    const input = LoginInput.parse(await req.json());
    const v = await verifySessionSignature({
      wallet: input.wallet,
      statement: input.statement,
      clientTs: BigInt(input.clientTs),
      nonce: input.nonce,
      signature: input.signature as `0x${string}`,
    });
    if (!v.ok) return json({ error: "invalid signature" }, 401);
    const player = await prisma.rutaPlayer.upsert({
      where: { walletAddress: v.address },
      create: { walletAddress: v.address },
      update: {},
    });
    let token: string;
    try {
      token = issueSession(v.address);
    } catch {
      console.error("[auth/session] AUTH_SESSION_SECRET is not configured");
      return json({ error: "internal error" }, 500);
    }
    return json(
      { authenticated: true, walletAddress: player.walletAddress },
      200,
      { "set-cookie": sessionCookieHeader(token) },
    );
  } catch (e) {
    return handleError(e, "auth/session");
  }
}

export function GET(req: Request) {
  try {
    return json({ authenticated: true, walletAddress: sessionWallet(req) });
  } catch {
    return json({ authenticated: false }, 401);
  }
}

export function DELETE() {
  return json({ authenticated: false }, 200, { "set-cookie": clearSessionCookieHeader() });
}
