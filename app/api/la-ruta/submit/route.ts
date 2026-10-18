import { z } from "zod";

import { requirePlayer } from "@/lib/auth";
import { handleError, json } from "@/lib/http";
import { getXClient } from "@/lib/la-ruta/server/xclient";
import { SubmitError, submitPost } from "@/lib/la-ruta/server/submissions";
import { checkLimit, retryAfter } from "@/lib/ratelimit";
import { parsePostUrl } from "@/lib/x/parse";

const Input = z.object({ url: z.string().min(1).max(500) });

export async function POST(req: Request) {
  try {
    const player = await requirePlayer(req);
    const limit = await checkLimit("submit", player.id);
    if (!limit.ok) return json({ error: "slow down" }, 429, { "retry-after": retryAfter(limit.resetAt) });
    const { url } = Input.parse(await req.json());
    const parsed = parsePostUrl(url);
    if (!parsed) return json({ error: "Paste a link to your post on x.com." }, 400);
    const x = getXClient();
    if (!x) return json({ error: "Post verification is not switched on yet." }, 503);
    const s = await submitPost(x, player, parsed);
    return json({ id: s.id, status: s.status, reasons: s.reasons, flags: s.flags, recheckAt: s.recheckAt });
  } catch (e) {
    if (e instanceof SubmitError) return json({ error: e.message }, e.status);
    return handleError(e, "la-ruta/submit");
  }
}
