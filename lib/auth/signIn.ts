"use client";

import { createAccount, signInAccount, type PasskeyAccount } from "./passkey";
import { RUTA_DOMAIN, SESSION_STATEMENT, SESSION_TYPES } from "./typedData";

/**
 * Passkey -> wallet -> EIP-712 Session signature -> HttpOnly session cookie.
 * The private key is derived, used for one signature, and dropped in the page.
 */
export async function passkeySignIn(mode: "existing" | "new"): Promise<string> {
  const pk: PasskeyAccount = mode === "new" ? await createAccount() : await signInAccount();
  const n = (await (await fetch("/api/auth/nonce", { cache: "no-store" })).json()) as { nonce: string };
  const clientTs = BigInt(Math.floor(Date.now() / 1000));
  const wallet = pk.account.address;
  const signature = await pk.account.signTypedData({
    domain: RUTA_DOMAIN,
    types: SESSION_TYPES,
    primaryType: "Session",
    message: { wallet, statement: SESSION_STATEMENT, clientTs, nonce: n.nonce },
  });
  const res = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet, statement: SESSION_STATEMENT, clientTs: clientTs.toString(), nonce: n.nonce, signature }),
  });
  if (!res.ok) throw new Error("Sign-in was refused. Try again.");
  return wallet.toLowerCase();
}

export async function signOut(): Promise<void> {
  await fetch("/api/auth/session", { method: "DELETE" });
}
