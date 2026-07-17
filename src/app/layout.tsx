import type { Metadata } from "next";
import { Fredoka, DM_Sans } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";

// Charte Kanari : Fredoka (titres) + DM Sans (corps) — jamais d'autres familles.
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-display",
});
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "kanari — l'alerte feu de forêt, avant tout le monde",
  description:
    "Le canari chante avant la sirène : carte mondiale en temps quasi réel des départs de feu, détectés par satellite et témoignages citoyens. Service d'information indépendant.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fredoka.variable} ${dmSans.variable}`}>
      <body className="flex h-dvh flex-col antialiased">
        <header
          className="z-40 flex h-16 shrink-0 items-center justify-between border-b px-4 sm:px-6"
          style={{
            background: "rgba(251,249,244,.9)",
            backdropFilter: "blur(12px)",
            borderColor: "var(--line)",
          }}
        >
          <div className="flex items-baseline gap-3.5">
            <Link href="/" className="flex items-center gap-2">
              {/* Logo officiel de la charte — ne jamais redessiner. */}
              <Image
                src="/brand/logo-symbole.svg"
                width={34}
                height={34}
                alt=""
                priority
              />
              <span
                className="text-[23px] font-medium"
                style={{
                  fontFamily: "var(--font-display)",
                  letterSpacing: "-0.5px",
                  color: "var(--ink)",
                }}
              >
                kanari
              </span>
            </Link>
            <span className="hidden text-[13px] sm:inline" style={{ color: "var(--ink-3)" }}>
              l&apos;alerte feu de forêt, avant tout le monde
            </span>
          </div>
          <nav className="flex items-center gap-5">
            <Link
              href="/a-propos#comment"
              className="hidden text-sm font-medium sm:inline"
              style={{ color: "var(--ink)" }}
            >
              Comment ça marche
            </Link>
            <Link
              href="/a-propos"
              className="hidden text-sm font-medium sm:inline"
              style={{ color: "var(--ink)" }}
            >
              À propos
            </Link>
            <a
              href="tel:112"
              className="flex h-[38px] items-center rounded-full px-[18px] text-sm font-medium text-white transition-colors"
              style={{ background: "var(--ember)" }}
            >
              Urgence ? 112
            </a>
          </nav>
        </header>
        <main className="min-h-0 flex-1">{children}</main>
      </body>
    </html>
  );
}
