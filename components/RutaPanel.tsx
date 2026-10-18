"use client";

import { useCallback, useEffect, useState } from "react";

import { explainPasskeyError } from "@/lib/auth/passkey";
import { passkeySignIn, signOut } from "@/lib/auth/signIn";

interface Me {
  walletAddress: string;
  suspended: boolean;
  x: { username: string; mock: boolean } | null;
  xMode: "live" | "mock" | "disabled";
  whitelisted: boolean;
  sources: string[];
  reasons: string[];
  founding: boolean;
  points: number;
  collectorPick: { week: number; status: string } | null;
  submissions: Array<{ id: string; postUrl: string; status: string; reasons: string[]; flags: string[]; createdAt: string; recheckAt: string | null }>;
  campaign: { startsAt: string; endsAt: string; week: number };
}

const REASON_TEXT: Record<string, string> = {
  not_owner: "The post isn't from your linked X account.",
  before_start: "Posted before La Ruta started.",
  after_end: "Posted after La Ruta ended.",
  no_mention: "Mention @EmpowerTours in the post.",
  not_following: "Follow @EmpowerTours, then submit the same link again.",
  repost: "Reposts don't count. Write your own post.",
  too_short: "Write a little more in your own words.",
  protected_account: "Your posts are protected. Make the post public.",
  template_copy: "That's our example text. Say it your way.",
  duplicate: "That text was already submitted.",
  deleted: "The post was deleted or made private before the re-check.",
};

const STATUS_TEXT: Record<string, string> = {
  PENDING: "Checking. We re-check after 24 hours.",
  FLAGGED: "In review. A reviewer will decide soon.",
  VERIFIED: "Verified ✓",
  REJECTED: "Not accepted",
};

const X_RESULT: Record<string, string> = {
  linked: "X account linked.",
  taken: "That X account is already linked to another wallet.",
  already: "This wallet already has a different X account linked.",
  cancelled: "X linking was cancelled.",
  expired: "The X link expired. Try again.",
  disabled: "X linking isn't switched on yet.",
  signin: "Sign in first.",
  error: "Something went wrong linking X.",
};

