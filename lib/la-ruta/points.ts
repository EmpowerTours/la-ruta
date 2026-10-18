// Ruta Points. Off-chain record of participation, no cash value. They MAY
// count toward $TOURS (the deployed ToursTokenV2); no amounts are promised.

export const POINTS = {
  /** First verified post: the one that earns the whitelist spot. */
  firstPost: 100,
  /** Each later verified post (submission limits apply). */
  extraPost: 25,
  /** Qualified automatically through earlier EmpowerTours activity. */
  autoEligible: 50,
  /** Chosen as a weekly Collector Edition pick. */
  collectorPick: 50,
} as const;

export type PointsKind = "post.first" | "post.extra" | "eligible.auto" | "pick.collector";

/** Idempotency keys: one grant per fact, ever. */
export function pointsRefId(kind: PointsKind, subject: string): string {
  return `${kind}:${subject}`;
}

export function pointsForVerifiedPost(verifiedBefore: number): { kind: PointsKind; delta: number } {
  return verifiedBefore <= 0
    ? { kind: "post.first", delta: POINTS.firstPost }
    : { kind: "post.extra", delta: POINTS.extraPost };
}

export const POINTS_DISCLAIMER_EN =
  "Ruta Points are a record of participation. They have no cash value. They may count toward $TOURS, the EmpowerTours token on Monad; any amounts will be announced later and nothing is guaranteed.";
export const POINTS_DISCLAIMER_ES =
  "Los Ruta Points son un registro de participación. No tienen valor en efectivo. Podrían contar para $TOURS, el token de EmpowerTours en Monad; cualquier monto se anunciará después y nada está garantizado.";
