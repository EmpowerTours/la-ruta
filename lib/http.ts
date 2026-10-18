import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { AuthError } from "@/lib/auth";
import { SpendCapError } from "@/lib/la-ruta/spend";

export function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

/** Map known errors to coarse responses; log the rest without details. */
export function handleError(e: unknown, where: string) {
  if (e instanceof AuthError) return json({ error: e.status === 403 ? "forbidden" : "unauthenticated" }, e.status);
  if (e instanceof ZodError || e instanceof SyntaxError) return json({ error: "invalid payload" }, 400);
  if (e instanceof SpendCapError) {
    return json({ error: "Verification is paused for now (monthly X API budget reached). Try again later." }, 503);
  }
  console.error(`[${where}] failed`, e instanceof Error ? e.name : "unknown");
  return json({ error: "internal error" }, 500);
}
