// X API spend guard. Pay-per-use prices (docs.x.com, read 2026-10-18), in
// micro-dollars. Every call RESERVES its worst-case cost before it is made;
// a reservation that would cross the monthly cap is refused and the call is
// not made. Reservations are never refunded (conservative by design).

export const X_PRICE_MICROS = {
  postRead: 5_000n, // $0.005 per post returned
  userRead: 10_000n, // $0.010 per user returned
  followerRead: 10_000n, // $0.010 per follower record
  ownedRead: 1_000n, // $0.001 (own data, app owned by @EmpowerTours)
} as const;

/** UTC calendar month key, e.g. "2026-10". X bills per billing cycle; this is a close proxy. */
export function monthKey(now: Date): string {
  return now.toISOString().slice(0, 7);
}

export function wouldExceed(spent: bigint, delta: bigint, cap: bigint): boolean {
  return !(delta >= 0n && spent + delta <= cap);
}

export function formatMicros(micros: bigint): string {
  const cents = micros / 10_000n;
  return `$${cents / 100n}.${(cents % 100n).toString().padStart(2, "0")}`;
}

export class SpendCapError extends Error {
  constructor() {
    super("X API monthly spend cap reached");
    this.name = "SpendCapError";
  }
}
