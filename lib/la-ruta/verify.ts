// Post verification — the decision, as a PURE function.
//
// Same posture as Hunt's lib/hunt/validator.ts: no DB, no network, no clock.
// The route gathers the facts (from X and our DB) and this decides, so every
// decision can be replayed from stored rows. Reject by default: only a post
// with no reject reason AND no flag is accepted, and comparisons are written
// `if (!(good))` so a NaN or a missing value lands on the reject side.

import { MISLEADING_PHRASES, maxSimilarity, normalizePostText, ownTextLength } from "./text";

export const REJECT_REASONS = [
  "not_owner", // post author is not the linked X account
  "before_start",
  "after_end",
  "no_mention", // does not mention @EmpowerTours
  "not_following", // author does not follow @EmpowerTours
  "repost", // a repost, not an original post
  "too_short", // fewer than MIN_OWN_TEXT characters of their own words
  "protected_account",
  "template_copy", // repeats a published example prompt
  "duplicate", // copy of an earlier submission
  "deleted", // gone at the re-check
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export const FLAG_REASONS = [
  "follow_unverified", // could not confirm the follow (cache stale / spend cap)
  "near_duplicate",
  "new_account",
  "low_followers",
  "reply_post",
  "misleading_claim",
  "engagement_anomaly",
  "low_engagement",
  "missing_data",
] as const;
export type FlagReason = (typeof FLAG_REASONS)[number];

/** Rejects a person can fix and then resubmit the SAME post for. */
export const RETRYABLE_REJECTS: readonly RejectReason[] = ["not_following"];

export const THRESHOLDS = {
  minOwnText: 40,
  duplicateAt: 0.8,
  nearDuplicateAt: 0.6,
  templateAt: 0.85,
  minAccountAgeDays: 60,
  minFollowers: 15,
  /** Engagement above this multiple of the author's followers is suspicious. */
  anomalyFollowerMultiple: 2,
  /** ...but only once the absolute numbers are big enough to matter. */
  anomalyMinEngagement: 100,
  /** At the re-check: at least this many impressions, or one like/reply. */
  minImpressions: 30,
} as const;

export interface PostMetrics {
  likes: number;
  reposts: number;
  replies: number;
  quotes: number;
  impressions: number | null;
}

export interface PostFacts {
  id: string;
  authorId: string;
  text: string;
  createdAt: Date;
  mentions: Array<{ id?: string | null; username: string }>;
  /** X `referenced_tweets[].type`: "retweeted" | "quoted" | "replied_to". */
  referencedTypes: string[];
  metrics: PostMetrics;
}

export interface AuthorFacts {
  id: string;
  createdAt: Date | null;
  followers: number | null;
  protected: boolean;
}

export interface VerifyInput {
  post: PostFacts;
  author: AuthorFacts;
  linkedXUserId: string;
  campaign: {
    startsAt: Date;
    endsAt: Date;
    targetUserId: string;
    targetUsername: string;
  };
  /** true = follows, false = confirmed not following, null = unknown. */
  followsTarget: boolean | null;
  /** Normalised texts of earlier submissions by OTHER posts. */
  priorTexts: readonly string[];
  templates: readonly string[];
  now: Date;
}

export type Decision = "accept" | "flag" | "reject";

export interface VerifyResult {
  decision: Decision;
  reasons: RejectReason[];
  flags: FlagReason[];
  textNorm: string;
  similarTo: number; // best similarity to an earlier submission
}

function finite(n: number | null | undefined): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function decide(reasons: RejectReason[], flags: FlagReason[]): Decision {
  if (reasons.length > 0) return "reject";
  if (flags.length > 0) return "flag";
  return "accept";
}

export function engagementOf(m: PostMetrics): number {
  return [m.likes, m.reposts, m.replies, m.quotes].reduce(
    (a, b) => a + (finite(b) ? b : 0),
    0,
  );
}

/** Engagement far beyond what the author's audience can explain. */
export function isEngagementAnomaly(m: PostMetrics, followers: number | null): boolean {
  const e = engagementOf(m);
  if (!(e >= THRESHOLDS.anomalyMinEngagement)) return false;
  if (!finite(followers)) return true; // big numbers, unknown audience: look at it
  return e > Math.max(1, followers) * THRESHOLDS.anomalyFollowerMultiple;
}

export function mentionsTarget(
  mentions: PostFacts["mentions"],
  targetUserId: string,
  targetUsername: string,
): boolean {
  return mentions.some(
    (m) =>
      (m.id != null && m.id === targetUserId) ||
      m.username.replace(/^@/, "").toLowerCase() === targetUsername,
  );
}

export function verifyPost(input: VerifyInput): VerifyResult {
  const { post, author, campaign } = input;
  const reasons: RejectReason[] = [];
  const flags: FlagReason[] = [];
  const textNorm = normalizePostText(post.text ?? "");

  if (!(post.authorId === input.linkedXUserId && author.id === input.linkedXUserId)) {
    reasons.push("not_owner");
  }

  const created = post.createdAt.getTime();
  if (!(finite(created) && created >= campaign.startsAt.getTime())) reasons.push("before_start");
  if (!(finite(created) && created <= campaign.endsAt.getTime())) reasons.push("after_end");
  if (!(finite(created) && created <= input.now.getTime() + 5 * 60_000)) {
    // A post from the future is a broken clock or a forged fact.
    if (!reasons.includes("after_end")) reasons.push("after_end");
  }

  if (!mentionsTarget(post.mentions, campaign.targetUserId, campaign.targetUsername)) {
    reasons.push("no_mention");
  }

  if (post.referencedTypes.includes("retweeted")) reasons.push("repost");
  if (post.referencedTypes.includes("replied_to")) flags.push("reply_post");

  if (!(ownTextLength(post.text ?? "") >= THRESHOLDS.minOwnText)) reasons.push("too_short");

  if (author.protected) reasons.push("protected_account");

  if (input.followsTarget === false) reasons.push("not_following");
  else if (input.followsTarget !== true) flags.push("follow_unverified");

  const template = maxSimilarity(textNorm, input.templates);
  if (template.score >= THRESHOLDS.templateAt) reasons.push("template_copy");

  const prior = maxSimilarity(textNorm, input.priorTexts);
  if (prior.score >= THRESHOLDS.duplicateAt) reasons.push("duplicate");
  else if (prior.score >= THRESHOLDS.nearDuplicateAt) flags.push("near_duplicate");

  if (author.createdAt === null || !finite(author.createdAt.getTime())) {
    flags.push("missing_data");
  } else {
    const ageDays = (input.now.getTime() - author.createdAt.getTime()) / 86_400_000;
    if (!(ageDays >= THRESHOLDS.minAccountAgeDays)) flags.push("new_account");
  }

  if (!(finite(author.followers) && author.followers >= THRESHOLDS.minFollowers)) {
    flags.push("low_followers");
  }

  const lower = (post.text ?? "").toLowerCase();
  if (MISLEADING_PHRASES.some((p) => lower.includes(p))) flags.push("misleading_claim");

  if (isEngagementAnomaly(post.metrics, author.followers)) flags.push("engagement_anomaly");

  return {
    decision: decide(reasons, flags),
    reasons,
    flags,
    textNorm,
    similarTo: prior.score,
  };
}

export interface RecheckInput {
  /** null when X no longer returns the post (deleted or made private). */
  post: PostFacts | null;
  author: AuthorFacts | null;
}

/**
 * The delayed re-check. The post must still be up and public, and have a
 * minimum of real attention; outsized attention goes to review.
 */
export function recheckPost(input: RecheckInput): { decision: Decision; reasons: RejectReason[]; flags: FlagReason[] } {
  const reasons: RejectReason[] = [];
  const flags: FlagReason[] = [];
  if (input.post === null || input.author === null) {
    reasons.push("deleted");
    return { decision: "reject", reasons, flags };
  }
  if (input.author.protected) reasons.push("protected_account");

  const m = input.post.metrics;
  const someAttention =
    (finite(m.impressions) && m.impressions >= THRESHOLDS.minImpressions) ||
    (finite(m.likes) && m.likes >= 1) ||
    (finite(m.replies) && m.replies >= 1);
  if (!someAttention) flags.push("low_engagement");
  if (isEngagementAnomaly(m, input.author.followers)) flags.push("engagement_anomaly");

  return { decision: decide(reasons, flags), reasons, flags };
}
