import { NextResponse } from "next/server";

import { CLOCK_SKEW_SECONDS } from "@/lib/auth/eip712";
import { newNonce } from "@/lib/auth/session";
import { RUTA_DOMAIN, SESSION_STATEMENT } from "@/lib/auth/typedData";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      nonce: newNonce(),
      serverTs: Math.floor(Date.now() / 1000),
      clockSkewSeconds: CLOCK_SKEW_SECONDS,
      domain: RUTA_DOMAIN,
      sessionStatement: SESSION_STATEMENT,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
