import { timingSafeEqual } from "node:crypto";

import { requirePlayer } from "@/lib/auth";
import { cookieHeader, openPayload, readCookie } from "@/lib/auth/session";
import { handleError } from "@/lib/http";
import { appUrl, linkXAccount } from "@/lib/la-ruta/server/xlink";
import { getXClient } from "@/lib/la-ruta/server/xclient";

const OAUTH_COOKIE = "ruta_xoauth";

function same(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** X redirects here: https://ruta.empowertours.xyz/api/la-ruta/x/callback */
export async function GET(req: Request) {
  const clear = cookieHeader(OAUTH_COOKIE, "", 0, "/api/la-ruta/x");
  const done = (q: string) =>
    new Response(null, { status: 302, headers: { location: appUrl(req, `/?x=${q}`), "set-cookie": clear, "cache-control": "no-store" } });
  try {
    const player = await requirePlayer(req);
    const url = new URL(req.url);
    if (url.searchParams.get("error")) return done("cancelled");
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const sealed = openPayload<{ v: string; s: string; p: string; exp: number }>("xoauth", readCookie(req, OAUTH_COOKIE));
    if (!code || !state || !sealed) return done("expired");
    if (!(sealed.exp > Date.now()) || sealed.p !== player.id || !same(sealed.s, state)) return done("expired");
    const x = getXClient();
    if (!x || x.mode !== "live") return done("disabled");
    const user = await x.identifyFromCode(code, sealed.v);
    return done(await linkXAccount(player.id, user, false));
  } catch (e) {
    const r = handleError(e, "la-ruta/x/callback");
    return r.status === 401 ? done("signin") : done("error");
  }
}
