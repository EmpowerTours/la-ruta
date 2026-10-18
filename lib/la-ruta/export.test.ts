import { describe, expect, it } from "vitest";

import { csvCell, isFounding, toCsv, toJson, type ExportRow } from "./export";

const row: ExportRow = {
  walletAddress: "0xabc0000000000000000000000000000000000001",
  sources: ["AUTO", "POST"],
  reasons: ["dime_holder"],
  xUsername: "=cmd|calc",
  points: 150,
  verifiedPosts: 1,
  founding: true,
  joinedAt: new Date("2026-11-01T00:00:00Z"),
};

describe("export", () => {
  it("neutralises spreadsheet formulas and quotes separators", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("@x")).toBe("'@x");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell(null)).toBe("");
  });
  it("writes a header and one line per wallet", () => {
    const csv = toCsv([row]).trim().split("\n");
    expect(csv[0]).toBe("wallet,sources,reasons,x_username,points,verified_posts,founding,joined_at");
    expect(csv[1]).toContain("'=cmd|calc");
    expect(csv[1].startsWith(row.walletAddress)).toBe(true);
  });
  it("writes JSON with chain id and count", () => {
    const j = JSON.parse(toJson([row], new Date("2026-12-11T00:00:00Z")));
    expect(j.chainId).toBe(143);
    expect(j.count).toBe(1);
    expect(j.wallets[0].wallet).toBe(row.walletAddress);
  });
  it("founding means AUTO and POST", () => {
    expect(isFounding(["AUTO", "POST"])).toBe(true);
    expect(isFounding(["POST"])).toBe(false);
  });
});
