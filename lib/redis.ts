// Key-value store for nonces and rate limits. Two backends, one interface:
//   * Upstash REST (UPSTASH_REDIS_REST_URL / _TOKEN), as in Hunt;
//   * plain Redis over TCP (REDIS_URL), e.g. a Railway Redis service.
// Upstash wins when both are set. Null when neither is configured.
import { Redis as Upstash } from "@upstash/redis";
import IORedis from "ioredis";

export interface Kv {
  /** SET key 1 NX EX ttl. True only when the key was newly written. */
  setNxEx(key: string, ttlSeconds: number): Promise<boolean>;
  incr(key: string): Promise<number>;
  expire(key: string, ttlSeconds: number): Promise<void>;
}

let client: Kv | null = null;
let resolved = false;

function upstashKv(url: string, token: string): Kv {
  const r = new Upstash({ url, token });
  return {
    setNxEx: async (key, ttl) => (await r.set(key, 1, { nx: true, ex: ttl })) === "OK",
    incr: (key) => r.incr(key),
    expire: async (key, ttl) => {
      await r.expire(key, ttl);
    },
  };
}

function tcpKv(url: string): Kv {
  // family 0: Railway's private network is IPv6-only.
  const r = new IORedis(url, { family: 0, maxRetriesPerRequest: 2, enableOfflineQueue: true, lazyConnect: false });
  r.on("error", () => undefined); // surfaced per command instead
  return {
    setNxEx: async (key, ttl) => (await r.set(key, "1", "EX", ttl, "NX")) === "OK",
    incr: (key) => r.incr(key),
    expire: async (key, ttl) => {
      await r.expire(key, ttl);
    },
  };
}

export function getRedis(): Kv | null {
  if (resolved) return client;
  resolved = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) client = upstashKv(url, token);
  else if (process.env.REDIS_URL) client = tcpKv(process.env.REDIS_URL);
  else client = null;
  return client;
}
