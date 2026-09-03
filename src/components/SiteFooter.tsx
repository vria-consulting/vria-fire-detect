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
      { href: "/fr/methodologie", label: "Méthodologie et citation" },
      { href: "/fr/faq", label: "Questions fréquentes" },
      { href: "/fr/a-propos", label: "À propos de kanari" },
      { href: "/fr/sdis", label: "Pour les SDIS et collectivités" },
      { href: "/fr/widget", label: "Widget pour votre site" },
      { href: "/fr/confidentialite", label: "Confidentialité et cookies" },
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
      { href: "/en/methodologie", label: "Methodology and how to cite" },
      { href: "/en/a-propos", label: "About kanari" },
      { href: "/en/widget", label: "Embed widget" },
      { href: "/en/confidentialite", label: "Privacy and cookies" },
    ],
  },
];

// es/pt : liens localisés quand la page existe dans la langue (carte,
// statistiques, FAQ, guides), version anglaise pour le reste.
const ES: { title: string; items: Item[] }[] = [
  {
    title: "En vivo",
    items: [
      { href: "/es", label: "Mapa de incendios en vivo" },
      { href: "/es/canadair", label: "Aviones cisterna en vivo" },
      { href: "/es/fires", label: "Incendios por país" },
    ],
  },
  {
    title: "Datos",
    items: [
      { href: "/es/statistiques", label: "Estadísticas en tiempo real" },
      { href: "/opendata/feux.csv", label: "Datos abiertos (CSV, CC BY 4.0)" },
      { href: "/en/api", label: "API pública (JSON)" },
    ],
  },
  {
    title: "Entender",
    items: [
      { href: "/es/guide", label: "Guías sobre incendios" },
      { href: "/es/faq", label: "Preguntas frecuentes" },
      { href: "/es/methodologie", label: "Metodología y cita" },
      { href: "/en/a-propos", label: "Sobre kanari" },
      { href: "/es/widget", label: "Widget para tu sitio" },
      { href: "/en/confidentialite", label: "Privacidad y cookies" },
    ],
  },
];

const PT: { title: string; items: Item[] }[] = [
  {
    title: "Ao vivo",
    items: [
      { href: "/pt", label: "Mapa de incêndios ao vivo" },
      { href: "/pt/canadair", label: "Aviões-tanque ao vivo" },
      { href: "/pt/fires", label: "Incêndios por país" },
    ],
  },
  {
    title: "Dados",
    items: [
      { href: "/pt/statistiques", label: "Estatísticas em tempo real" },
      { href: "/opendata/feux.csv", label: "Dados abertos (CSV, CC BY 4.0)" },
      { href: "/en/api", label: "API pública (JSON)" },
    ],
  },
  {
    title: "Entender",
    items: [
      { href: "/pt/guide", label: "Guias sobre incêndios" },
      { href: "/pt/faq", label: "Perguntas frequentes" },
      { href: "/pt/methodologie", label: "Metodologia e citação" },
      { href: "/en/a-propos", label: "Sobre o kanari" },
      { href: "/pt/widget", label: "Widget para seu site" },
      { href: "/en/confidentialite", label: "Privacidade e cookies" },
    ],
  },
];

const COLS: Record<Lang, { title: string; items: Item[] }[]> = { fr: FR, en: EN, es: ES, pt: PT };

const SUPPORT: Record<Lang, string> = {
  fr: "Soutenir kanari (gratuit pour toujours, grâce à vous)",
  en: "Support kanari (free forever, thanks to you)",
  es: "Apoyar a kanari (gratis para siempre, gracias a ti)",
  pt: "Apoiar o kanari (grátis para sempre, graças a você)",
};

const TAGLINE: Record<Lang, string> = {
  fr: "kanari — le canari chante avant la sirène. Service d'information indépendant et gratuit ; en cas d'urgence : 18 ou 112.",
  en: "kanari — the canary sings before the siren. Free, independent information service; in an emergency call 112 or 911.",
  es: "kanari — el canario canta antes que la sirena. Servicio de información independiente y gratuito; en una emergencia llama al 911 o al 112.",
  pt: "kanari — o canário canta antes da sirene. Serviço de informação independente e gratuito; em emergência, ligue 193 (Brasil) ou 112 (Portugal).",
};

// Crédit auteur : qui construit kanari, avec liens vers vria-consulting.fr
// (même auteur — Vincent tient les deux sites).
const CREDIT: Record<Lang, { before: string; between: string; after: string }> = {
  fr: { before: "Un projet conçu et développé par ", between: ", fondateur de ", after: "." },
  en: { before: "Designed and built by ", between: ", founder of ", after: "." },
  es: { before: "Un proyecto diseñado y desarrollado por ", between: ", fundador de ", after: "." },
  pt: { before: "Um projeto concebido e desenvolvido por ", between: ", fundador da ", after: "." },
};

// Du même studio : une ligne discrète, en bas, dans la même couleur que le
// crédit. Les sites de l'éditeur se lient entre eux, sans rien cacher.
const STUDIO: Record<Lang, { before: string; after: string }> = {
  fr: { before: "Du même studio : ", after: ", la lecture des lignes de la main en ligne." },
  en: { before: "From the same studio: ", after: ", palm reading online." },
  es: { before: "Del mismo estudio: ", after: ", lectura de manos en línea." },
  pt: { before: "Do mesmo estúdio: ", after: ", leitura das linhas da mão online." },
};

export function SiteFooter({ lang }: { lang: Lang }) {
  const cols = COLS[lang];
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
      {/* Soutien : kanari est gratuit et le restera ; les dons financent
          l'hébergement et les données. Lien simple, aucun script tiers. */}
      <p className="mt-6">
        <a
          href="https://buymeacoffee.com/kanari"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-semibold"
          style={{ background: "var(--canary)", color: "var(--charcoal, #1B1C1E)", boxShadow: "var(--shadow-s)" }}
        >
          ☕ {SUPPORT[lang]}
        </a>
      </p>
      <p className="mt-4 text-[12px]" style={{ color: "var(--ink-3)" }}>
        {TAGLINE[lang]}
      </p>
      <p className="mt-1.5 text-[12px]" style={{ color: "var(--ink-3)" }}>
        {CREDIT[lang].before}
        <a
          href="https://ryckbosch.fr"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--link)" }}
        >
          Vincent Ryckbosch
        </a>
        {CREDIT[lang].between}
        <a
          href="https://vria-consulting.fr"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--link)" }}
        >
          VRIA Consulting
        </a>
        {CREDIT[lang].after}
      </p>
      <p className="mt-1.5 text-[12px]" style={{ color: "var(--ink-3)" }}>
        {STUDIO[lang].before}
        <a href="https://lysea.io" target="_blank" rel="noopener noreferrer" style={{ color: "var(--link)" }}>
          lysea.io
        </a>
        {STUDIO[lang].after}
      </p>
    </footer>
  );
}
