// Auto-eligibility: has this wallet already used EmpowerTours?
//
// Each source answers true / false / null (unknown — not configured, or the
// read failed). The combination is pure. Unknown is never treated as yes.

export type SignalName =
  | "dime_holder" // holds a Dime Que Sí licence (LicenseRegistry master 13)
  | "licence_holder" // holds any EmpowerTours music/art licence
  | "passport_holder" // holds a DigitalPassport NFT
  | "music_subscriber" // active MusicSubscriptionV6 subscription
  | "hunt_player" // Hunt finds or payouts       (needs Hunt eligibility API — STUB)
  | "cota_user" // signed a Cota                 (needs Hunt eligibility API — STUB)
  | "turbo_member" // TURBO cohort member         (needs Hunt eligibility API — STUB)
  | "admin_import"; // imported by an admin from another project's export

export type SignalValue = boolean | null;
export type Signals = Partial<Record<SignalName, SignalValue>>;

export interface EligibilityResult {
  eligible: boolean;
  reasons: SignalName[];
  unknown: SignalName[];
}

export function combineSignals(signals: Signals): EligibilityResult {
  const reasons: SignalName[] = [];
  const unknown: SignalName[] = [];
  for (const [name, value] of Object.entries(signals) as Array<[SignalName, SignalValue]>) {
    if (value === true) reasons.push(name);
    else if (value !== false) unknown.push(name);
  }
  reasons.sort();
  unknown.sort();
  return { eligible: reasons.length > 0, reasons, unknown };
}

/** Shape the Hunt eligibility endpoint is expected to return (not built in Hunt yet). */
export interface HuntEligibility {
  huntPlayer: boolean;
  cotaUser: boolean;
  turboMember: boolean;
}

export function parseHuntEligibility(body: unknown): HuntEligibility | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (
    typeof b.huntPlayer !== "boolean" ||
    typeof b.cotaUser !== "boolean" ||
    typeof b.turboMember !== "boolean"
  ) {
    return null;
  }
  return { huntPlayer: b.huntPlayer, cotaUser: b.cotaUser, turboMember: b.turboMember };
}
