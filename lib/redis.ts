import { Redis } from "@upstash/redis";

let client: Redis | null = null;
let resolved = false;

/** Shared Upstash client, or null when UPSTASH_REDIS_REST_URL / _TOKEN are unset. */
export function getRedis(): Redis | null {
  if (resolved) return client;
  resolved = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  client = url && token ? new Redis({ url, token }) : null;
  return client;
}
