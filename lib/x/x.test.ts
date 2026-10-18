import { describe, expect, it } from "vitest";

import { mockUserFor, mockXClient, registerMockAuthor } from "./mock";
import { canonicalPostUrl, parsePostUrl } from "./parse";
import { authorizeUrl, codeChallengeS256, newCodeVerifier } from "./pkce";

describe("parsePostUrl", () => {
  it("accepts x.com, twitter.com, mobile and bare ids", () => {
    expect(parsePostUrl("https://x.com/Someone/status/1850000000000000001?s=20")).toEqual({ postId: "1850000000000000001", username: "someone" });
    expect(parsePostUrl("https://mobile.twitter.com/a_b/status/123456789")?.postId).toBe("123456789");
    expect(parsePostUrl("https://x.com/i/web/status/123456789")).toEqual({ postId: "123456789", username: null });
    expect(parsePostUrl("123456789")).toEqual({ postId: "123456789", username: null });
  });
  it("refuses other hosts and shapes", () => {
    expect(parsePostUrl("https://evil.com/a/status/123456789")).toBeNull();
    expect(parsePostUrl("https://x.com.evil.com/a/status/123456789")).toBeNull();
    expect(parsePostUrl("javascript:alert(1)")).toBeNull();
    expect(parsePostUrl("https://x.com/a")).toBeNull();
  });
  it("builds a canonical url", () => {
    expect(canonicalPostUrl({ postId: "123456", username: "me" })).toBe("https://x.com/me/status/123456");
  });
});

describe("PKCE", () => {
  it("matches the RFC 7636 test vector", () => {
    expect(codeChallengeS256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });
  it("makes 43-char verifiers and a read-only authorize URL", () => {
    expect(newCodeVerifier()).toHaveLength(43);
    const u = new URL(authorizeUrl({ clientId: "cid", redirectUri: "https://ruta.empowertours.xyz/api/la-ruta/x/callback", state: "s", codeChallenge: "c" }));
    expect(u.origin).toBe("https://x.com");
    expect(u.searchParams.get("scope")).toBe("tweet.read users.read");
    expect(u.searchParams.get("code_challenge_method")).toBe("S256");
  });
});

describe("mock X client", () => {
  const startsAt = new Date("2026-10-29T06:00:00Z");
  it("derives a stable mock identity", async () => {
    const x = mockXClient({ startsAt });
    const a = await x.identifyFromCode("mock:0xabc", "");
    expect(a).toEqual(mockUserFor("0xabc"));
    expect(a.id.startsWith("mock-")).toBe(true);
    await expect(x.identifyFromCode("real-code", "")).rejects.toThrow();
  });
  it("encodes failure cases in the last digit", async () => {
    const x = mockXClient({ startsAt });
    registerMockAuthor("1234560", "mock-a");
    registerMockAuthor("1234561", "mock-a");
    registerMockAuthor("1234569", "mock-a");
    expect((await x.getPost("1234560"))!.post.mentions).toEqual([]);
    expect((await x.getPost("1234561"))!.post.createdAt < startsAt).toBe(true);
    expect((await x.getPost("1234569"))!.post.authorId).toBe("mock-a");
    expect(await x.getPost("99999999")).toBeNull();
  });
});
