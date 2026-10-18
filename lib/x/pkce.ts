// OAuth 2.0 PKCE helpers (RFC 7636), S256 only.
import { createHash, randomBytes } from "node:crypto";

export function newCodeVerifier(): string {
  // 32 random bytes -> 43 base64url chars (the RFC minimum length).
  return randomBytes(32).toString("base64url");
}

export function codeChallengeS256(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function newState(): string {
  return randomBytes(24).toString("base64url");
}

export const X_AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";
export const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
/** users.read needs tweet.read alongside it. Nothing that can post or follow. */
export const X_SCOPES = ["tweet.read", "users.read"] as const;

export function authorizeUrl(args: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const u = new URL(X_AUTHORIZE_URL);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", args.clientId);
  u.searchParams.set("redirect_uri", args.redirectUri);
  u.searchParams.set("scope", X_SCOPES.join(" "));
  u.searchParams.set("state", args.state);
  u.searchParams.set("code_challenge", args.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}
