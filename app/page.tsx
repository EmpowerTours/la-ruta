import { RouteMap } from "@/components/RouteMap";
import { RutaPanel } from "@/components/RutaPanel";
import { beforeStart as isBeforeStart, campaignConfig, dimeClaimUrl, xMode } from "@/lib/la-ruta/config";
import { POINTS_DISCLAIMER_EN } from "@/lib/la-ruta/points";

export const dynamic = "force-dynamic";

function fmt(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Mexico_City" });
}

export default function Home() {
  const cfg = campaignConfig();
  const beforeStart = isBeforeStart(cfg);
  const xOff = xMode() === "disabled";
  return (
    <main className="space-y-10">
      {beforeStart || xOff ? (
        <div className="rounded-lg border-2 border-route bg-white/70 p-4 text-sm">
          <strong>Coming soon: La Ruta opens {fmt(cfg.startsAt)}.</strong> You can sign in and check your wallet now. Post
          submissions open at launch. <span lang="es">Muy pronto: La Ruta abre el {fmt(cfg.startsAt)}.</span>
        </div>
      ) : null}
      <section>
        <p className="text-sm uppercase tracking-wide text-route">¿Dime que sí?</p>
        <h1 className="text-4xl font-black leading-tight">La Ruta</h1>
        <p className="mt-2 text-lg">
          Every EmpowerTours project is a stop on the route. Post about one on X, get your Monad wallet on the whitelist,
          and get first access to what opens next.
        </p>
        <p className="mt-1 text-ink-dim" lang="es">
          Cada proyecto de EmpowerTours es una parada en la ruta. Publica en X, entra a la whitelist y llega primero a lo que viene.
        </p>
        <p className="mt-2 text-sm text-ink-dim">
          {fmt(cfg.startsAt)} to {fmt(cfg.endsAt)} · {cfg.picksPerWeek} Collector Edition picks every week
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-bold">Join</h2>
        <RutaPanel dimeUrl={dimeClaimUrl()} />
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">The route</h2>
        <RouteMap />
      </section>

      <section className="text-sm text-ink-dim">
        <h2 className="mb-2 text-base font-bold text-ink">Ruta Points</h2>
        <p>{POINTS_DISCLAIMER_EN}</p>
      </section>
    </main>
  );
}
