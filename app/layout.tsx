import type { Metadata, Viewport } from "next";
import Link from "next/link";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "La Ruta · EmpowerTours", template: "%s · La Ruta" },
  description:
    "La Ruta: post about EmpowerTours on X, get on the whitelist. Every EmpowerTours project is a stop on the route. ¿Dime que sí?",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://ruta.empowertours.xyz"),
};

export const viewport: Viewport = { themeColor: "#f7f1e6", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="mx-auto max-w-3xl px-5 py-8">
          <header className="mb-8 flex items-center justify-between">
            <Link href="/" className="text-lg font-bold no-underline">La Ruta <span className="text-route">·</span> EmpowerTours</Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/guidelines">Guidelines</Link>
            </nav>
          </header>
          {children}
          <footer className="mt-16 border-t border-paper-2 pt-4 text-xs text-ink-dim">
            Monad · Ruta Points have no cash value and may count toward $TOURS; no amounts are promised. Nothing here is financial advice.
          </footer>
        </div>
      </body>
    </html>
  );
}
