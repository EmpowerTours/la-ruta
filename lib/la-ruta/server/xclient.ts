import "server-only";

import { campaignConfig, xMode } from "../config";
import { liveXClient } from "@/lib/x/live";
import { mockXClient } from "@/lib/x/mock";
import type { XClient } from "@/lib/x/types";
import { reserveXSpend } from "./spend";

/** The X client for this environment, or null when X is disabled (production without keys). */
export function getXClient(): XClient | null {
  const mode = xMode();
  if (mode === "disabled") return null;
  if (mode === "mock") return mockXClient({ startsAt: campaignConfig().startsAt });
  return liveXClient({
    bearerToken: process.env.X_BEARER_TOKEN!,
    clientId: process.env.X_CLIENT_ID!,
    clientSecret: process.env.X_CLIENT_SECRET || null,
    redirectUri: process.env.X_REDIRECT_URI!,
    reserve: (micros, calls) => reserveXSpend(micros, calls),
  });
}
