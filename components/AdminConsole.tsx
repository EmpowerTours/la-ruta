"use client";

import { useCallback, useEffect, useState } from "react";

import { REVIEW_REASON_CODES } from "@/lib/la-ruta/review";

type Json = Record<string, unknown>;

interface Flagged {
  id: string;
  postUrl: string;
  text: string;
  flags: string[];
  week: number;
  player: { walletAddress: string; xLink: { username: string } | null };
}

interface Candidate {
  id: string;
  postUrl: string;
  text: string;
  player: { walletAddress: string; xLink: { username: string } | null };
  pick: { id: string; status: string } | null;
}

interface Pick {
  id: string;
  week: number;
  walletAddress: string;
  status: string;
  txHash: string | null;
}

async function post(url: string, body: Json) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const b = (await r.json().catch(() => ({}))) as Json;
  if (!r.ok) throw new Error(String(b.error ?? r.status));
  return b;
}

export function AdminConsole() {
  const [overview, setOverview] = useState<Json | null>(null);
  const [denied, setDenied] = useState(false);
  const [flagged, setFlagged] = useState<Flagged[]>([]);
  const [week, setWeek] = useState<number | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [reason, setReason] = useState<Record<string, string>>({});
  const [importText, setImportText] = useState("");
  const [importReason, setImportReason] = useState("hunt_player");

  const load = useCallback(async (w?: number) => {
    const o = await fetch("/api/admin/overview", { cache: "no-store" });
    if (!o.ok) {
      setDenied(true);
      return;
    }
    setOverview(await o.json());
    const r = await (await fetch("/api/admin/review", { cache: "no-store" })).json();
    setFlagged(r.flagged ?? []);
    const p = await (await fetch(`/api/admin/picks${w ? `?week=${w}` : ""}`, { cache: "no-store" })).json();
    setWeek(p.week);
    setCandidates(p.candidates ?? []);
    setPicks(p.picks ?? []);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [load]);

  async function act(fn: () => Promise<unknown>, ok: string) {
    setMsg(null);
    try {
      await fn();
      setMsg(ok);
      await load(week ?? undefined);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "failed");
    }
  }

  if (denied) return <p>Sign in on the home page with an admin wallet (LA_RUTA_ADMIN_WALLETS).</p>;
  if (!overview) return <p>Loading…</p>;

  return (
    <main className="space-y-8 text-sm">
      <h1 className="text-2xl font-black">La Ruta admin</h1>
      {msg ? <p className="text-route">{msg}</p> : null}

      <section>
        <h2 className="mb-2 text-lg font-bold">Overview</h2>
        <pre className="overflow-x-auto rounded bg-white/60 p-3 text-xs">{JSON.stringify(overview, null, 2)}</pre>
        <div className="mt-2 flex gap-3">
          <a href="/api/admin/export?format=csv">Export CSV</a>
          <a href="/api/admin/export?format=json">Export JSON</a>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Review queue ({flagged.length})</h2>
        {flagged.map((s) => (
          <div key={s.id} className="mb-3 rounded bg-white/60 p-3">
            <p>
              <a href={s.postUrl} target="_blank" rel="noreferrer">@{s.player.xLink?.username ?? "?"}</a> · week {s.week} · flags: {s.flags.join(", ")}
            </p>
            <p className="my-1 whitespace-pre-wrap text-ink-dim">{s.text}</p>
            <div className="flex flex-wrap items-center gap-2">
              <button className="rounded bg-live px-2 py-1 text-white" onClick={() => act(() => post("/api/admin/review", { submissionId: s.id, decision: "approve", reasonCode: "ORIGINAL_OK" }), "approved")}>
                Approve
              </button>
              <select value={reason[s.id] ?? "LOW_EFFORT"} onChange={(e) => setReason({ ...reason, [s.id]: e.target.value })} className="rounded border px-1 py-1">
                {REVIEW_REASON_CODES.filter((c) => c !== "ORIGINAL_OK").map((c) => <option key={c}>{c}</option>)}
              </select>
              <button className="rounded bg-route px-2 py-1 text-white" onClick={() => act(() => post("/api/admin/review", { submissionId: s.id, decision: "reject", reasonCode: reason[s.id] ?? "LOW_EFFORT" }), "rejected")}>
                Reject
              </button>
            </div>
          </div>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Collector Edition picks · week {week}</h2>
        <p className="mb-2 text-ink-dim">
          Selecting records a winner only. Send the Collector Edition yourself from the treasury wallet, then paste the tx hash here. Nothing is sent from this app.
        </p>
        <div className="mb-2 flex gap-2">
          {[1, 2, 3, 4, 5, 6].map((w) => (
            <button key={w} className={`rounded border px-2 ${w === week ? "bg-ink text-paper" : ""}`} onClick={() => load(w)}>W{w}</button>
          ))}
        </div>
        {candidates.map((c) => (
          <div key={c.id} className="mb-2 rounded bg-white/60 p-2">
            <a href={c.postUrl} target="_blank" rel="noreferrer">@{c.player.xLink?.username ?? "?"}</a>{" "}
            <span className="text-ink-dim">{c.text.slice(0, 140)}</span>{" "}
            {c.pick && c.pick.status !== "CANCELLED" ? (
              <strong>{c.pick.status}</strong>
            ) : (
              <button className="rounded border px-2" onClick={() => act(() => post("/api/admin/picks", { action: "select", submissionId: c.id }), "selected")}>Select</button>
            )}
          </div>
        ))}
        <h3 className="mt-4 font-semibold">All picks</h3>
        <table className="w-full text-xs">
          <tbody>
            {picks.map((p) => (
              <tr key={p.id} className="border-t">
                <td>W{p.week}</td>
                <td><code>{p.walletAddress}</code></td>
                <td>{p.status}</td>
                <td>
                  {p.status === "SELECTED" ? (
                    <>
                      <button className="mr-2 underline" onClick={() => {
                        const tx = window.prompt("Tx hash of the transfer you made by hand:");
                        if (tx) void act(() => post("/api/admin/picks", { action: "sent", pickId: p.id, txHash: tx.trim() }), "marked sent");
                      }}>Mark sent</button>
                      <button className="underline" onClick={() => act(() => post("/api/admin/picks", { action: "cancel", pickId: p.id }), "cancelled")}>Cancel</button>
                    </>
                  ) : p.txHash ? <a href={`https://monadscan.com/tx/${p.txHash}`} target="_blank" rel="noreferrer">tx</a> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold">Import eligible wallets</h2>
        <p className="mb-1 text-ink-dim">Paste wallets (one per line) exported from another project, e.g. Hunt players.</p>
        <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={4} className="w-full rounded border p-2 font-mono text-xs" />
        <div className="mt-1 flex gap-2">
          <input value={importReason} onChange={(e) => setImportReason(e.target.value)} className="rounded border px-2" />
          <button className="rounded bg-ink px-2 py-1 text-paper" onClick={() => act(() => post("/api/admin/eligible-import", {
            wallets: importText.split(/\s+/).filter(Boolean),
            reason: importReason,
          }), "imported")}>Import</button>
        </div>
      </section>
    </main>
  );
}
