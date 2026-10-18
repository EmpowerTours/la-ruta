import "server-only";

import { createPublicClient, parseAbi } from "viem";

import { monad, monadTransport } from "@/lib/monad";
import type { Signals } from "../eligibility";
import { parseHuntEligibility } from "../eligibility";

/** Monad mainnet contracts (verified against EmpowerTours deployments, 2026-10). */
export const CONTRACTS = {
  licenseRegistry: "0x42EbcD44C2295702130f0A641633c691bA5f9480",
  passportV4: "0x4D5533e29Cf190131885Dc7Dbef22e31F4252410",
  passportV3: "0x93126e59004692B01961BE505aa04F55d5bd1851",
  musicSubscriptionV6: "0xc7EDB67B59B8B89cF4E9bA9bd7b940052563611B",
  /** TurboCohort — read method not confirmed; TURBO comes from the Hunt API stub. */
  turboCohort: "0x13a63A60b0E0104911e845a7e944646045C1558F",
} as const;

/** Dime Que Sí is master 13 in the LicenseRegistry. */
export const DIME_MASTER_ID = 13n;
/** Upper bound on masters scanned for "any licence" (multicall). */
const MAX_MASTERS = 64;

const LICENSE_ABI = parseAbi([
  "function licensesHeld(address,uint256) view returns (uint32)",
  "function totalMasters() view returns (uint256)",
]);
const ERC721_ABI = parseAbi(["function balanceOf(address) view returns (uint256)"]);
const SUB_ABI = parseAbi(["function hasActiveSubscription(address) view returns (bool)"]);

const client = createPublicClient({ chain: monad, transport: monadTransport() });

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch {
    return null;
  }
}

export async function onchainSignals(wallet: `0x${string}`): Promise<Signals> {
  const [dime, total, v4, v3, sub] = await Promise.all([
    safe(client.readContract({ address: CONTRACTS.licenseRegistry, abi: LICENSE_ABI, functionName: "licensesHeld", args: [wallet, DIME_MASTER_ID] })),
    safe(client.readContract({ address: CONTRACTS.licenseRegistry, abi: LICENSE_ABI, functionName: "totalMasters" })),
    safe(client.readContract({ address: CONTRACTS.passportV4, abi: ERC721_ABI, functionName: "balanceOf", args: [wallet] })),
    safe(client.readContract({ address: CONTRACTS.passportV3, abi: ERC721_ABI, functionName: "balanceOf", args: [wallet] })),
    safe(client.readContract({ address: CONTRACTS.musicSubscriptionV6, abi: SUB_ABI, functionName: "hasActiveSubscription", args: [wallet] })),
  ]);

  let anyLicence: boolean | null = dime !== null && dime > 0 ? true : null;
  if (anyLicence === null && total !== null) {
    const n = Number(total > BigInt(MAX_MASTERS) ? BigInt(MAX_MASTERS) : total);
    const held = await safe(
      Promise.all(
        Array.from({ length: n }, (_, i) =>
          client.readContract({ address: CONTRACTS.licenseRegistry, abi: LICENSE_ABI, functionName: "licensesHeld", args: [wallet, BigInt(i + 1)] }),
        ),
      ),
    );
    anyLicence = held === null ? null : held.some((h) => h > 0);
  }

  const passport = v4 === null && v3 === null ? null : (v4 ?? 0n) > 0n || (v3 ?? 0n) > 0n ? true : v4 === null || v3 === null ? null : false;

  return {
    dime_holder: dime === null ? null : dime > 0,
    licence_holder: anyLicence,
    passport_holder: passport,
    music_subscriber: sub,
  };
}

/**
 * STUB until Hunt exposes it: GET {HUNT_ELIGIBILITY_URL}?wallet=0x… with
 * `Authorization: Bearer {HUNT_ELIGIBILITY_TOKEN}` returning
 * {huntPlayer, cotaUser, turboMember}. Unset -> every answer is unknown (null).
 */
export async function huntSignals(wallet: string): Promise<Signals> {
  const url = process.env.HUNT_ELIGIBILITY_URL;
  const token = process.env.HUNT_ELIGIBILITY_TOKEN;
  const unknown: Signals = { hunt_player: null, cota_user: null, turbo_member: null };
  if (!url || !token) return unknown;
  try {
    const u = new URL(url);
    u.searchParams.set("wallet", wallet);
    const res = await fetch(u, { headers: { authorization: `Bearer ${token}` }, cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!res.ok) return unknown;
    const h = parseHuntEligibility(await res.json());
    if (!h) return unknown;
    return { hunt_player: h.huntPlayer, cota_user: h.cotaUser, turbo_member: h.turboMember };
  } catch {
    return unknown;
  }
}
