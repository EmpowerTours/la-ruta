import { describe, expect, it } from "vitest";

import { campaignConfig, campaignWeek, dimeClaimUrl, dollarsToMicros, xMode } from "./config";

const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;

describe("config", () => {
  it("defaults to Oct 29 – Dec 10 and @EmpowerTours", () => {
    const c = campaignConfig(env({}));
    expect(c.startsAt.toISOString()).toBe("2026-10-29T06:00:00.000Z");
    expect(c.endsAt.toISOString()).toBe("2026-12-11T05:59:59.000Z");
    expect(c.targetUserId).toBe("1779415212614963200");
    expect(c.picksPerWeek).toBe(3);
    expect(c.picksTotal).toBe(20);
    expect(c.spendCapMicros).toBe(150_000_000n);
  });
  it("parses the spend cap strictly", () => {
    expect(dollarsToMicros("75.5", 0n)).toBe(75_500_000n);
    expect(dollarsToMicros("-1", 7n)).toBe(7n);
    expect(dollarsToMicros("1e9", 7n)).toBe(7n);
  });
  it("computes 6 campaign weeks", () => {
    const c = campaignConfig(env({}));
    expect(campaignWeek(c, new Date("2026-10-28T00:00:00Z"))).toBe(0);
    expect(campaignWeek(c, c.startsAt)).toBe(1);
    expect(campaignWeek(c, new Date("2026-11-05T06:00:00Z"))).toBe(2);
    expect(campaignWeek(c, new Date("2026-12-10T12:00:00Z"))).toBe(6);
    expect(campaignWeek(c, new Date("2027-01-10T00:00:00Z"))).toBe(6);
  });
  it("never runs mock in production", () => {
    expect(xMode(env({ NODE_ENV: "development" }))).toBe("mock");
    expect(xMode(env({ NODE_ENV: "production" }))).toBe("disabled");
    expect(xMode(env({ NODE_ENV: "production", X_MODE: "mock" }))).toBe("disabled");
    expect(xMode(env({ NODE_ENV: "production", X_CLIENT_ID: "a", X_BEARER_TOKEN: "b", X_REDIRECT_URI: "c" }))).toBe("live");
  });
  it("sends the free claim to Hunt /dime", () => {
    expect(dimeClaimUrl(env({}))).toBe("https://hunt.empowertours.xyz/dime");
  });
});
