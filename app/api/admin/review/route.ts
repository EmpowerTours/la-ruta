import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { handleError, json } from "@/lib/http";
import { parseReview } from "@/lib/la-ruta/review";
import { applyReview } from "@/lib/la-ruta/server/submissions";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const [flagged, recent] = await Promise.all([
      prisma.rutaSubmission.findMany({
        where: { status: "FLAGGED" },
        orderBy: { createdAt: "asc" },
        take: 100,
        include: { player: { select: { walletAddress: true, xLink: { select: { username: true } } } } },
      }),
      prisma.rutaReviewLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    return json({ flagged, recent });
  } catch (e) {
    return handleError(e, "admin/review");
  }
}

const Body = z.object({ submissionId: z.string().min(1).max(64) }).passthrough();

export async function POST(req: Request) {
  try {
    const admin = requireAdmin(req);
    const raw = await req.json();
    const { submissionId } = Body.parse(raw);
    const review = parseReview(raw);
    if ("error" in review) return json({ error: review.error }, 400);
    const ok = await applyReview(submissionId, admin, review.decision, review.reasonCode, review.note);
    if (!ok) return json({ error: "not a flagged submission" }, 409);
    return json({ ok: true });
  } catch (e) {
    return handleError(e, "admin/review");
  }
}
