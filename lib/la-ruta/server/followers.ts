import "server-only";

import { prisma } from "@/lib/db/prisma";
import { mockNotFollowing } from "@/lib/x/mock";
import type { XClient } from "@/lib/x/types";
import { campaignConfig } from "../config";
import { SpendCapError } from "../spend";

const REFRESH_KEY = "followers.lastRefresh";
const MIN_REFRESH_MS = 5 * 60_000;
const PAGE_SIZE = 100;
const MAX_PAGES = 5;

/**
 * Pull new followers into RutaFollower. X lists followers newest first, so we
 * page until we meet an id we already have (or the page cap). At most once per
 * MIN_REFRESH_MS. Costs are reserved per page by the live client.
 */
export async function refreshFollowers(x: XClient, opts: { force?: boolean } = {}): Promise<{ added: number; skipped: boolean }> {
  if (x.mode === "mock") return { added: 0, skipped: true };
  const now = Date.now();
  const last = await prisma.rutaSetting.findUnique({ where: { key: REFRESH_KEY } });
  if (!opts.force && last && now - Number(last.value) < MIN_REFRESH_MS) return { added: 0, skipped: true };
  await prisma.rutaSetting.upsert({
    where: { key: REFRESH_KEY },
    create: { key: REFRESH_KEY, value: String(now) },
    update: { value: String(now) },
  });

  const target = campaignConfig().targetUserId;
  let cursor: string | null = null;
  let added = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const { ids, next } = await x.listFollowers(target, cursor, PAGE_SIZE);
    if (ids.length === 0) break;
    const known = await prisma.rutaFollower.findMany({ where: { xUserId: { in: ids } }, select: { xUserId: true } });
    const knownSet = new Set(known.map((k) => k.xUserId));
    const fresh = ids.filter((id) => !knownSet.has(id));
    if (fresh.length) {
      const r = await prisma.rutaFollower.createMany({ data: fresh.map((xUserId) => ({ xUserId })), skipDuplicates: true });
      added += r.count;
    }
    if (knownSet.size > 0 || !next) break; // caught up with what we had
    cursor = next;
  }
  return { added, skipped: false };
}

/**
 * true / false / null(unknown). A miss in the cache triggers one refresh; if
 * that still misses we answer false only when the refresh actually ran.
 */
export async function followsTarget(x: XClient, xUserId: string, postId: string): Promise<boolean | null> {
  if (x.mode === "mock") return !mockNotFollowing(xUserId, postId);
  if (await prisma.rutaFollower.findUnique({ where: { xUserId } })) return true;
  try {
    const r = await refreshFollowers(x);
    if (await prisma.rutaFollower.findUnique({ where: { xUserId } })) return true;
    return r.skipped ? null : false;
  } catch (e) {
    if (e instanceof SpendCapError) return null;
    return null;
  }
}
