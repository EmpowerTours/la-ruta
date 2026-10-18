import "server-only";

import { prisma } from "@/lib/db/prisma";
import { combineSignals, type EligibilityResult, type Signals } from "../eligibility";
import { POINTS } from "../points";
import { grantPoints, upsertEntry } from "./entries";
import { huntSignals, onchainSignals } from "./onchain";

export async function gatherSignals(wallet: string): Promise<Signals> {
  const imported = await prisma.rutaEligibleImport.findUnique({ where: { walletAddress: wallet } });
  const onchainOff = process.env.LA_RUTA_ONCHAIN === "off";
  const [chain, hunt] = await Promise.all([
    onchainOff ? Promise.resolve<Signals>({}) : onchainSignals(wallet as `0x${string}`),
    huntSignals(wallet),
  ]);
  return { ...chain, ...hunt, admin_import: imported ? true : false };
}

/** Check and, if eligible, add an AUTO entry + points (idempotent). */
export async function checkAndGrant(player: { id: string; walletAddress: string }): Promise<EligibilityResult> {
  const result = combineSignals(await gatherSignals(player.walletAddress));
  if (result.eligible) {
    await prisma.$transaction(async (tx) => {
      await upsertEntry(tx, player.id, player.walletAddress, "AUTO", result.reasons);
      await grantPoints(tx, player.id, "eligible.auto", player.id, POINTS.autoEligible);
    });
  }
  return result;
}
