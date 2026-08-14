import Link from "next/link";
import type { Lang } from "@/lib/i18n";

// Pied de page des pages de contenu : le maillage interne qui relie chaque
// page au reste du site (hub feux, mémoire, observatoire…). La home carte,
// plein écran, passe par le menu « Explorer » du header à la place.

type Item = { href: string; label: string };

const FR: { title: string; items: Item[] }[] = [
  {
    title: "En direct",
    items: [
      { href: "/fr", label: "Carte des feux en direct" },
      { href: "/fr/feux-en-cours", label: "Incendies en cours (liste live)" },
      { href: "/fr/canadair", label: "Canadair et bombardiers d'eau" },
      { href: "/fr/feux", label: "Feux par département" },
      { href: "/fr/statistiques", label: "Observatoire et statistiques" },
    ],
  },
  {
    title: "Mémoire des feux",
    items: [
      { href: "/fr/feu", label: "Historique feu par feu" },
      { href: "/fr/bilan", label: "Bilans quotidiens" },
      { href: "/opendata/feux.csv", label: "Open data (CSV, CC BY 4.0)" },
      { href: "/fr/api", label: "API publique (JSON)" },
      { href: "/feed.xml", label: "Flux RSS des feux" },
    ],
  },
  {
    title: "Comprendre",
    items: [
      { href: "/fr/guide", label: "Guides feux de forêt" },
      { href: "/fr/comparatif", label: "Comparatif des cartes de feux" },
      { href: "/fr/precocite", label: "Précocité mesurée" },
      { href: "/fr/faq", label: "Questions fréquentes" },
      { href: "/fr/a-propos", label: "À propos de kanari" },
      { href: "/fr/sdis", label: "Pour les SDIS et collectivités" },
      { href: "/fr/widget", label: "Widget pour votre site" },
    ],
  },
];

const EN: { title: string; items: Item[] }[] = [
  {
    title: "Live",
    items: [
      { href: "/en", label: "Live wildfire map" },
      { href: "/en/canadair", label: "Water bombers live" },
      { href: "/en/fires", label: "Wildfires by country" },
    ],
  },
  {
    title: "Data",
    items: [
      { href: "/en/statistiques", label: "Wildfire statistics (live)" },
      { href: "/opendata/feux.csv", label: "Open data (CSV, CC BY 4.0)" },
      { href: "/en/api", label: "Public API (JSON)" },
      { href: "/feed.xml", label: "RSS feed" },
    ],
  },
  {
    title: "About",
    items: [
      { href: "/en/guide", label: "Wildfire guides" },
      { href: "/en/faq", label: "FAQ" },
      { href: "/en/comparatif", label: "Wildfire maps compared" },
      { href: "/en/a-propos", label: "About kanari" },
      { href: "/fr/widget", label: "Embed widget" },
    ],
  },
];

export function SiteFooter({ lang }: { lang: Lang }) {
  const cols = lang === "fr" ? FR : EN;
  return (
    <footer className="mt-10 border-t pt-8 pb-4" style={{ borderColor: "var(--line)" }}>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {cols.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
              {col.title}
            </h2>
            <ul className="flex flex-col gap-1.5 text-[14px]">
              {col.items.map((it) => (
                <li key={it.href}>
                  <Link href={it.href} style={{ color: "var(--link)" }}>
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p className="mt-6 text-[12px]" style={{ color: "var(--ink-3)" }}>
        {lang === "fr"
          ? "kanari — le canari chante avant la sirène. Service d'information indépendant et gratuit ; en cas d'urgence : 18 ou 112."
          : "kanari — the canary sings before the siren. Free, independent information service; in an emergency call 112 or 911."}
      </p>
    </footer>
  );
}
