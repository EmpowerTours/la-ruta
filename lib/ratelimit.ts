// Rate limiting, same shape as Hunt's lib/ratelimit.ts: Upstash fixed window
// when configured, otherwise a bounded in-memory bucket (single instance only).
import { getRedis } from "./redis";

export type LimitName = "auth" | "submit" | "xconnect" | "read" | "admin" | "agent";

interface Quota {
  tokens: number;
  windowSeconds: number;
}

const LIMITS: Record<LimitName, { quota: Quota; failClosed: boolean }> = {
  auth: { quota: { tokens: 10, windowSeconds: 600 }, failClosed: true },
  submit: { quota: { tokens: 6, windowSeconds: 600 }, failClosed: true },
  xconnect: { quota: { tokens: 10, windowSeconds: 600 }, failClosed: true },
  read: { quota: { tokens: 60, windowSeconds: 60 }, failClosed: false },
  admin: { quota: { tokens: 120, windowSeconds: 60 }, failClosed: false },
  agent: { quota: { tokens: 120, windowSeconds: 60 }, failClosed: false },
};

export interface LimitResult {
  ok: boolean;
  resetAt: number;
}

const MAX_KEYS = 20_000;
const memory = new Map<string, { count: number; resetAt: number }>();

function memoryHit(key: string, q: Quota, now: number): LimitResult {
  let e = memory.get(key);
  if (!e || e.resetAt <= now) {
    if (memory.size >= MAX_KEYS) {
      for (const [k, v] of memory) if (v.resetAt <= now) memory.delete(k);
      while (memory.size >= MAX_KEYS) {
        const oldest = memory.keys().next();
        if (oldest.done) break;
        memory.delete(oldest.value);
      }
    }
    e = { count: 0, resetAt: now + q.windowSeconds * 1000 };
    memory.set(key, e);
  }
  if (e.count >= q.tokens) return { ok: false, resetAt: e.resetAt };
  e.count += 1; // a blocked caller writes nothing
  return { ok: true, resetAt: e.resetAt };
}

export async function checkLimit(name: LimitName, subject: string): Promise<LimitResult> {
  const spec = LIMITS[name];
  const now = Date.now();
  const window = Math.floor(now / (spec.quota.windowSeconds * 1000));
  const key = `ruta:rl:${name}:${subject}:${window}`;
  const resetAt = (window + 1) * spec.quota.windowSeconds * 1000;
  const redis = getRedis();
  if (!redis) return memoryHit(key, spec.quota, now);
  try {
    const n = await redis.incr(key);
    if (n === 1) await redis.expire(key, spec.quota.windowSeconds);
    return { ok: n <= spec.quota.tokens, resetAt };
  } catch {
    return spec.failClosed ? { ok: false, resetAt } : memoryHit(key, spec.quota, now);
  }
}

export function retryAfter(resetAt: number): string {
  return String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)));
}
