import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { handleError, json } from "@/lib/http";
import { campaignConfig, campaignWeek } from "@/lib/la-ruta/config";
import { isTxHash } from "@/lib/la-ruta/review";
import { cancelPick, markPickSent, PickError, selectPick } from "@/lib/la-ruta/server/picks";

export const dynamic = "force-dynamic";

/** Candidates (verified posts) for a week, plus every pick so far. */
export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const cfg = campaignConfig();
    const q = Number(new URL(req.url).searchParams.get("week"));
    const week = Number.isInteger(q) && q >= 1 ? q : Math.max(1, campaignWeek(cfg, new Date()));
    const [candidates, picks] = await Promise.all([
      prisma.rutaSubmission.findMany({
        where: { week, status: "VERIFIED" },
        orderBy: { createdAt: "asc" },
        take: 200,
        select: {
          id: true, postUrl: true, text: true, metricsAtRecheck: true, metricsAtSubmit: true,
          player: { select: { walletAddress: true, xLink: { select: { username: true } } } },
          pick: { select: { id: true, status: true } },
        },
      }),
      prisma.rutaCollectorPick.findMany({ orderBy: [{ week: "asc" }, { createdAt: "asc" }] }),
    ]);
    return json({ week, picksPerWeek: cfg.picksPerWeek, picksTotal: cfg.picksTotal, candidates, picks });
  } catch (e) {
    return handleError(e, "admin/picks");
  }
}

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("select"), submissionId: z.string().min(1).max(64), note: z.string().max(500).optional() }),
  z.object({ action: z.literal("cancel"), pickId: z.string().min(1).max(64) }),
  z.object({ action: z.literal("sent"), pickId: z.string().min(1).max(64), txHash: z.string(), note: z.string().max(500).optional() }),
]);

/**
 * select: record a winner (moves nothing on chain).
 * sent:   record the tx hash of a transfer the admin already made by hand.
 * cancel: free an unsent pick's slot.
 */
export async function POST(req: Request) {
  try {
    const admin = requireAdmin(req);
    const b = Body.parse(await req.json());
    if (b.action === "select") return json({ pick: await selectPick(b.submissionId, admin, b.note ?? null) });
    if (b.action === "cancel") return json({ pick: await cancelPick(b.pickId) });
    if (!isTxHash(b.txHash)) return json({ error: "txHash must be a 0x-prefixed 32-byte hash" }, 400);
    await markPickSent(b.pickId, b.txHash, b.note ?? null);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof PickError) return json({ error: e.message }, e.status);
    return handleError(e, "admin/picks");
  }
}
