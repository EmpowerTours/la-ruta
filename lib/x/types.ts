import type { AuthorFacts, PostFacts } from "@/lib/la-ruta/verify";

export interface XUser {
  id: string;
  username: string;
  createdAt: Date | null;
  followers: number | null;
  protected: boolean;
}

export interface XPostLookup {
  post: PostFacts;
  author: AuthorFacts & { username: string };
}

/** The X calls La Ruta makes. Implemented live (lib/x/live.ts) and mocked (lib/x/mock.ts). */
export interface XClient {
  readonly mode: "live" | "mock";
  /** One post plus its author. Null when the post does not exist or is not visible. */
  getPost(postId: string): Promise<XPostLookup | null>;
  /**
   * One page of @EmpowerTours' followers, newest first.
   * Returns ids and an opaque cursor for the next page.
   */
  listFollowers(targetUserId: string, cursor: string | null, pageSize: number): Promise<{ ids: string[]; next: string | null }>;
  /** Exchange an OAuth code for the linked user's identity. The token is discarded. */
  identifyFromCode(code: string, codeVerifier: string): Promise<XUser>;
}
