// Text helpers for copy-paste / duplicate detection. Pure.

/** Lowercase, strip URLs, @mentions, #tags, emoji/punctuation, collapse spaces. */
export function normalizePostText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // accents: "sí" == "si"
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[@#][\p{L}\p{N}_]+/gu, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Characters the author wrote themselves: text minus URLs and @mentions. */
export function ownTextLength(text: string): number {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/@[A-Za-z0-9_]+/g, "")
    .replace(/\s+/g, " ")
    .trim().length;
}

/** Word 3-gram shingles (falls back to words for very short text). */
export function shingles(norm: string, n = 3): Set<string> {
  const words = norm.split(" ").filter(Boolean);
  const out = new Set<string>();
  if (words.length < n) {
    for (const w of words) out.add(w);
    return out;
  }
  for (let i = 0; i + n <= words.length; i++) out.add(words.slice(i, i + n).join(" "));
  return out;
}

/** Jaccard similarity of two normalised texts, 0..1. */
export function similarity(a: string, b: string): number {
  const sa = shingles(a);
  const sb = shingles(b);
  if (sa.size === 0 || sb.size === 0) return a === b && a.length > 0 ? 1 : 0;
  let inter = 0;
  for (const s of sa) if (sb.has(s)) inter++;
  return inter / (sa.size + sb.size - inter);
}

/** Highest similarity against a corpus, with the index of the closest match. */
export function maxSimilarity(norm: string, corpus: readonly string[]): { score: number; index: number } {
  let best = { score: 0, index: -1 };
  for (let i = 0; i < corpus.length; i++) {
    const s = similarity(norm, corpus[i]);
    if (s > best.score) best = { score: s, index: i };
  }
  return best;
}

/**
 * The example prompts we publish. A post that just repeats one of them is a
 * template copy, not an original post.
 */
export const PUBLISHED_TEMPLATES: readonly string[] = [
  "¿Dime que sí? I said yes to La Ruta @EmpowerTours",
  "First time hearing Dime Que Sí on @EmpowerTours and",
  "I walked to a Hunt cache and",
  "Joining La Ruta with @EmpowerTours, every project is a stop on the route",
].map(normalizePostText);

/** Phrases that make reward claims we never make. Sent to review, not auto-approved. */
export const MISLEADING_PHRASES: readonly string[] = [
  "guaranteed airdrop",
  "airdrop guaranteed",
  "free money",
  "100x",
  "price prediction",
  "garantizado",
  "dinero gratis",
];
