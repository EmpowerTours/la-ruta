import { STOPS, type StopState } from "@/lib/la-ruta/stops";

const BADGE: Record<StopState, { label: string; cls: string }> = {
  live: { label: "Live", cls: "bg-live text-white" },
  soon: { label: "Soon", cls: "bg-soon text-white" },
  locked: { label: "Locked", cls: "bg-locked text-white" },
};

export function RouteMap() {
  return (
    <ol className="relative ml-3 border-l-4 border-dashed border-route-dim">
      {STOPS.map((s, i) => (
        <li key={s.id} className="mb-6 ml-6">
          <span
            className={`absolute -left-[14px] flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
              s.state === "live" ? "bg-route text-white" : "bg-paper-2 text-ink-dim"
            }`}
          >
            {i + 1}
          </span>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">
              {s.href && s.state === "live" ? <a href={s.href}>{s.name}</a> : s.name}
            </h3>
            <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${BADGE[s.state].cls}`}>{BADGE[s.state].label}</span>
          </div>
          <p className="text-sm">{s.en}</p>
          <p className="text-sm text-ink-dim" lang="es">{s.es}</p>
          {s.unlockEn ? <p className="mt-1 text-xs text-ink-dim">🔒 {s.unlockEn}</p> : null}
        </li>
      ))}
    </ol>
  );
}
