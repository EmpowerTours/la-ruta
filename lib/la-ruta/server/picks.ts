import "server-only";

import { prisma } from "@/lib/db/prisma";
import { campaignConfig } from "../config";
import { POINTS } from "../points";
import { grantPoints } from "./entries";

export class PickError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "PickError";
  }
}

async function bump(tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], key: string, cap: number) {
  await tx.rutaPickCounter.upsert({ where: { key }, create: { key }, update: {} });
  const { count } = await tx.rutaPickCounter.updateMany({ where: { key, count: { lt: cap } }, data: { count: { increment: 1 } } });
  return count === 1;
}

/**
 * Select a VERIFIED submission as a Collector Edition pick for its week.
 * Records the decision only. NOTHING is sent on chain here.
 */
export async function selectPick(submissionId: string, admin: string, note: string | null) {
  const cfg = campaignConfig();
  return prisma.$transaction(async (tx) => {
    const s = await tx.rutaSubmission.findUnique({ where: { id: submissionId }, include: { player: true, pick: true } });
    if (!s) throw new PickError("submission not found", 404);
    if (s.status !== "VERIFIED") throw new PickError("only verified posts can be picked");
    if (s.pick && s.pick.status !== "CANCELLED") throw new PickError("already picked", 409);
    const already = await tx.rutaCollectorPick.count({ where: { playerId: s.playerId, status: { not: "CANCELLED" } } });
    if (already > 0) throw new PickError("this person already has a pick", 409);
    if (!(await bump(tx, `week:${s.week}`, cfg.picksPerWeek))) throw new PickError(`week ${s.week} already has ${cfg.picksPerWeek} picks`, 409);
    if (!(await bump(tx, "total", cfg.picksTotal))) throw new PickError(`all ${cfg.picksTotal} picks are used`, 409);
    const pick = s.pick
      ? await tx.rutaCollectorPick.update({ where: { id: s.pick.id }, data: { status: "SELECTED", selectedBy: admin, note, txHash: null } })
      : await tx.rutaCollectorPick.create({
          data: { week: s.week, submissionId: s.id, playerId: s.playerId, walletAddress: s.player.walletAddress, selectedBy: admin, note },
        });
    await grantPoints(tx, s.playerId, "pick.collector", s.id, POINTS.collectorPick);
    return pick;
  });
}

/** Cancel a pick that has not been sent; frees its slot. */
export async function cancelPick(pickId: string) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.rutaCollectorPick.updateMany({ where: { id: pickId, status: "SELECTED" }, data: { status: "CANCELLED" } });
    if (count !== 1) throw new PickError("only a selected, unsent pick can be cancelled", 409);
    const p = await tx.rutaCollectorPick.findUniqueOrThrow({ where: { id: pickId } });
    await tx.rutaPickCounter.updateMany({ where: { key: `week:${p.week}`, count: { gt: 0 } }, data: { count: { decrement: 1 } } });
    await tx.rutaPickCounter.updateMany({ where: { key: "total", count: { gt: 0 } }, data: { count: { decrement: 1 } } });
    return p;
  });
}

/** Record the tx hash of a transfer the admin made BY HAND, outside this app. */
export async function markPickSent(pickId: string, txHash: string, note: string | null) {
  const { count } = await prisma.rutaCollectorPick.updateMany({
    where: { id: pickId, status: "SELECTED" },
    data: { status: "SENT", txHash: txHash.toLowerCase(), ...(note ? { note } : {}) },
  });
  if (count !== 1) throw new PickError("only a selected pick can be marked sent", 409);
}
