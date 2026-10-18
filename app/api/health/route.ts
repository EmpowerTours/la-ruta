import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/** Railway healthcheck: 200 when the database answers. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
