import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { handleError, json } from "@/lib/http";
import { isFounding, toCsv, toJson, type ExportRow } from "@/lib/la-ruta/export";

export const dynamic = "force-dynamic";

/** GET ?format=csv|json — every whitelisted Monad wallet. */
export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const format = new URL(req.url).searchParams.get("format") === "json" ? "json" : "csv";
    const entries = await prisma.rutaEntry.findMany({
      orderBy: { createdAt: "asc" },
      include: { player: { select: { suspendedAt: true, xLink: { select: { username: true } } } } },
    });
    const ids = entries.map((e) => e.playerId);
    const [pts, posts] = await Promise.all([
      prisma.rutaPointsLedger.groupBy({ by: ["playerId"], where: { playerId: { in: ids } }, _sum: { delta: true } }),
      prisma.rutaSubmission.groupBy({ by: ["playerId"], where: { playerId: { in: ids }, status: "VERIFIED" }, _count: { _all: true } }),
    ]);
    const ptsBy = new Map(pts.map((p) => [p.playerId, p._sum.delta ?? 0]));
    const postsBy = new Map(posts.map((p) => [p.playerId, p._count._all]));
    const rows: ExportRow[] = entries
      .filter((e) => e.player.suspendedAt === null)
      .map((e) => ({
        walletAddress: e.walletAddress,
        sources: e.sources,
        reasons: e.reasons,
        xUsername: e.player.xLink?.username ?? null,
        points: ptsBy.get(e.playerId) ?? 0,
        verifiedPosts: postsBy.get(e.playerId) ?? 0,
        founding: isFounding(e.sources),
        joinedAt: e.createdAt,
      }));
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "json") {
      return new Response(toJson(rows, new Date()), {
        headers: { "content-type": "application/json", "content-disposition": `attachment; filename="la-ruta-whitelist-${stamp}.json"`, "cache-control": "no-store" },
      });
    }
    return new Response(toCsv(rows), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="la-ruta-whitelist-${stamp}.csv"`, "cache-control": "no-store" },
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AuthError") return handleError(e, "admin/export");
    return json({ error: "export failed" }, 500);
  }
}
