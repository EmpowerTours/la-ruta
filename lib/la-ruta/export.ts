// Whitelist export (CSV / JSON). Pure.

export interface ExportRow {
  walletAddress: string;
  sources: string[];
  reasons: string[];
  xUsername: string | null;
  points: number;
  verifiedPosts: number;
  founding: boolean;
  joinedAt: Date;
}

/**
 * One CSV cell. Quotes separators, and neutralises spreadsheet formulas
 * (=, +, -, @, tab, CR) so an X handle or reason can never execute in Excel.
 */
export function csvCell(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const CSV_HEADER = [
  "wallet",
  "sources",
  "reasons",
  "x_username",
  "points",
  "verified_posts",
  "founding",
  "joined_at",
] as const;

export function toCsv(rows: readonly ExportRow[]): string {
  const lines = [CSV_HEADER.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csvCell(r.walletAddress),
        csvCell(r.sources.join("|")),
        csvCell(r.reasons.join("|")),
        csvCell(r.xUsername),
        csvCell(r.points),
        csvCell(r.verifiedPosts),
        csvCell(r.founding),
        csvCell(r.joinedAt.toISOString()),
      ].join(","),
    );
  }
  return lines.join("\n") + "\n";
}

export function toJson(rows: readonly ExportRow[], generatedAt: Date): string {
  return JSON.stringify(
    {
      campaign: "La Ruta",
      chainId: 143,
      generatedAt: generatedAt.toISOString(),
      count: rows.length,
      wallets: rows.map((r) => ({
        wallet: r.walletAddress,
        sources: r.sources,
        reasons: r.reasons,
        xUsername: r.xUsername,
        points: r.points,
        verifiedPosts: r.verifiedPosts,
        founding: r.founding,
        joinedAt: r.joinedAt.toISOString(),
      })),
    },
    null,
    2,
  );
}

/** Founding = got in through a verified post AND has earlier ecosystem activity. */
export function isFounding(sources: readonly string[]): boolean {
  return sources.includes("POST") && sources.includes("AUTO");
}
