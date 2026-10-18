// Login signature verification. Adapted from Hunt's lib/auth/eip712.ts:
// single-use nonce (Redis SET NX; bounded memory in dev; production refuses to
// run without Redis), 120 s clock skew, recovered address must equal `wallet`.
import { isAddress, isHex, recoverTypedDataAddress, type Hex } from "viem";

import { getRedis } from "@/lib/redis";
import { RUTA_DOMAIN, SESSION_STATEMENT, SESSION_TYPES } from "./typedData";

export const CLOCK_SKEW_SECONDS = 120;
export const NONCE_TTL_SECONDS = CLOCK_SKEW_SECONDS * 2;

export type VerifyFailure =
  | "malformed"
  | "expired"
  | "bad_signature"
  | "wrong_signer"
  | "nonce_replayed"
  | "nonce_store_unavailable";
export type VerifyResult = { ok: true; address: string } | { ok: false; reason: VerifyFailure };

export interface SignedSession {
  wallet: string;
  statement: string;
  clientTs: bigint;
  nonce: string;
  signature: Hex;
}

export interface NonceStore {
  consume(key: string, ttlSeconds: number): Promise<boolean>;
}

class RedisNonceStore implements NonceStore {
  async consume(key: string, ttlSeconds: number): Promise<boolean> {
    const redis = getRedis();
    if (!redis) throw new Error("redis unavailable");
    return redis.setNxEx(key, ttlSeconds);
  }
}

export class MemoryNonceStore implements NonceStore {
  private readonly used = new Map<string, number>();
  constructor(private readonly maxEntries = 50_000) {}
  async consume(key: string, ttlSeconds: number): Promise<boolean> {
    const now = Date.now();
    const exp = this.used.get(key);
    if (exp !== undefined && exp > now) return false;
    if (this.used.size >= this.maxEntries) {
      for (const [k, e] of this.used) if (e <= now) this.used.delete(k);
      while (this.used.size >= this.maxEntries) {
        const oldest = this.used.keys().next();
        if (oldest.done) break;
        this.used.delete(oldest.value);
      }
    }
    this.used.delete(key);
    this.used.set(key, now + ttlSeconds * 1000);
    return true;
  }
}

const memoryStore = new MemoryNonceStore();

export function defaultNonceStore(): NonceStore {
  if (getRedis()) return new RedisNonceStore();
  if (process.env.NODE_ENV === "production") {
    throw new Error("UPSTASH_REDIS_REST_URL or REDIS_URL is required in production (nonce replay protection)");
  }
  return memoryStore;
}

const NONCE_RE = /^[A-Za-z0-9_-]{16,128}$/;

function timestampOk(clientTs: bigint, now: Date): boolean {
  if (clientTs <= 0n || clientTs > 100_000_000_000n) return false;
  const delta = Math.abs(Math.floor(now.getTime() / 1000) - Number(clientTs));
  return delta <= CLOCK_SKEW_SECONDS;
}

export async function verifySessionSignature(
  p: SignedSession,
  opts?: { store?: NonceStore; now?: Date },
): Promise<VerifyResult> {
  const now = opts?.now ?? new Date();
  if (p.statement !== SESSION_STATEMENT) return { ok: false, reason: "malformed" };
  if (!isHex(p.signature) || p.signature.length < 132) return { ok: false, reason: "malformed" };
  if (!NONCE_RE.test(p.nonce)) return { ok: false, reason: "malformed" };
  if (!isAddress(p.wallet, { strict: false })) return { ok: false, reason: "malformed" };
  if (!timestampOk(p.clientTs, now)) return { ok: false, reason: "expired" };

  let recovered: string;
  try {
    recovered = await recoverTypedDataAddress({
      domain: RUTA_DOMAIN,
      types: SESSION_TYPES,
      primaryType: "Session",
      message: { wallet: p.wallet as `0x${string}`, statement: p.statement, clientTs: p.clientTs, nonce: p.nonce },
      signature: p.signature,
    });
  } catch {
    return { ok: false, reason: "bad_signature" };
  }
  const address = recovered.toLowerCase();
  if (address !== p.wallet.toLowerCase()) return { ok: false, reason: "wrong_signer" };

  let store: NonceStore;
  try {
    store = opts?.store ?? defaultNonceStore();
  } catch {
    return { ok: false, reason: "nonce_store_unavailable" };
  }
  let fresh: boolean;
  try {
    fresh = await store.consume(`ruta:nonce:Session:${address}:${p.nonce}`, NONCE_TTL_SECONDS);
  } catch {
    return { ok: false, reason: "nonce_store_unavailable" };
  }
  if (!fresh) return { ok: false, reason: "nonce_replayed" };
  return { ok: true, address };
}
