import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { privateKeyToAccount } from "viem/accounts";

import { MemoryNonceStore, verifySessionSignature } from "./eip712";
import { issueSession, openPayload, readCookie, readSession, sealPayload } from "./session";
import { RUTA_DOMAIN, SESSION_STATEMENT, SESSION_TYPES } from "./typedData";

const SECRET = "x".repeat(40);
const W = "0x1111111111111111111111111111111111111111";

describe("session token", () => {
  let prev: string | undefined;
  beforeEach(() => {
    prev = process.env.AUTH_SESSION_SECRET;
    process.env.AUTH_SESSION_SECRET = SECRET;
  });
  afterEach(() => {
    process.env.AUTH_SESSION_SECRET = prev;
  });

  it("round-trips and lowercases", () => {
    const t = issueSession(W.toUpperCase().replace("0X", "0x"));
    expect(readSession(t)).toEqual({ ok: true, wallet: W });
  });
  it("rejects tampering, expiry and a missing secret", () => {
    const t = issueSession(W);
    expect(readSession(t.slice(0, -2) + "aa").ok).toBe(false);
    expect(readSession(t, Date.now() + 8 * 86_400_000).ok).toBe(false);
    process.env.AUTH_SESSION_SECRET = "short";
    expect(readSession(t).ok).toBe(false);
  });
  it("keeps purposes apart", () => {
    const t = sealPayload("xoauth", { a: 1 });
    expect(openPayload("xoauth", t)).toEqual({ a: 1 });
    expect(openPayload("s", t)).toBeNull();
  });
  it("reads cookies", () => {
    const req = new Request("https://x.test", { headers: { cookie: "a=1; ruta_session=abc%3D" } });
    expect(readCookie(req, "ruta_session")).toBe("abc=");
    expect(readCookie(req, "nope")).toBeNull();
  });
});

describe("login signature", () => {
  const account = privateKeyToAccount(`0x${"1".repeat(64)}`);
  const now = new Date("2026-11-01T00:00:00Z");
  const clientTs = BigInt(Math.floor(now.getTime() / 1000));
  async function sign(domain: typeof RUTA_DOMAIN | { name: string; version: string; chainId: number } = RUTA_DOMAIN, nonce = "n".repeat(24)) {
    return account.signTypedData({
      domain,
      types: SESSION_TYPES,
      primaryType: "Session",
      message: { wallet: account.address, statement: SESSION_STATEMENT, clientTs, nonce },
    });
  }

  it("accepts once, refuses a replay", async () => {
    const store = new MemoryNonceStore();
    const signature = await sign();
    const p = { wallet: account.address, statement: SESSION_STATEMENT, clientTs, nonce: "n".repeat(24), signature };
    expect(await verifySessionSignature(p, { store, now })).toEqual({ ok: true, address: account.address.toLowerCase() });
    expect(await verifySessionSignature(p, { store, now })).toEqual({ ok: false, reason: "nonce_replayed" });
  });
  it("refuses a Hunt-domain signature (no cross-app replay)", async () => {
    const signature = await sign({ name: "EmpowerToursHunt", version: "1", chainId: 143 });
    const r = await verifySessionSignature(
      { wallet: account.address, statement: SESSION_STATEMENT, clientTs, nonce: "n".repeat(24), signature },
      { store: new MemoryNonceStore(), now },
    );
    expect(r).toEqual({ ok: false, reason: "wrong_signer" });
  });
  it("refuses stale timestamps and wrong statements", async () => {
    const signature = await sign();
    const p = { wallet: account.address, statement: SESSION_STATEMENT, clientTs, nonce: "n".repeat(24), signature };
    expect(await verifySessionSignature(p, { store: new MemoryNonceStore(), now: new Date(now.getTime() + 600_000) })).toEqual({ ok: false, reason: "expired" });
    expect(await verifySessionSignature({ ...p, statement: "Sign in to EmpowerTours Hunt. This does not authorise a transaction." }, { store: new MemoryNonceStore(), now })).toEqual({ ok: false, reason: "malformed" });
  });
});
