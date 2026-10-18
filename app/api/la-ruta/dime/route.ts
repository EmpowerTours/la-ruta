import { json } from "@/lib/http";
import { dimeClaimUrl } from "@/lib/la-ruta/config";

// Proxies Hunt's PUBLIC free-claim status so the landing page can show the
// current remaining free claims. The claim itself happens on Hunt (/dime).
const cache = new Map<"dime", { at: number; body: unknown }>();
const TTL_MS = 60_000;

export async function GET() {
  const claimUrl = dimeClaimUrl();
  const hit = cache.get("dime");
  if (hit && Date.now() - hit.at < TTL_MS) return json(hit.body);
  try {
    const api = new URL("/api/dime/claim", claimUrl);
    const res = await fetch(api, { cache: "no-store", signal: AbortSignal.timeout(4000) });
    const b = (await res.json()) as { open?: unknown; remaining?: unknown };
    const body = {
      claimUrl,
      open: b.open === true,
      remaining: typeof b.remaining === "number" ? b.remaining : null,
      fetchedAt: new Date().toISOString(),
    };
    cache.set("dime", { at: Date.now(), body });
    return json(body);
  } catch {
    return json({ claimUrl, open: null, remaining: null, fetchedAt: null });
  }
}
