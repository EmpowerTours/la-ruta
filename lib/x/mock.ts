// Deterministic mock X client for local dev and tests (no keys, no network).
//
// Mock identity: "mock-<hash>" / "mock_<hash>", derived from the OAuth code,
// which the mock connect route sets from the player's wallet.
//
// Mock posts: any numeric id works. The post is authored by the user encoded
// in the id registry (see registerMockAuthor), mentions @EmpowerTours, and is
// original and long enough. The LAST DIGIT of the id selects a failure case:
//   0 -> no @EmpowerTours mention      5 -> high engagement (anomaly flag)
//   1 -> created before the start      6 -> author not following
//   2 -> repost                        7 -> deleted at the re-check
//   3 -> too short                     8,9 -> clean
//   4 -> reply (flag)
import { createHash } from "node:crypto";

import type { XClient, XPostLookup, XUser } from "./types";

export const MOCK_TARGET_ID = "1779415212614963200";

function h(s: string, len = 10): string {
  return createHash("sha256").update(s).digest("hex").slice(0, len);
}

export function mockUserFor(seed: string): XUser {
  const k = h(seed);
  return {
    id: `mock-${k}`,
    username: `mock_${k}`,
    createdAt: new Date("2022-01-01T00:00:00Z"),
    followers: 120,
    protected: false,
  };
}

export interface MockOptions {
  /** postId -> author user id. Unregistered posts belong to `defaultAuthor`. */
  authors?: Map<string, string>;
  defaultAuthor?: string;
  startsAt: Date;
  /** Mock "now" for created_at; defaults to start + 1 day. */
  postedAt?: Date;
  /** Follower ids. Users not listed here still follow, except case 6. */
  deleted?: Set<string>;
}

const authorRegistry = new Map<string, string>();
/** Dev helper: the submit route registers the submitter so their pasted mock id is "theirs". */
export function registerMockAuthor(postId: string, xUserId: string): void {
  authorRegistry.set(postId, xUserId);
}
const deletedRegistry = new Set<string>();
export function markMockDeleted(postId: string): void {
  deletedRegistry.add(postId);
}

export function mockNotFollowing(xUserId: string, postId: string): boolean {
  return postId.endsWith("6") && xUserId.startsWith("mock-");
}

export function mockPostText(postId: string): string {
  // Varied, original-looking text so duplicate checks do not trip between ids.
  const words = ["walked", "route", "música", "cache", "Monad", "passport", "stop", "friends", "Oaxaca", "sunset", "map", "song"];
  const k = h(postId, 16);
  const pick = (i: number) => words[parseInt(k.slice(i, i + 2), 16) % words.length];
  return `Day ${parseInt(k.slice(0, 4), 16) % 97} on La Ruta with @EmpowerTours: ${pick(0)} ${pick(2)} ${pick(4)}, ${pick(6)} and ${pick(8)}. Note ${k}.`;
}

export function mockXClient(opts: MockOptions): XClient {
  const postedAt = opts.postedAt ?? new Date(opts.startsAt.getTime() + 86_400_000);
  return {
    mode: "mock",

    async getPost(postId): Promise<XPostLookup | null> {
      if (!/^\d{5,25}$/.test(postId)) return null;
      if (opts.deleted?.has(postId) || deletedRegistry.has(postId)) return null;
      const authorId = opts.authors?.get(postId) ?? authorRegistry.get(postId) ?? opts.defaultAuthor;
      if (!authorId) return null;
      const last = postId.at(-1);
      let text = mockPostText(postId);
      const mentions = [{ id: MOCK_TARGET_ID, username: "EmpowerTours" }];
      let createdAt = postedAt;
      const referencedTypes: string[] = [];
      let metrics = { likes: 3, reposts: 1, replies: 1, quotes: 0, impressions: 240 };
      if (last === "0") {
        text = text.replace("@EmpowerTours", "EmpowerTours");
        mentions.length = 0;
      }
      if (last === "1") createdAt = new Date(opts.startsAt.getTime() - 86_400_000);
      if (last === "2") referencedTypes.push("retweeted");
      if (last === "3") text = "La Ruta @EmpowerTours";
      if (last === "4") referencedTypes.push("replied_to");
      if (last === "5") metrics = { likes: 900, reposts: 300, replies: 40, quotes: 10, impressions: 20000 };
      return {
        post: { id: postId, authorId, text, createdAt, mentions, referencedTypes, metrics },
        author: {
          id: authorId,
          username: authorId.replace(/^mock-/, "mock_"),
          createdAt: new Date("2022-01-01T00:00:00Z"),
          followers: 120,
          protected: false,
        },
      };
    },

    async listFollowers() {
      // The mock follow check is answered by mockNotFollowing; nothing to page.
      return { ids: [], next: null };
    },

    async identifyFromCode(code) {
      if (!code.startsWith("mock:")) throw new Error("mock X client expects a mock: code");
      return mockUserFor(code.slice(5));
    },
  };
}
