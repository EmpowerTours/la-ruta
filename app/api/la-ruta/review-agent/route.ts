import { z } from "zod";

import { requireReviewAgent } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { handleError, json } from "@/lib/http";
import { parseReview } from "@/lib/la-ruta/review";
import { applyReview } from "@/lib/la-ruta/server/submissions";

// Reach, the review agent. Bearer LA_RUTA_REVIEW_TOKEN. Scope: list FLAGGED
// submissions and approve/reject them. Nothing else — no picks, no exports,
// no settings, no PENDING or VERIFIED rows.

export async function GET(req: Request) {
  try {
    requireReviewAgent(req);
    const rows = await prisma.rutaSubmission.findMany({
      where: { status: "FLAGGED" },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: {
        id: true, postUrl: true, text: true, flags: true, reasons: true, week: true,
        postCreatedAt: true, metricsAtSubmit: true, metricsAtRecheck: true, createdAt: true,
        player: { select: { xLink: { select: { username: true, accountCreatedAt: true, followersCount: true } } } },
      },
    });
    return json({ flagged: rows });
  } catch (e) {
    return handleError(e, "la-ruta/review-agent");
  }
}

const Body = z.object({ submissionId: z.string().min(1).max(64) }).passthrough();

export async function POST(req: Request) {
  try {
    const reviewer = requireReviewAgent(req);
    const raw = await req.json();
    const { submissionId } = Body.parse(raw);
    const review = parseReview(raw);
    if ("error" in review) return json({ error: review.error }, 400);
    const ok = await applyReview(submissionId, reviewer, review.decision, review.reasonCode, review.note);
    if (!ok) return json({ error: "not a flagged submission" }, 409);
    return json({ ok: true });
  } catch (e) {
    return handleError(e, "la-ruta/review-agent");
  }
}
