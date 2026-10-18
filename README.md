# La Ruta · EmpowerTours

A post-to-earn whitelist on X for the EmpowerTours ecosystem on Monad. Every EmpowerTours project is a stop on the route; people sign in with their EmpowerTours passkey, link X, post about a stop, and their Monad wallet goes on the whitelist.

- **Where it runs:** `ruta.empowertours.xyz` (standalone app with its own database).
- **When:** Oct 29 to Dec 10, 2026 (6 weeks).
- **Rewards:** a whitelist spot, 3 Dime Que Sí Collector Edition picks per week, and Ruta Points. Ruta Points have no cash value and may count toward $TOURS, with no amounts promised. The free Dime Que Sí claim stays on Hunt at `hunt.empowertours.xyz/dime`, and this app only links to it.

## Stack

Next.js 16 · React 19 · Prisma 6 / Postgres · Upstash Redis · viem (Monad 143) · mera passkeys · Tailwind 4 · vitest. These are the same stack and conventions as `empowertours-hunt` (see `AGENTS.md`).

## Same wallet as Hunt

The wallet is derived in the browser from the passkey: PRF → BIP-39 → `m/44'/60'/0'/0/0`. It stays identical across apps only while all of these match Hunt:

| Setting | Value |
|---|---|
| `NEXT_PUBLIC_RP_ID` | `empowertours.xyz` (a parent domain, so every `*.empowertours.xyz` subdomain can use the same passkey) |
| PRF salt | `sha256("empowertours-hunt/passkey/v1")` (`lib/auth/derive.ts`, with bytes pinned in `derive.test.ts`) |
| Credential hint cookie | `et.passkey.credential`, `domain=empowertours.xyz` (shared with Hunt) |

The session is separate from Hunt's. La Ruta signs an EIP-712 `Session` under its own domain (`EmpowerToursLaRuta`) and gets its own host-only HttpOnly cookie (`ruta_session`). A Hunt signature or cookie can never act here, and the reverse is also true. A person signs in once per app and sees the same address.

Passkeys only work on `*.empowertours.xyz` over HTTPS. A Railway `*.up.railway.app` URL will not work. `localhost` works for development, but it gives a different (local) wallet.

## Local development (no keys needed)

```bash
cp .env.example .env.local   # set DATABASE_URL and AUTH_SESSION_SECRET; NEXT_PUBLIC_RP_ID=localhost
npm install
npx prisma migrate deploy
npm run dev
```

Without X keys the app runs in **mock mode**:
- "Link X" links a deterministic `mock_<hash>` account.
- Any numeric post id can be submitted. Its last digit picks a case: 0 = no mention, 1 = before start, 2 = repost, 3 = too short, 4 = reply (flag), 5 = engagement anomaly (flag), 6 = not following, 8/9 = clean.

Mock mode is never used in production. Without keys there, X features are disabled.

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

## How verification works

1. **Submit.** The server reads the post from X and runs `verifyPost` (`lib/la-ruta/verify.ts`, pure, reject by default).
   - **Hard rejects:**
     - not the linked account;
     - posted before the start or after the end;
     - no @EmpowerTours mention (matched by user id, never by keyword, because other songs are also called "Dime Que Sí");
     - repost;
     - too short;
     - protected account;
     - not following @EmpowerTours;
     - copy of a published template;
     - duplicate of an earlier submission.
   - **Flags (sent to review):** near duplicate, new account, low followers, reply, misleading reward claim, engagement anomaly, follow not verifiable.
2. **Re-check.** A clean post becomes PENDING and is checked again after 24 h by the cron. If it was deleted or made private it is rejected. No attention, or bought-looking attention, sends it to review. Otherwise it becomes VERIFIED.
3. **Rewards.** VERIFIED gives a whitelist entry (`POST`) plus Ruta Points: 100 for the first post and 25 for each extra post. Auto-eligibility (`AUTO`) gives 50. Founding = both `AUTO` and `POST`.

## Admin

- `/admin` is open to passkey-signed-in wallets listed in `LA_RUTA_ADMIN_WALLETS`. From there an admin can:
  - see the overview and X spend;
  - work the review queue;
  - make weekly Collector picks (3 per week, 20 total, both enforced atomically);
  - export the whitelist as CSV or JSON;
  - import eligible wallets.
- **Picks never move anything on chain.** Selecting a pick only records the winner. The admin sends the Collector Edition by hand from the treasury and then pastes the tx hash ("Mark sent").
- **Reach (review agent):**
  - `GET /api/la-ruta/review-agent` lists flagged posts.
  - `POST` with `{submissionId, decision: approve|reject, reasonCode, note?}` decides one.
  - Auth is `Authorization: Bearer $LA_RUTA_REVIEW_TOKEN`.
  - Reach can act only on FLAGGED submissions. Every decision goes to the append-only `RutaReviewLog`.

## X API cost guard

X API is pay-per-use: $0.005 per post read and $0.010 per user read or follower record. Before each call, the app reserves its worst-case cost against `X_API_MONTHLY_CAP_USD` (default $150) using an atomic conditional update. At the cap, calls stop and submissions answer "paused" instead of spending more.

## Eligibility sources

| Signal | Source | Status |
|---|---|---|
| Dime Que Sí holder | LicenseRegistry `0x42Eb…9480` `licensesHeld(wallet, 13)` | live (Monad read) |
| Any licence holder | LicenseRegistry, masters 1..N | live |
| Passport holder | PassportNFT V4 `0x4D55…2410` + V3 `0x9312…1851` `balanceOf` | live |
| Music subscriber | MusicSubscriptionV6 `0xc7ED…611B` `hasActiveSubscription` | live |
| Hunt player / Cota user / TURBO member | `HUNT_ELIGIBILITY_URL` (bearer) | **stub**: Hunt has no such endpoint yet. Use the admin import meanwhile |
| Admin import | `/admin` paste list | live |

## License

AGPL-3.0-only, same as empowertours-hunt. See `LICENSE` and `NOTICE`.
