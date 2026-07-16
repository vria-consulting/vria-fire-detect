import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "VigiFire — détection précoce des feux de forêt",
  description:
    "Carte mondiale en temps quasi réel des départs de feu détectés par satellite (NASA FIRMS / VIIRS). Service d'information indépendant.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${geist.className} flex h-dvh flex-col bg-zinc-950 text-zinc-100 antialiased`}>
        <header className="z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-2">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="text-lg font-bold tracking-tight">
              <span className="text-orange-500">Vigi</span>Fire
            </span>
            <span className="hidden text-xs text-zinc-500 sm:inline">
              détection précoce des feux de forêt
            </span>
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/a-propos" className="text-zinc-400 hover:text-zinc-100">
              À propos
            </Link>
            <span className="rounded-md bg-red-950 px-2 py-1 text-xs font-medium text-red-300">
              Urgence ? Appelez le 112
            </span>
          </nav>
        </header>
        <main className="min-h-0 flex-1">{children}</main>
      </body>
    </html>
  );
}
