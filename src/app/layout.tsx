import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kanari — détection précoce des feux de forêt",
  description:
    "Le canari qui chante avant tout le monde : carte mondiale en temps quasi réel des départs de feu, détectés par satellite et témoignages citoyens. Service d'information indépendant.",
};

// Le kanari qui chante : corps jaune, bec et ondes crème (lisibles sur fond
// sombre), ondes animées en cascade — voir globals.css (kanari-chant).
function KanariLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle cx="36" cy="56" r="22" fill="#FFC72E" />
      <polygon points="56,50 70,56 56,62" fill="#FBF9F4" />
      <circle cx="45" cy="48" r="4" fill="#1B1C1E" />
      <path
        className="kanari-w1"
        d="M70,44.5 A14,14 0 0 1 70,67.5"
        fill="none"
        stroke="#FBF9F4"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        className="kanari-w2"
        d="M74.6,38 A22,22 0 0 1 74.6,74"
        fill="none"
        stroke="#FBF9F4"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        className="kanari-w3"
        d="M79.2,31.4 A30,30 0 0 1 79.2,80.6"
        fill="none"
        stroke="#FBF9F4"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${geist.className} flex h-dvh flex-col bg-zinc-950 text-zinc-100 antialiased`}>
        <header className="z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-2">
          <Link href="/" className="flex items-center gap-2">
            <KanariLogo className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight text-[#FFC72E]">Kanari</span>
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
