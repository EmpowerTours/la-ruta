import { requireCron } from "@/lib/auth";
import { handleError, json } from "@/lib/http";
import { refreshFollowers } from "@/lib/la-ruta/server/followers";
import { runRechecks } from "@/lib/la-ruta/server/submissions";
import { getXClient } from "@/lib/la-ruta/server/xclient";

export const dynamic = "force-dynamic";

/** Scheduler (Railway cron), hourly: POST with Authorization: Bearer $CRON_SECRET. */
export async function POST(req: Request) {
  try {
    requireCron(req);
    const x = getXClient();
    if (!x) return json({ skipped: "x disabled" });
    const followers = await refreshFollowers(x).catch(() => ({ added: 0, skipped: true, error: true }));
    const rechecks = await runRechecks(x);
    return json({ followers, rechecks });
  } catch (e) {
    return handleError(e, "cron/la-ruta");
  }
}
