import "server-only";

import { Prisma, type RutaSubmission } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { registerMockAuthor } from "@/lib/x/mock";
import { canonicalPostUrl, type ParsedPostUrl } from "@/lib/x/parse";
import type { XClient } from "@/lib/x/types";
import { campaignConfig, campaignWeek } from "../config";
import { pointsForVerifiedPost } from "../points";
import { PUBLISHED_TEMPLATES } from "../text";
import { RETRYABLE_REJECTS, recheckPost, verifyPost, type RejectReason } from "../verify";
import { grantPoints, upsertEntry } from "./entries";
import { followsTarget } from "./followers";

export class SubmitError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "SubmitError";
  }
}

const PRIOR_TEXT_LIMIT = 5_000;

async function priorTexts(excludePostId: string): Promise<string[]> {
  const rows = await prisma.rutaSubmission.findMany({
    where: { postId: { not: excludePostId }, status: { not: "REJECTED" } },
    select: { textNorm: true },
    orderBy: { createdAt: "desc" },
    take: PRIOR_TEXT_LIMIT,
  });
  return rows.map((r) => r.textNorm);
}

function asJson(v: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
}

/** Submit a post. Returns the stored submission. */
export async function submitPost(
  x: XClient,
  player: { id: string; walletAddress: string; suspendedAt: Date | null },
  parsed: ParsedPostUrl,
  now = new Date(),
): Promise<RutaSubmission> {
  const cfg = campaignConfig();
  if (player.suspendedAt) throw new SubmitError("This account is paused. Contact @EmpowerTours.", 403);
  if (!(now >= cfg.startsAt)) throw new SubmitError("La Ruta has not started yet.");
  if (!(now <= cfg.endsAt)) throw new SubmitError("La Ruta has ended.");

  const link = await prisma.rutaXLink.findUnique({ where: { playerId: player.id } });
  if (!link) throw new SubmitError("Link your X account first.");
  if (parsed.username && parsed.username !== link.username && !link.mock) {
    throw new SubmitError("That link is not from your linked X account.");
  }

  const existing = await prisma.rutaSubmission.findUnique({ where: { postId: parsed.postId } });
  if (existing) {
    const retryable =
      existing.playerId === player.id &&
      existing.status === "REJECTED" &&
      existing.reasons.length > 0 &&
      existing.reasons.every((r) => (RETRYABLE_REJECTS as readonly string[]).includes(r));
    if (!retryable) throw new SubmitError("This post was already submitted.", 409);
  }

  // Per-day / per-week limits (resubmits of the same post do not count again).
  if (!existing) {
    const dayAgo = new Date(now.getTime() - 86_400_000);
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const [day, week] = await Promise.all([
      prisma.rutaSubmission.count({ where: { playerId: player.id, createdAt: { gte: dayAgo } } }),
      prisma.rutaSubmission.count({ where: { playerId: player.id, createdAt: { gte: weekAgo } } }),
    ]);
    if (!(day < cfg.maxSubmissionsPerDay)) throw new SubmitError("One post per day. Come back tomorrow.", 429);
    if (!(week < cfg.maxSubmissionsPerWeek)) throw new SubmitError("Weekly post limit reached.", 429);
  }

  if (x.mode === "mock") registerMockAuthor(parsed.postId, link.xUserId);
  const found = await x.getPost(parsed.postId);
  if (!found) throw new SubmitError("We could not find that post. Is it public?", 404);

  const follows = await followsTarget(x, link.xUserId, parsed.postId);
  const result = verifyPost({
    post: found.post,
    author: found.author,
    linkedXUserId: link.xUserId,
    campaign: cfg,
    followsTarget: follows,
    priorTexts: await priorTexts(parsed.postId),
    templates: PUBLISHED_TEMPLATES,
    now,
  });

  const status = result.decision === "reject" ? "REJECTED" : result.decision === "flag" ? "FLAGGED" : "PENDING";
  const data = {
    playerId: player.id,
    postUrl: canonicalPostUrl({ postId: parsed.postId, username: found.author.username }),
    xUserId: found.post.authorId,
    text: found.post.text.slice(0, 2000),
    textNorm: result.textNorm,
    postCreatedAt: found.post.createdAt,
    status,
    reasons: result.reasons,
    flags: result.flags,
    metricsAtSubmit: asJson(found.post.metrics),
    recheckAt: status === "PENDING" ? new Date(now.getTime() + cfg.recheckHours * 3_600_000) : null,
    week: Math.max(1, campaignWeek(cfg, found.post.createdAt)),
  } as const;

  try {
    return existing
      ? await prisma.rutaSubmission.update({ where: { id: existing.id }, data: { ...data, rechecks: 0, reviewedAt: null, reviewedBy: null, reviewNote: null } })
      : await prisma.rutaSubmission.create({ data: { ...data, postId: parsed.postId } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new SubmitError("This post was already submitted.", 409);
    }
    throw e;
  }
}

/** Mark VERIFIED and grant the entry + points, once. Status guard makes it race-safe. */
export async function markVerified(submissionId: string, fromStatus: "PENDING" | "FLAGGED", review?: { by: string; note: string | null }) {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.rutaSubmission.updateMany({
      where: { id: submissionId, status: fromStatus },
      data: {
        status: "VERIFIED",
        recheckAt: null,
        ...(review ? { reviewedBy: review.by, reviewedAt: new Date(), reviewNote: review.note } : {}),
      },
    });
    if (count !== 1) return false;
    const s = await tx.rutaSubmission.findUniqueOrThrow({ where: { id: submissionId }, include: { player: true } });
    const verifiedBefore = await tx.rutaSubmission.count({ where: { playerId: s.playerId, status: "VERIFIED", id: { not: s.id } } });
    const { kind, delta } = pointsForVerifiedPost(verifiedBefore);
    await upsertEntry(tx, s.playerId, s.player.walletAddress, "POST");
    await grantPoints(tx, s.playerId, kind, s.id, delta);
    return true;
  });
}

