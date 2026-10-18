import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { handleError, json } from "@/lib/http";
import { campaignConfig, campaignWeek, xMode } from "@/lib/la-ruta/config";
import { formatMicros } from "@/lib/la-ruta/spend";
import { spendStatus } from "@/lib/la-ruta/server/spend";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const cfg = campaignConfig();
    const [players, linked, entries, byStatus, picks, spend] = await Promise.all([
      prisma.rutaPlayer.count(),
      prisma.rutaXLink.count(),
      prisma.rutaEntry.count(),
      prisma.rutaSubmission.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.rutaCollectorPick.groupBy({ by: ["status"], _count: { _all: true } }),
      spendStatus(),
    ]);
    return json({
      xMode: xMode(),
      week: campaignWeek(cfg, new Date()),
      startsAt: cfg.startsAt.toISOString(),
      endsAt: cfg.endsAt.toISOString(),
      players,
      linked,
      whitelisted: entries,
      submissions: Object.fromEntries(byStatus.map((r) => [r.status, r._count._all])),
      picks: Object.fromEntries(picks.map((r) => [r.status, r._count._all])),
      picksPerWeek: cfg.picksPerWeek,
      picksTotal: cfg.picksTotal,
      xSpend: { month: spend.month, spent: formatMicros(spend.spentMicros), cap: formatMicros(spend.capMicros), calls: spend.calls },
    });
  } catch (e) {
    return handleError(e, "admin/overview");
  }
}
