import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { pointsRefId, type PointsKind } from "../points";

type Tx = Prisma.TransactionClient;

/** Idempotent points grant: refId is unique, a repeat is a no-op. */
export async function grantPoints(tx: Tx, playerId: string, kind: PointsKind, subject: string, delta: number): Promise<boolean> {
  const r = await tx.rutaPointsLedger.createMany({
    data: [{ playerId, kind, delta, refId: pointsRefId(kind, subject) }],
    skipDuplicates: true,
  });
  return r.count === 1;
}

/** Add the player to the whitelist (or add a source/reasons to their entry). */
export async function upsertEntry(tx: Tx, playerId: string, walletAddress: string, source: "AUTO" | "POST" | "ADMIN", reasons: string[] = []) {
  const existing = await tx.rutaEntry.findUnique({ where: { playerId } });
  if (!existing) {
    return tx.rutaEntry.create({ data: { playerId, walletAddress: walletAddress.toLowerCase(), sources: [source], reasons } });
  }
  const sources = Array.from(new Set([...existing.sources, source])).sort();
  const merged = Array.from(new Set([...existing.reasons, ...reasons])).sort();
  return tx.rutaEntry.update({ where: { playerId }, data: { sources, reasons: merged } });
}

export async function pointsTotal(playerId: string): Promise<number> {
  const r = await prisma.rutaPointsLedger.aggregate({ where: { playerId }, _sum: { delta: true } });
  return r._sum.delta ?? 0;
}
