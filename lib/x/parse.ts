// Parse a pasted post link. Accepts x.com / twitter.com / mobile variants and
// a bare numeric id; nothing else.

export interface ParsedPostUrl {
  postId: string;
  username: string | null;
}

const ID = /^\d{5,25}$/;

export function parsePostUrl(input: string): ParsedPostUrl | null {
  const raw = input.trim();
  if (ID.test(raw)) return { postId: raw, username: null };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase().replace(/^(www\.|mobile\.)/, "");
  if (host !== "x.com" && host !== "twitter.com") return null;
  const m = /^\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{5,25})(?:\/|$)/.exec(url.pathname);
  if (m) return { postId: m[2], username: m[1].toLowerCase() };
  const web = /^\/i\/(?:web\/)?status\/(\d{5,25})(?:\/|$)/.exec(url.pathname);
  if (web) return { postId: web[1], username: null };
  return null;
}

export function canonicalPostUrl(p: ParsedPostUrl): string {
  return p.username ? `https://x.com/${p.username}/status/${p.postId}` : `https://x.com/i/status/${p.postId}`;
}
