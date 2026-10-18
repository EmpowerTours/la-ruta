import { describe, expect, it } from "vitest";

import { maxSimilarity, normalizePostText, ownTextLength, similarity } from "./text";

describe("text", () => {
  it("normalises accents, case, links, mentions and punctuation", () => {
    expect(normalizePostText("¿Dime que SÍ? @EmpowerTours https://t.co/x #LaRuta!!")).toBe("dime que si");
  });
  it("counts only the author's own words", () => {
    expect(ownTextLength("@EmpowerTours https://x.com/a hi there")).toBe(8);
  });
  it("scores identical text 1 and unrelated text near 0", () => {
    const a = normalizePostText("walked to a hunt cache in oaxaca and found music");
    expect(similarity(a, a)).toBe(1);
    expect(similarity(a, normalizePostText("monad passport collection sunset photo today"))).toBe(0);
  });
  it("finds the closest match in a corpus", () => {
    const corpus = ["one two three four", "walked to a hunt cache"].map(normalizePostText);
    expect(maxSimilarity(normalizePostText("walked to a hunt cache"), corpus).index).toBe(1);
  });
  it("handles empty input", () => {
    expect(similarity("", "")).toBe(0);
  });
});
