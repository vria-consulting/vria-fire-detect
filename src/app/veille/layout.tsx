import type { Metadata } from "next";
import { Fredoka, DM_Sans } from "next/font/google";
import "../globals.css";

// Root layout autonome (hors [lang]) : espace privé de veille, non localisé,
// sans le header public. Non indexé, non référencé.
const fredoka = Fredoka({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-display" });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Veille kanari",
  robots: { index: false, follow: false, nocache: true },
};

export default function VeilleLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fredoka.variable} ${dmSans.variable}`}>
      <body className="antialiased" style={{ background: "var(--surface-page)", minHeight: "100dvh" }}>
        {children}
      </body>
    </html>
  );
}