function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function RutaPanel({ dimeUrl }: { dimeUrl: string }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [elig, setElig] = useState<{ eligible: boolean; reasons: string[]; unknown: string[] } | null>(null);
  const [dime, setDime] = useState<{ remaining: number | null; open: boolean | null } | null>(null);

  const fetchMe = useCallback(async (): Promise<Me | null> => {
    const res = await fetch("/api/la-ruta/me", { cache: "no-store" });
    return res.ok ? ((await res.json()) as Me) : null;
  }, []);

  const load = useCallback(async () => {
    setMe(await fetchMe());
    setLoading(false);
  }, [fetchMe]);

  useEffect(() => {
    let alive = true;
    const q = new URLSearchParams(window.location.search).get("x");
    fetchMe().then((m) => {
      if (!alive) return;
      setMe(m);
      setLoading(false);
      if (q) setMsg(X_RESULT[q] ?? null);
    });
    fetch("/api/la-ruta/dime")
      .then((r) => r.json())
      .then((d) => alive && setDime(d))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [fetchMe]);

  async function doSignIn(mode: "existing" | "new") {
    setBusy(true);
    setMsg(null);
    try {
      await passkeySignIn(mode);
      await load();
    } catch (e) {
      setMsg(explainPasskeyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function checkEligibility() {
    setBusy(true);
    try {
      const r = await fetch("/api/la-ruta/eligibility", { method: "POST" });
      setElig(r.ok ? await r.json() : null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/la-ruta/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const b = await r.json();
      if (!r.ok) setMsg(b.error ?? "Could not submit.");
      else {
        setUrl("");
        setMsg(b.status === "REJECTED" ? (b.reasons as string[]).map((x) => REASON_TEXT[x] ?? x).join(" ") : STATUS_TEXT[b.status]);
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  const dimeBox = (
    <div className="rounded-lg border-2 border-route bg-white/60 p-4">
      <h3 className="font-semibold">Free stop: Dime Que Sí</h3>
      <p className="text-sm">Claim the song as a free NFT on Hunt. It takes one tap.</p>
      {dime?.remaining != null ? <p className="text-xs text-ink-dim">Current remaining free claims: {dime.remaining}</p> : null}
      <a className="mt-2 inline-block rounded bg-route px-3 py-1.5 text-sm font-semibold text-white no-underline" href={dimeUrl}>
        Claim on Hunt →
      </a>
    </div>
  );

  if (loading) return <p className="text-ink-dim">Loading…</p>;

  if (!me) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-white/60 p-4">
          <h3 className="font-semibold">1 · Sign in with your EmpowerTours passkey</h3>
          <p className="text-sm text-ink-dim">Same passkey, same wallet as Hunt. No seed phrase, no app.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => doSignIn("existing")} className="rounded bg-ink px-3 py-1.5 text-sm text-paper disabled:opacity-50">
              Sign in
            </button>
            <button disabled={busy} onClick={() => doSignIn("new")} className="rounded border border-ink px-3 py-1.5 text-sm disabled:opacity-50">
              I&apos;m new: create a passkey
            </button>
          </div>
        </div>
        {msg ? <p className="text-sm text-route">{msg}</p> : null}
        {dimeBox}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-lg bg-white/60 p-4">
        <div>
          <p className="text-sm">Wallet <code>{short(me.walletAddress)}</code></p>
          <p className="text-sm">
            {me.whitelisted ? <strong className="text-live">On the whitelist{me.founding ? " · Founding" : ""}</strong> : "Not on the whitelist yet"}
            {" · "}
            {me.points} Ruta Points
          </p>
          {me.collectorPick ? <p className="text-sm font-semibold text-route">Collector Edition pick · week {me.collectorPick.week}</p> : null}
        </div>
        <button className="text-xs underline" onClick={async () => { await signOut(); setMe(null); }}>Sign out</button>
      </div>

      {msg ? <p className="text-sm text-route">{msg}</p> : null}

      <div className="rounded-lg bg-white/60 p-4">
        <h3 className="font-semibold">2 · Already part of EmpowerTours?</h3>
        <p className="text-sm text-ink-dim">Dime Que Sí or other licence holders, Passport holders, subscribers and Hunt players get in automatically.</p>
        <button disabled={busy} onClick={checkEligibility} className="mt-2 rounded border border-ink px-3 py-1.5 text-sm disabled:opacity-50">Check my wallet</button>
        {elig ? (
          <p className="mt-2 text-sm">
            {elig.eligible ? `You're in: ${elig.reasons.join(", ")}.` : "Nothing found yet. Post on X below to join."}
          </p>
        ) : null}
      </div>

      <div className="rounded-lg bg-white/60 p-4">
        <h3 className="font-semibold">3 · Link your X account</h3>
        {me.x ? (
          <p className="text-sm">Linked: @{me.x.username}{me.x.mock ? " (dev mock)" : ""}</p>
        ) : me.xMode === "disabled" ? (
          <p className="text-sm text-ink-dim">X linking opens when La Ruta starts.</p>
        ) : (
          <a href="/api/la-ruta/x/connect" className="mt-2 inline-block rounded bg-ink px-3 py-1.5 text-sm text-paper no-underline">
            {me.xMode === "mock" ? "Link a mock X account (dev)" : "Link X"}
          </a>
        )}
        <p className="mt-1 text-xs text-ink-dim">We only read your public profile. We never post or follow for you.</p>
      </div>

      <div className="rounded-lg bg-white/60 p-4">
        <h3 className="font-semibold">4 · Post on X, then paste the link</h3>
        <p className="text-sm text-ink-dim">
          Mention @EmpowerTours, follow @EmpowerTours, and say something real about a stop on the route. Read the <a href="/guidelines">guidelines</a>.
        </p>
        <div className="mt-2 flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://x.com/you/status/…"
            className="w-full rounded border border-ink-dim bg-white px-2 py-1.5 text-sm"
            disabled={!me.x || busy}
          />
          <button disabled={!me.x || busy || !url} onClick={submit} className="rounded bg-route px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            Submit
          </button>
        </div>
        {me.submissions.length ? (
          <ul className="mt-3 space-y-2 text-sm">
            {me.submissions.map((s) => (
              <li key={s.id} className="border-t border-paper-2 pt-2">
                <a href={s.postUrl} target="_blank" rel="noreferrer">post</a> · {STATUS_TEXT[s.status] ?? s.status}
                {s.status === "REJECTED" && s.reasons.length ? (
                  <span className="block text-xs text-ink-dim">{s.reasons.map((r) => REASON_TEXT[r] ?? r).join(" ")}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {dimeBox}
    </div>
  );
}
