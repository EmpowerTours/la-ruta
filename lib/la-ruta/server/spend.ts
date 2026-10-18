import "server-only";

import { prisma } from "@/lib/db/prisma";
import { campaignConfig } from "../config";
import { monthKey, SpendCapError } from "../spend";

/**
 * Reserve `micros` of this month's X budget, atomically.
 * One conditional UPDATE: it only applies while spent + micros <= cap, and the
 * row count says whether it did. Two concurrent callers cannot both squeeze
 * under the cap.
 */
export async function reserveXSpend(micros: bigint, calls = 1, now = new Date()): Promise<void> {
  const cap = campaignConfig().spendCapMicros;
  const month = monthKey(now);
  if (micros < 0n || micros > cap) throw new SpendCapError();
  await prisma.rutaXSpend.upsert({ where: { month }, create: { month }, update: {} });
  const { count } = await prisma.rutaXSpend.updateMany({
    where: { month, spentMicros: { lte: cap - micros } },
    data: { spentMicros: { increment: micros }, calls: { increment: calls } },
  });
  if (count !== 1) throw new SpendCapError();
}

export async function spendStatus(now = new Date()) {
  const cap = campaignConfig().spendCapMicros;
  const month = monthKey(now);
  const row = await prisma.rutaXSpend.findUnique({ where: { month } });
  return { month, spentMicros: row?.spentMicros ?? 0n, calls: row?.calls ?? 0, capMicros: cap };
}
