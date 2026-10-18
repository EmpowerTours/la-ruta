// Review rubric shared by the admin queue and the Reach review agent.

export const REVIEW_REASON_CODES = [
  "ORIGINAL_OK",
  "LOW_EFFORT",
  "TEMPLATE_COPY",
  "AI_FILLER",
  "BOUGHT_ENGAGEMENT",
  "SYBIL_CLUSTER",
  "NOT_OWNER",
  "MISLEADING_REWARD_CLAIM",
  "OFF_TOPIC",
  "DELETED",
  "OTHER",
] as const;
export type ReviewReasonCode = (typeof REVIEW_REASON_CODES)[number];

export type ReviewDecision = "approve" | "reject";

export interface ReviewInput {
  decision: ReviewDecision;
  reasonCode: ReviewReasonCode;
  note: string | null;
}

/** Validate a review body. Reject by default; approve must use ORIGINAL_OK. */
export function parseReview(body: unknown): ReviewInput | { error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { error: "body must be a JSON object" };
  }
  const b = body as Record<string, unknown>;
  if (b.decision !== "approve" && b.decision !== "reject") {
    return { error: "decision must be approve or reject" };
  }
  if (typeof b.reasonCode !== "string" || !(REVIEW_REASON_CODES as readonly string[]).includes(b.reasonCode)) {
    return { error: `reasonCode must be one of ${REVIEW_REASON_CODES.join(", ")}` };
  }
  if (b.decision === "approve" && b.reasonCode !== "ORIGINAL_OK") {
    return { error: "approve requires reasonCode ORIGINAL_OK" };
  }
  if (b.decision === "reject" && b.reasonCode === "ORIGINAL_OK") {
    return { error: "reject requires a rejection reason" };
  }
  let note: string | null = null;
  if (b.note !== undefined && b.note !== null) {
    if (typeof b.note !== "string" || b.note.length > 1000) return { error: "note must be a string up to 1000 characters" };
    note = b.note.trim() || null;
  }
  return { decision: b.decision, reasonCode: b.reasonCode as ReviewReasonCode, note };
}

/** A Monad tx hash, as typed by an admin after a manual transfer. */
export function isTxHash(v: unknown): v is string {
  return typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);
}
