import { requirePlayer } from "@/lib/auth";
import { cookieHeader, sealPayload } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { handleError, json } from "@/lib/http";
import { appUrl, linkXAccount } from "@/lib/la-ruta/server/xlink";
import { getXClient } from "@/lib/la-ruta/server/xclient";
import { checkLimit, retryAfter } from "@/lib/ratelimit";
import { authorizeUrl, codeChallengeS256, newCodeVerifier, newState } from "@/lib/x/pkce";

const OAUTH_COOKIE = "ruta_xoauth";
const OAUTH_TTL_SECONDS = 600;

/** Start X OAuth 2.0 (PKCE). In mock mode, links a deterministic mock account directly. */
export async function GET(req: Request) {
  try {
    const player = await requirePlayer(req);
    const limit = await checkLimit("xconnect", player.id);
    if (!limit.ok) return json({ error: "slow down" }, 429, { "retry-after": retryAfter(limit.resetAt) });
    const x = getXClient();
    if (!x) return Response.redirect(appUrl(req, "/?x=disabled"), 302);

    if (x.mode === "mock") {
      const user = await x.identifyFromCode(`mock:${player.walletAddress}`, "");
      const r = await linkXAccount(player.id, user, true);
      return Response.redirect(appUrl(req, `/?x=${r}`), 302);
    }

    const existing = await prisma.rutaXLink.findUnique({ where: { playerId: player.id } });
    if (existing) return Response.redirect(appUrl(req, "/?x=linked"), 302);

    const verifier = newCodeVerifier();
    const state = newState();
    const sealed = sealPayload("xoauth", { v: verifier, s: state, p: player.id, exp: Date.now() + OAUTH_TTL_SECONDS * 1000 });
    const location = authorizeUrl({
      clientId: process.env.X_CLIENT_ID!,
      redirectUri: process.env.X_REDIRECT_URI!,
      state,
      codeChallenge: codeChallengeS256(verifier),
    });
    return new Response(null, {
      status: 302,
      headers: {
        location,
        "set-cookie": cookieHeader(OAUTH_COOKIE, sealed, OAUTH_TTL_SECONDS, "/api/la-ruta/x"),
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return handleError(e, "la-ruta/x/connect");
  }
}
