import { describe, expect, it } from "vitest";

import { combineSignals, parseHuntEligibility } from "./eligibility";
import { POINTS, pointsForVerifiedPost, pointsRefId } from "./points";
import { isTxHash, parseReview } from "./review";
import { formatMicros, monthKey, wouldExceed, X_PRICE_MICROS } from "./spend";

describe("spend", () => {
  it("prices match the X pay-per-use table", () => {
    expect(X_PRICE_MICROS.postRead).toBe(5_000n);
    expect(X_PRICE_MICROS.userRead).toBe(10_000n);
  });
  it("refuses a reservation that crosses the cap", () => {
    expect(wouldExceed(149_990_000n, 15_000n, 150_000_000n)).toBe(true);
    expect(wouldExceed(149_985_000n, 15_000n, 150_000_000n)).toBe(false);
    expect(wouldExceed(0n, -1n, 150_000_000n)).toBe(true);
  });
  it("formats and keys months", () => {
    expect(formatMicros(150_000_000n)).toBe("$150.00");
    expect(formatMicros(32_000n)).toBe("$0.03");
    expect(monthKey(new Date("2026-11-30T23:59:59Z"))).toBe("2026-11");
  });
});

describe("eligibility", () => {
  it("is eligible on any true signal, never on unknown", () => {
    expect(combineSignals({ dime_holder: true, hunt_player: null })).toEqual({ eligible: true, reasons: ["dime_holder"], unknown: ["hunt_player"] });
    expect(combineSignals({ hunt_player: null, passport_holder: false }).eligible).toBe(false);
  });
  it("parses the Hunt API shape strictly", () => {
    expect(parseHuntEligibility({ huntPlayer: true, cotaUser: false, turboMember: false })).toEqual({ huntPlayer: true, cotaUser: false, turboMember: false });
    expect(parseHuntEligibility({ huntPlayer: "yes" })).toBeNull();
  });
});

describe("points", () => {
  it("first post earns more than extras", () => {
    expect(pointsForVerifiedPost(0)).toEqual({ kind: "post.first", delta: POINTS.firstPost });
    expect(pointsForVerifiedPost(2)).toEqual({ kind: "post.extra", delta: POINTS.extraPost });
    expect(pointsRefId("post.first", "abc")).toBe("post.first:abc");
  });
});

describe("review", () => {
  it("validates decisions and reason codes", () => {
    expect(parseReview({ decision: "approve", reasonCode: "ORIGINAL_OK" })).toEqual({ decision: "approve", reasonCode: "ORIGINAL_OK", note: null });
    expect(parseReview({ decision: "approve", reasonCode: "LOW_EFFORT" })).toHaveProperty("error");
    expect(parseReview({ decision: "reject", reasonCode: "ORIGINAL_OK" })).toHaveProperty("error");
    expect(parseReview({ decision: "delete", reasonCode: "OTHER" })).toHaveProperty("error");
    expect(parseReview(null)).toHaveProperty("error");
  });
  it("accepts only real tx hashes", () => {
    expect(isTxHash(`0x${"a".repeat(64)}`)).toBe(true);
    expect(isTxHash("0x123")).toBe(false);
  });
});
