import { requirePlayer } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { handleError, json } from "@/lib/http";
import { campaignConfig, campaignWeek, xMode } from "@/lib/la-ruta/config";
import { isFounding } from "@/lib/la-ruta/export";
import { pointsTotal } from "@/lib/la-ruta/server/entries";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const player = await requirePlayer(req);
    const cfg = campaignConfig();
    const [link, entry, submissions, points, pick] = await Promise.all([
      prisma.rutaXLink.findUnique({ where: { playerId: player.id } }),
      prisma.rutaEntry.findUnique({ where: { playerId: player.id } }),
      prisma.rutaSubmission.findMany({
        where: { playerId: player.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: { id: true, postUrl: true, status: true, reasons: true, flags: true, createdAt: true, recheckAt: true, week: true },
      }),
      pointsTotal(player.id),
      prisma.rutaCollectorPick.findFirst({ where: { playerId: player.id, status: { not: "CANCELLED" } }, select: { week: true, status: true } }),
    ]);
    return json({
      walletAddress: player.walletAddress,
      suspended: player.suspendedAt !== null,
      x: link ? { username: link.username, mock: link.mock } : null,
      xMode: xMode(),
      whitelisted: Boolean(entry),
      sources: entry?.sources ?? [],
      reasons: entry?.reasons ?? [],
      founding: entry ? isFounding(entry.sources) : false,
      points,
      collectorPick: pick,
      submissions,
      campaign: {
        startsAt: cfg.startsAt.toISOString(),
        endsAt: cfg.endsAt.toISOString(),
        week: campaignWeek(cfg, new Date()),
      },
    });
  } catch (e) {
    return handleError(e, "la-ruta/me");
  }
}
