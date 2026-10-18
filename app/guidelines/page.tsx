import type { Metadata } from "next";

import { campaignConfig } from "@/lib/la-ruta/config";
import { POINTS_DISCLAIMER_EN, POINTS_DISCLAIMER_ES } from "@/lib/la-ruta/points";

export const metadata: Metadata = { title: "Post guidelines" };
export const dynamic = "force-dynamic";

export default function Guidelines() {
  const cfg = campaignConfig();
  const start = cfg.startsAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Mexico_City" });
  return (
    <main className="prose-sm space-y-6 [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc">
      <h1 className="text-3xl font-black">La Ruta · Post guidelines</h1>

      <section>
        <h2>How to earn a spot</h2>
        <ol>
          <li><strong>Sign in</strong> with your passkey. That&apos;s your EmpowerTours wallet, the same one you use in Hunt and across the ecosystem. No seed phrase.</li>
          <li><strong>Check eligibility.</strong> If you hold Dime Que Sí or another EmpowerTours NFT, a Passport, a music subscription, or you&apos;ve played Hunt, you may already be in.</li>
          <li><strong>Link your X account</strong> so we know the post is yours. We only read your public profile.</li>
          <li><strong>Follow @EmpowerTours.</strong></li>
          <li><strong>Post something original</strong> that tags <strong>@EmpowerTours</strong>. Only posts made on or after <strong>{start}</strong> count.</li>
          <li><strong>Paste the link</strong> here. We check it right away and again after {cfg.recheckHours} hours.</li>
        </ol>
      </section>

      <section>
        <h2>What counts</h2>
        <ul>
          <li>Your own words about any stop on the route: Dime Que Sí (a clip of you listening, your take on the track), a Hunt find, the music and art, Cota, Connect, why EmpowerTours matters to you.</li>
          <li>Always tag <strong>@EmpowerTours</strong>. The song title alone isn&apos;t enough, because other songs share the name.</li>
          <li>Spanish, English, or both.</li>
          <li>One verified post earns your spot. Extra posts (up to {cfg.maxSubmissionsPerDay} a day, {cfg.maxSubmissionsPerWeek} a week) earn Ruta Points.</li>
        </ul>
      </section>

      <section>
        <h2>What gets rejected</h2>
        <ul>
          <li>Copy-paste, our example prompts word for word, or AI-generated filler.</li>
          <li>Reposts. Replies go to review.</li>
          <li>Bought likes, reposts, followers or engagement pods.</li>
          <li>Several accounts, or posts from an account that isn&apos;t yours.</li>
          <li>Deleting the post or making it private before the re-check.</li>
          <li>Misleading claims about rewards, prices or tokens (for example &quot;guaranteed airdrop&quot;).</li>
        </ul>
        <p className="text-sm text-ink-dim">Some posts are sent to a review queue instead of being decided automatically (new accounts, very few followers, unusual engagement). A reviewer approves or rejects them.</p>
      </section>

      <section>
        <h2>Rewards, honestly</h2>
        <ul>
          <li><strong>La Ruta whitelist:</strong> priority access to what launches next in the EmpowerTours ecosystem.</li>
          <li><strong>Free Dime Que Sí NFT:</strong> claimed on Hunt at hunt.empowertours.xyz/dime, one per person while the free supply lasts.</li>
          <li><strong>Weekly picks:</strong> each week our {cfg.picksPerWeek} favorite posts receive a Dime Que Sí Collector Edition, for 6 weeks.</li>
          <li><strong>Ruta Points:</strong> {POINTS_DISCLAIMER_EN}</li>
        </ul>
        <p>We can change, pause or end the campaign, and we decide on fraud. Reviews are final.</p>
      </section>

      <section>
        <h2>Ideas to start from (make them yours)</h2>
        <ul>
          <li>&quot;¿Dime que sí? I said yes to ___ @EmpowerTours&quot;</li>
          <li>&quot;First time hearing Dime Que Sí on @EmpowerTours and…&quot;</li>
          <li>&quot;I walked ___ to a Hunt cache in ___ and…&quot;</li>
        </ul>
        <p className="text-sm text-ink-dim">Posting one of these unchanged is rejected.</p>
      </section>

      <section lang="es" className="border-t border-paper-2 pt-4">
        <h2>En español</h2>
        <p>Inicia sesión con tu passkey, vincula tu cuenta de X, sigue a @EmpowerTours y publica algo original que mencione a @EmpowerTours desde el {start}. Pega el enlace aquí. Lo revisamos al instante y otra vez a las {cfg.recheckHours} horas. Se rechaza: copiar y pegar, reposts, interacción comprada, varias cuentas, borrar el post antes de la revisión y promesas engañosas sobre recompensas.</p>
        <p>{POINTS_DISCLAIMER_ES}</p>
      </section>
    </main>
  );
}
