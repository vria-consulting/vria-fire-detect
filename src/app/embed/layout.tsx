import type { Metadata } from "next";
import { Fredoka, DM_Sans } from "next/font/google";
import "../globals.css";

// Root layout autonome du widget intégrable : la carte seule, sans header —
// pensé pour l'iframe des médias et collectivités. Non indexé (la valeur SEO
// est le backlink vers kanari.io, pas la page embed elle-même).
const fredoka = Fredoka({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-display" });
const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "700"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "kanari — carte des feux intégrable",
  robots: { index: false, follow: true },
};

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${fredoka.variable} ${dmSans.variable}`}>
      <body className="h-dvh overflow-hidden antialiased">{children}</body>
    </html>
  );
}
