import { describe, expect, it } from "vitest";

import { normalizePostText, PUBLISHED_TEMPLATES } from "./text";
import { recheckPost, verifyPost, type VerifyInput } from "./verify";

const START = new Date("2026-10-29T06:00:00Z");
const END = new Date("2026-12-11T05:59:59Z");
const ME = "111";
const TARGET = "1779415212614963200";

function base(over: Partial<VerifyInput> = {}, postOver: Partial<VerifyInput["post"]> = {}): VerifyInput {
  return {
    post: {
      id: "1850000000000000001",
      authorId: ME,
      text: "Walked to my first Hunt cache in Oaxaca today with @EmpowerTours and found a song NFT. ¿Dime que sí? Wild.",
      createdAt: new Date("2026-11-02T18:00:00Z"),
      mentions: [{ id: TARGET, username: "EmpowerTours" }],
      referencedTypes: [],
      metrics: { likes: 4, reposts: 1, replies: 2, quotes: 0, impressions: 300 },
      ...postOver,
    },
    author: { id: ME, createdAt: new Date("2021-05-01T00:00:00Z"), followers: 250, protected: false },
    linkedXUserId: ME,
    campaign: { startsAt: START, endsAt: END, targetUserId: TARGET, targetUsername: "empowertours" },
    followsTarget: true,
    priorTexts: [],
    templates: PUBLISHED_TEMPLATES,
    now: new Date("2026-11-02T19:00:00Z"),
    ...over,
  };
}

describe("verifyPost", () => {
  it("accepts a clean original post", () => {
    const r = verifyPost(base());
    expect(r.decision).toBe("accept");
    expect(r.reasons).toEqual([]);
    expect(r.flags).toEqual([]);
  });

  it("rejects a post from another account", () => {
    const r = verifyPost(base({}, { authorId: "999" }));
    expect(r.decision).toBe("reject");
    expect(r.reasons).toContain("not_owner");
  });

  it("rejects when the author record does not match the link either", () => {
    const input = base();
    input.author = { ...input.author, id: "999" };
    expect(verifyPost(input).reasons).toContain("not_owner");
  });

  it("rejects posts before the start and after the end", () => {
    expect(verifyPost(base({}, { createdAt: new Date("2026-10-28T23:00:00Z") })).reasons).toContain("before_start");
    expect(verifyPost(base({ now: new Date("2026-12-20T00:00:00Z") }, { createdAt: new Date("2026-12-12T00:00:00Z") })).reasons).toContain("after_end");
  });

  it("accepts a post exactly at the start", () => {
    expect(verifyPost(base({}, { createdAt: START })).reasons).not.toContain("before_start");
  });

  it("rejects an invalid created_at instead of letting NaN through", () => {
    const r = verifyPost(base({}, { createdAt: new Date("nope") }));
    expect(r.reasons).toContain("before_start");
  });

  it("requires a mention of @EmpowerTours by id or username", () => {
    expect(verifyPost(base({}, { mentions: [] })).reasons).toContain("no_mention");
    expect(verifyPost(base({}, { mentions: [{ id: null, username: "EMPOWERTOURS" }] })).reasons).not.toContain("no_mention");
    expect(verifyPost(base({}, { mentions: [{ id: "5", username: "empowertours_fake" }] })).reasons).toContain("no_mention");
  });

  it("does not accept the song title alone (name collision)", () => {
    const r = verifyPost(base({}, { text: "Dime Que Sí is the song of the year, on repeat all week long, no skips at all.", mentions: [] }));
    expect(r.reasons).toContain("no_mention");
  });

  it("rejects when the author does not follow, flags when unknown", () => {
    expect(verifyPost(base({ followsTarget: false })).reasons).toContain("not_following");
    const unknown = verifyPost(base({ followsTarget: null }));
    expect(unknown.decision).toBe("flag");
    expect(unknown.flags).toContain("follow_unverified");
  });

  it("rejects reposts and flags replies", () => {
    expect(verifyPost(base({}, { referencedTypes: ["retweeted"] })).reasons).toContain("repost");
    const reply = verifyPost(base({}, { referencedTypes: ["replied_to"] }));
    expect(reply.decision).toBe("flag");
    expect(reply.flags).toContain("reply_post");
  });

  it("rejects too-short posts (mentions and links do not count)", () => {
    const r = verifyPost(base({}, { text: "@EmpowerTours yes https://x.com/a/status/1" }));
    expect(r.reasons).toContain("too_short");
  });

  it("rejects protected accounts", () => {
    const input = base();
    input.author = { ...input.author, protected: true };
    expect(verifyPost(input).reasons).toContain("protected_account");
  });

  it("rejects a published template copied word for word", () => {
    const r = verifyPost(base({}, { text: "Joining La Ruta with @EmpowerTours, every project is a stop on the route!!" }));
    expect(r.reasons).toContain("template_copy");
  });

  it("rejects duplicates and flags near-duplicates of earlier submissions", () => {
    const text = base().post.text;
    expect(verifyPost(base({ priorTexts: [normalizePostText(text)] })).reasons).toContain("duplicate");
    const near = normalizePostText(
      "Walked to my first Hunt cache in Oaxaca today with @EmpowerTours and found a song NFT. Honestly loved it.",
    );
    const r = verifyPost(base({ priorTexts: [near] }));
    expect(r.reasons).not.toContain("duplicate");
    expect(r.flags).toContain("near_duplicate");
  });

  it("flags new accounts, low followers and missing data", () => {
    const input = base();
    input.author = { ...input.author, createdAt: new Date("2026-10-20T00:00:00Z"), followers: 3 };
    const r = verifyPost(input);
    expect(r.decision).toBe("flag");
    expect(r.flags).toEqual(expect.arrayContaining(["new_account", "low_followers"]));
    const missing = base();
    missing.author = { ...missing.author, createdAt: null, followers: null };
    expect(verifyPost(missing).flags).toEqual(expect.arrayContaining(["missing_data", "low_followers"]));
  });

  it("flags misleading reward claims", () => {
    const r = verifyPost(base({}, { text: base().post.text + " Guaranteed airdrop for everyone!" }));
    expect(r.flags).toContain("misleading_claim");
  });

  it("flags engagement far beyond the audience", () => {
    const r = verifyPost(base({}, { metrics: { likes: 800, reposts: 200, replies: 10, quotes: 0, impressions: 5000 } }));
    expect(r.flags).toContain("engagement_anomaly");
  });

  it("a reject beats a flag", () => {
    const input = base({ followsTarget: null }, { mentions: [] });
    expect(verifyPost(input).decision).toBe("reject");
  });
});

describe("recheckPost", () => {
  const ok = base();
  it("rejects a deleted post", () => {
    expect(recheckPost({ post: null, author: null })).toEqual({ decision: "reject", reasons: ["deleted"], flags: [] });
  });
  it("accepts a live post with some attention", () => {
    expect(recheckPost({ post: ok.post, author: ok.author }).decision).toBe("accept");
  });
  it("flags zero attention", () => {
    const post = { ...ok.post, metrics: { likes: 0, reposts: 0, replies: 0, quotes: 0, impressions: 5 } };
    expect(recheckPost({ post, author: ok.author }).flags).toContain("low_engagement");
  });
  it("flags bought engagement and rejects a now-protected account", () => {
    const post = { ...ok.post, metrics: { likes: 2000, reposts: 500, replies: 0, quotes: 0, impressions: 9000 } };
    expect(recheckPost({ post, author: ok.author }).flags).toContain("engagement_anomaly");
    expect(recheckPost({ post: ok.post, author: { ...ok.author, protected: true } }).decision).toBe("reject");
  });
});
