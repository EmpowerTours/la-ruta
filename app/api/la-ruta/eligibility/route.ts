import { requirePlayer } from "@/lib/auth";
import { handleError, json } from "@/lib/http";
import { checkAndGrant } from "@/lib/la-ruta/server/eligibility";
import { checkLimit, retryAfter } from "@/lib/ratelimit";

/** Check earlier EmpowerTours activity (Monad reads + Hunt API stub + admin imports). */
export async function POST(req: Request) {
  try {
    const player = await requirePlayer(req);
    const limit = await checkLimit("read", `elig:${player.id}`);
    if (!limit.ok) return json({ error: "slow down" }, 429, { "retry-after": retryAfter(limit.resetAt) });
    return json(await checkAndGrant(player));
  } catch (e) {
    return handleError(e, "la-ruta/eligibility");
  }
}
