// The route map. Each EmpowerTours project is a stop on La Ruta.
// "live" stops can be visited today; "locked" stops open later.

export type StopState = "live" | "soon" | "locked";

export interface Stop {
  id: string;
  name: string;
  state: StopState;
  href: string | null;
  en: string;
  es: string;
  /** Shown on locked/soon stops. */
  unlockEn?: string;
  unlockEs?: string;
}

export const STOPS: readonly Stop[] = [
  {
    id: "dime",
    name: "Dime Que Sí",
    state: "live",
    href: "https://hunt.empowertours.xyz/dime",
    en: "Claim the song as a free NFT. One tap, no seed phrase.",
    es: "Reclama la canción como NFT gratis. Un toque, sin frase semilla.",
  },
  {
    id: "hunt",
    name: "Hunt",
    state: "live",
    href: "https://hunt.empowertours.xyz",
    en: "Walk to real places. Collect drops that pay MON.",
    es: "Camina a lugares reales. Junta drops que pagan MON.",
  },
  {
    id: "music",
    name: "Music & Art",
    state: "live",
    href: "https://art.empowertours.xyz",
    en: "Artists keep 90% of every licence sale.",
    es: "Los artistas se quedan con el 90% de cada licencia.",
  },
  {
    id: "cota",
    name: "Cota",
    state: "live",
    href: "https://cota.empowertours.xyz",
    en: "Put limits on what a trading agent may do for you.",
    es: "Ponle límites a lo que un agente puede operar por ti.",
  },
  {
    id: "connect",
    name: "Connect",
    state: "soon",
    href: null,
    en: "A business network for crypto and finance on Monad.",
    es: "Una red de negocios para cripto y finanzas en Monad.",
    unlockEn: "Opening soon",
    unlockEs: "Abre pronto",
  },
  {
    id: "shardfall",
    name: "Shardfall",
    state: "locked",
    href: null,
    en: "Factions, powers and PvP on the Hunt map.",
    es: "Facciones, poderes y PvP en el mapa de Hunt.",
    unlockEn: "La Ruta members get the first beta seats",
    unlockEs: "Los miembros de La Ruta tienen los primeros lugares en la beta",
  },
  {
    id: "rumbo",
    name: "Rumbo",
    state: "locked",
    href: null,
    en: "A trip that saves itself while you play.",
    es: "Un viaje que se ahorra solo mientras juegas.",
    unlockEn: "Early access for La Ruta members",
    unlockEs: "Acceso anticipado para miembros de La Ruta",
  },
  {
    id: "tours",
    name: "$TOURS",
    state: "locked",
    href: null,
    en: "The EmpowerTours token on Monad.",
    es: "El token de EmpowerTours en Monad.",
    unlockEn: "Ruta Points may count toward $TOURS. No amounts promised.",
    unlockEs: "Los Ruta Points podrían contar para $TOURS. Sin montos prometidos.",
  },
];
