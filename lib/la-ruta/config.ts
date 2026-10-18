// Campaign configuration. Everything comes from env with safe defaults, so the
// app boots and the tests run with no keys at all.

export const DEFAULT_START = "2026-10-29T00:00:00-06:00"; // Oct 29, Mexico City
export const DEFAULT_END = "2026-12-10T23:59:59-06:00"; // 6 weeks later

/** @EmpowerTours on X. Verified via the X API on 2026-10-18. */
export const DEFAULT_TARGET_USER_ID = "1779415212614963200";
export const DEFAULT_TARGET_USERNAME = "empowertours";

export interface CampaignConfig {
  startsAt: Date;
  endsAt: Date;
  targetUserId: string;
  /** Lowercased, without "@". */
  targetUsername: string;
  recheckHours: number;
  picksPerWeek: number;
  picksTotal: number;
  /** Monthly X API spend cap in micro-dollars. */
  spendCapMicros: bigint;
  maxSubmissionsPerDay: number;
  maxSubmissionsPerWeek: number;
}

function date(raw: string | undefined, fallback: string): Date {
  const d = new Date(raw && raw.trim() ? raw : fallback);
  if (!Number.isFinite(d.getTime())) return new Date(fallback);
  return d;
}

function int(raw: string | undefined, fallback: number, min = 0): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min ? n : fallback;
}

/** "150" or "150.50" dollars -> micro-dollars. Rejects anything else. */
export function dollarsToMicros(raw: string | undefined, fallback: bigint): bigint {
  if (raw === undefined) return fallback;
  const m = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(raw.trim());
  if (!m) return fallback;
  const cents = BigInt(m[1]) * 100n + BigInt((m[2] ?? "0").padEnd(2, "0"));
  return cents * 10_000n;
}

export function campaignConfig(env: NodeJS.ProcessEnv = process.env): CampaignConfig {
  return {
    startsAt: date(env.LA_RUTA_START, DEFAULT_START),
    endsAt: date(env.LA_RUTA_END, DEFAULT_END),
    targetUserId: env.X_TARGET_USER_ID?.trim() || DEFAULT_TARGET_USER_ID,
    targetUsername: (env.X_TARGET_USERNAME?.trim() || DEFAULT_TARGET_USERNAME)
      .replace(/^@/, "")
      .toLowerCase(),
    recheckHours: int(env.LA_RUTA_RECHECK_HOURS, 24),
    picksPerWeek: int(env.LA_RUTA_PICKS_PER_WEEK, 3, 1),
    picksTotal: int(env.LA_RUTA_PICKS_TOTAL, 20, 1),
    spendCapMicros: dollarsToMicros(env.X_API_MONTHLY_CAP_USD, 150_000_000n),
    maxSubmissionsPerDay: int(env.LA_RUTA_MAX_SUBMISSIONS_PER_DAY, 1, 1),
    maxSubmissionsPerWeek: int(env.LA_RUTA_MAX_SUBMISSIONS_PER_WEEK, 5, 1),
  };
}

/**
 * Campaign week, 1-based. 0 before the start; capped at the last week.
 * Oct 29 to Dec 10 inclusive is 43 days: the last week is rounded, so day 43
 * folds into week 6 instead of opening a one-day week 7.
 */
export function campaignWeek(cfg: Pick<CampaignConfig, "startsAt" | "endsAt">, now: Date): number {
  const ms = now.getTime() - cfg.startsAt.getTime();
  if (!(ms >= 0)) return 0;
  const lastWeek = Math.max(
    1,
    Math.round((cfg.endsAt.getTime() - cfg.startsAt.getTime()) / (7 * 86_400_000)),
  );
  return Math.min(lastWeek, Math.floor(ms / (7 * 86_400_000)) + 1);
}

export type XMode = "live" | "mock" | "disabled";

/**
 * Live only when every key is present. Without keys: mock in development and
 * test, DISABLED in production — production never silently pretends.
 */
export function xMode(env: NodeJS.ProcessEnv = process.env): XMode {
  const forced = env.X_MODE?.trim();
  const hasKeys = Boolean(env.X_CLIENT_ID && env.X_BEARER_TOKEN && env.X_REDIRECT_URI);
  if (forced === "mock") return env.NODE_ENV === "production" ? "disabled" : "mock";
  if (hasKeys) return "live";
  return env.NODE_ENV === "production" ? "disabled" : "mock";
}

/** Where people claim the free Dime Que Sí NFT. It lives on Hunt and stays there. */
export function dimeClaimUrl(env: NodeJS.ProcessEnv = process.env): string {
  return env.DIME_CLAIM_URL?.trim() || "https://hunt.empowertours.xyz/dime";
}

/** True until the campaign start. */
export function beforeStart(cfg: Pick<CampaignConfig, "startsAt">, now: Date = new Date()): boolean {
  return now.getTime() < cfg.startsAt.getTime();
}
