# AGENTS.md — La Ruta

Rules for anyone (human or agent) changing this repo. Same posture as empowertours-hunt.

1. **Reject by default.** Write checks as `if (!(good)) reject`, so NaN / null / undefined land on the reject side. `lib/la-ruta/verify.ts` stays a PURE function: no DB, no network, no clock.
2. **Caps are atomic.** Every cap (X spend, picks per week, picks total) is a conditional `updateMany` whose row count is checked. Never read-then-write.
3. **Append-only.** `RutaPointsLedger` and `RutaReviewLog` are never updated or deleted. Points grants are idempotent via `refId`.
4. **Lowercased addresses**, always, in storage and comparisons.
5. **No secrets in code.** Everything comes from env (`.env.example`).
6. **No money moves from this app.** Collector Edition picks are recorded; the transfer is a manual admin action outside the app, recorded afterwards by tx hash. Do not add a signer, relayer or private key.
7. **Never post, follow or DM on X from this app.** OAuth scopes stay `tweet.read users.read`. The user token is used once and discarded.
8. **Same wallet as Hunt.** Do not change `NEXT_PUBLIC_RP_ID`, the PRF salt or the derivation in `lib/auth/derive.ts` / `lib/auth/passkey.ts` (`derive.test.ts` pins the bytes).
9. **Own database only.** Never write to another EmpowerTours project's database. Read other projects through public APIs or Monad reads.
10. **Mock mode never runs in production** (`xMode()` returns `disabled` without keys).
11. Before pushing: `npm run lint && npm run typecheck && npm test && npm run build`.
