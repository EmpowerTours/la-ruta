// Live X API v2 client (pay-per-use). Every request reserves its cost through
// `reserve` first; if the monthly cap would be crossed, `reserve` throws and
// the request is never sent. Server-only: uses the app bearer token.
import "server-only";

import { X_PRICE_MICROS } from "@/lib/la-ruta/spend";
import { X_TOKEN_URL } from "./pkce";
import type { XClient, XPostLookup, XUser } from "./types";

const API = "https://api.x.com/2";
const TIMEOUT_MS = 8_000;

export interface LiveConfig {
  bearerToken: string;
  clientId: string;
  clientSecret: string | null;
  redirectUri: string;
  reserve: (micros: bigint, calls?: number) => Promise<void>;
}

interface RawUser {
  id: string;
  username: string;
  created_at?: string;
  protected?: boolean;
  public_metrics?: { followers_count?: number };
}

function toUser(u: RawUser): XUser {
  const created = u.created_at ? new Date(u.created_at) : null;
  return {
    id: u.id,
    username: u.username.toLowerCase(),
    createdAt: created && Number.isFinite(created.getTime()) ? created : null,
    followers: typeof u.public_metrics?.followers_count === "number" ? u.public_metrics.followers_count : null,
    protected: u.protected === true,
  };
}

async function getJson(url: string, token: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

export function liveXClient(cfg: LiveConfig): XClient {
  return {
    mode: "live",

    async getPost(postId): Promise<XPostLookup | null> {
      if (!/^\d{5,25}$/.test(postId)) return null;
      // One post + its expanded author.
      await cfg.reserve(X_PRICE_MICROS.postRead + X_PRICE_MICROS.userRead, 1);
      const u = new URL(`${API}/tweets/${postId}`);
      u.searchParams.set("tweet.fields", "author_id,created_at,entities,referenced_tweets,public_metrics");
      u.searchParams.set("expansions", "author_id");
      u.searchParams.set("user.fields", "created_at,protected,public_metrics,username");
      const { status, body } = await getJson(u.toString(), cfg.bearerToken);
      if (status === 404) return null;
      if (status !== 200) throw new Error(`X tweet lookup failed (${status})`);
      const b = body as {
        data?: {
          id: string;
          author_id: string;
          text: string;
          created_at: string;
          entities?: { mentions?: Array<{ id?: string; username: string }> };
          referenced_tweets?: Array<{ type: string }>;
          public_metrics?: {
            like_count?: number;
            retweet_count?: number;
            reply_count?: number;
            quote_count?: number;
            impression_count?: number;
          };
        };
        includes?: { users?: RawUser[] };
      };
      const d = b?.data;
      if (!d) return null; // X returns 200 + errors[] for missing / private posts
      const raw = b.includes?.users?.find((x) => x.id === d.author_id);
      if (!raw) return null;
      const author = toUser(raw);
      const m = d.public_metrics ?? {};
      return {
        post: {
          id: d.id,
          authorId: d.author_id,
          text: d.text,
          createdAt: new Date(d.created_at),
          mentions: (d.entities?.mentions ?? []).map((x) => ({ id: x.id ?? null, username: x.username })),
          referencedTypes: (d.referenced_tweets ?? []).map((r) => r.type),
          metrics: {
            likes: m.like_count ?? 0,
            reposts: m.retweet_count ?? 0,
            replies: m.reply_count ?? 0,
            quotes: m.quote_count ?? 0,
            impressions: typeof m.impression_count === "number" ? m.impression_count : null,
          },
        },
        author,
      };
    },

    async listFollowers(targetUserId, cursor, pageSize) {
      const size = Math.max(1, Math.min(1000, Math.floor(pageSize)));
      // Worst case: a full page of follower records.
      await cfg.reserve(X_PRICE_MICROS.followerRead * BigInt(size), 1);
      const u = new URL(`${API}/users/${encodeURIComponent(targetUserId)}/followers`);
      u.searchParams.set("max_results", String(size));
      if (cursor) u.searchParams.set("pagination_token", cursor);
      const { status, body } = await getJson(u.toString(), cfg.bearerToken);
      if (status !== 200) throw new Error(`X followers lookup failed (${status})`);
      const b = body as { data?: Array<{ id: string }>; meta?: { next_token?: string } };
      return { ids: (b.data ?? []).map((x) => x.id), next: b.meta?.next_token ?? null };
    },

    async identifyFromCode(code, codeVerifier) {
      const form = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: cfg.redirectUri,
        code_verifier: codeVerifier,
        client_id: cfg.clientId,
      });
      const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
      if (cfg.clientSecret) {
        headers.authorization = `Basic ${Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64")}`;
      }
      const tok = await fetch(X_TOKEN_URL, {
        method: "POST",
        headers,
        body: form,
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const tb = (await tok.json().catch(() => null)) as { access_token?: string } | null;
      if (!tok.ok || !tb?.access_token) throw new Error(`X token exchange failed (${tok.status})`);

      await cfg.reserve(X_PRICE_MICROS.userRead, 1);
      const u = new URL(`${API}/users/me`);
      u.searchParams.set("user.fields", "created_at,protected,public_metrics,username");
      const { status, body } = await getJson(u.toString(), tb.access_token);
      // The user token is used once and dropped: never stored, never logged.
      if (status !== 200) throw new Error(`X users/me failed (${status})`);
      const raw = (body as { data?: RawUser }).data;
      if (!raw) throw new Error("X users/me returned no user");
      return toUser(raw);
    },
  };
}