export async function markRejected(
  submissionId: string,
  fromStatus: "PENDING" | "FLAGGED",
  reasons: string[],
  review?: { by: string; note: string | null },
) {
  const { count } = await prisma.rutaSubmission.updateMany({
    where: { id: submissionId, status: fromStatus },
    data: {
      status: "REJECTED",
      reasons,
      recheckAt: null,
      ...(review ? { reviewedBy: review.by, reviewedAt: new Date(), reviewNote: review.note } : {}),
    },
  });
  return count === 1;
}

/** Cron: re-check due PENDING submissions. */
export async function runRechecks(x: XClient, now = new Date(), limit = 50) {
  const due = await prisma.rutaSubmission.findMany({
    where: { status: "PENDING", recheckAt: { lte: now } },
    orderBy: { recheckAt: "asc" },
    take: limit,
  });
  const out = { verified: 0, flagged: 0, rejected: 0, errors: 0 };
  for (const s of due) {
    try {
      if (x.mode === "mock") registerMockAuthor(s.postId, s.xUserId);
      const found = await x.getPost(s.postId);
      const r = recheckPost({ post: found?.post ?? null, author: found?.author ?? null });
      await prisma.rutaSubmission.update({
        where: { id: s.id },
        data: { metricsAtRecheck: found ? asJson(found.post.metrics) : Prisma.JsonNull, rechecks: { increment: 1 } },
      });
      if (r.decision === "accept") {
        if (await markVerified(s.id, "PENDING")) out.verified++;
      } else if (r.decision === "flag") {
        const { count } = await prisma.rutaSubmission.updateMany({
          where: { id: s.id, status: "PENDING" },
          data: { status: "FLAGGED", flags: Array.from(new Set([...s.flags, ...r.flags])), recheckAt: null },
        });
        out.flagged += count;
      } else {
        if (await markRejected(s.id, "PENDING", r.reasons as RejectReason[])) out.rejected++;
      }
    } catch {
      out.errors++;
      break; // likely spend cap or X outage: stop, retry next run
    }
  }
  return out;
}

/** Apply a review decision (admin or Reach). Only FLAGGED submissions can be reviewed. */
export async function applyReview(
  submissionId: string,
  reviewer: string,
  decision: "approve" | "reject",
  reasonCode: string,
  note: string | null,
): Promise<boolean> {
  const ok =
    decision === "approve"
      ? await markVerified(submissionId, "FLAGGED", { by: reviewer, note })
      : await markRejected(submissionId, "FLAGGED", [`review:${reasonCode}`], { by: reviewer, note });
  if (ok) {
    await prisma.rutaReviewLog.create({ data: { submissionId, reviewer, decision, reasonCode, note } });
  }
  return ok;
}
