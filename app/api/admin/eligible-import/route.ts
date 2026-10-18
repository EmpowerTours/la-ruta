import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { handleError, json } from "@/lib/http";

const Body = z.object({
  wallets: z.array(z.string().regex(/^0x[0-9a-fA-F]{40}$/)).min(1).max(5000),
  reason: z.string().regex(/^[a-z0-9_:-]{2,40}$/),
});

/**
 * Import eligible wallets exported from another project's admin (e.g. Hunt
 * players), until those projects expose an eligibility API. Read-only toward
 * the other project: we only ever store the list here.
 */
export async function POST(req: Request) {
  try {
    const admin = requireAdmin(req);
    const { wallets, reason } = Body.parse(await req.json());
    const r = await prisma.rutaEligibleImport.createMany({
      data: Array.from(new Set(wallets.map((w) => w.toLowerCase()))).map((walletAddress) => ({ walletAddress, reason, importedBy: admin })),
      skipDuplicates: true,
    });
    return json({ imported: r.count });
  } catch (e) {
    return handleError(e, "admin/eligible-import");
  }
}
