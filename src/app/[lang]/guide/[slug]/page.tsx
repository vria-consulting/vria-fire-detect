import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidLang, type Lang, localize } from "@/lib/i18n";
import { GUIDES, GUIDE_BY_SLUG, type Guide } from "@/lib/guides";
import { GUIDES_EN, GUIDE_EN_BY_SLUG } from "@/lib/guides-en";
import { countFires } from "@/lib/firearchive";
import { Adsense } from "@/components/Adsense";
import { SiteFooter } from "@/components/SiteFooter";

// Équipement pertinent par guide (liens partenaires Amazon, FR uniquement) :
// uniquement là où la recommandation est légitime pour le lecteur, avec la
// mention légale du Club Partenaires. Jamais sur les guides sans produit
// naturellement utile.
const AFFILIATE_TAG = "kanari-21";
const AFFILIATE: Record<string, { q: string; label: string }[]> = {
  "que-faire-feu-de-foret": [
    { q: "detecteur de fumee NF", label: "Détecteur de fumée (obligatoire dans chaque logement)" },
    { q: "radio portable piles urgence", label: "Radio à piles (suivre les consignes si le réseau tombe)" },
    { q: "lampe frontale rechargeable", label: "Lampe frontale" },
  ],
  "meteo-des-forets": [
    { q: "station meteo exterieure vent", label: "Station météo avec anémomètre" },
    { q: "hygrometre thermometre exterieur", label: "Thermomètre-hygromètre extérieur" },
  ],
  "odeur-de-fumee-que-faire": [
    { q: "purificateur air filtre HEPA", label: "Purificateur d'air à filtre HEPA (fumées et particules)" },
    { q: "masque FFP2", label: "Masques FFP2 (personnes sensibles)" },
    { q: "detecteur de fumee NF", label: "Détecteur de fumée" },
  ],
};

// Guides évergreens, rendus dynamiques depuis le 13/08 : chaque guide ouvre
// sur un bloc CITABLE daté aux compteurs live (stats attribuées en début de
// page = le motif le plus repris par les moteurs de réponse IA). countFires
// est no-store, incompatible avec un shell statique.
// Servis en FR et en EN sur les mêmes slugs (hreflang), contenu EN adapté
// à l'international dans guides-en.ts.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function guideFor(lang: Lang, slug: string): Guide | undefined {
  return lang === "fr" ? GUIDE_BY_SLUG.get(slug) : GUIDE_EN_BY_SLUG.get(slug);
}

const UI = {
  fr: {
    guides: "Guides",
    updatedOn: "mis à jour le",
    faqTitle: "Questions fréquentes",
    liveTitle: "Voir la situation en direct :",
    liveLinks: [
      { href: "/fr", label: "carte mondiale des feux" },
      { href: "/fr/feux", label: "feux par département" },
      { href: "/fr/canadair", label: "Canadair en direct" },
    ],
    also: "À lire aussi",
    disclaimer:
      "kanari est un service d'information indépendant et gratuit, pas un canal d'alerte officiel. En cas d'urgence : 18 ou 112.",
    citable: (today: string, total: number, france: number | null) =>
      `Au ${today}, kanari a archivé ${total.toLocaleString("fr-FR")} feux significatifs détectés par satellite dans le monde depuis le 3 août 2026${france !== null && france > 0 ? `, dont ${france.toLocaleString("fr-FR")} en France` : ""}. Source : kanari.io, données ouvertes (CC BY 4.0).`,
  },
  en: {
    guides: "Guides",
    updatedOn: "updated",
    faqTitle: "Frequently asked questions",
    liveTitle: "See the live situation:",
    liveLinks: [
      { href: "/en", label: "world wildfire map" },
      { href: "/en/canadair", label: "water bombers live" },
      { href: "/en/statistiques", label: "live statistics" },
    ],
    also: "Also worth reading",
    disclaimer:
      "kanari is an independent, free information service, not an official alert channel. In an emergency call 112 (EU), 911 (North America) or your local emergency number.",
    citable: (today: string, total: number, france: number | null) =>
      `As of ${today}, kanari has archived ${total.toLocaleString("en-US")} significant satellite-detected fires worldwide since August 3, 2026${france !== null && france > 0 ? `, including ${france.toLocaleString("en-US")} in France` : ""}. Source: kanari.io, open data (CC BY 4.0).`,
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  const l: Lang = isValidLang(lang) ? lang : "fr";
  const g = guideFor(l, slug);
  if (!g) return {};
  const ogImg = `https://kanari.io/guides/${g.slug}.png`;
  return {
    title: g.metaTitle,
    description: g.metaDesc,
    alternates: {
      canonical: `/${l === "fr" ? "fr" : "en"}/guide/${g.slug}`,
      languages: { fr: `/fr/guide/${g.slug}`, en: `/en/guide/${g.slug}` },
    },
    openGraph: {
      type: "article",
      title: g.metaTitle,
      images: [{ url: ogImg, width: 1200, height: 630, alt: g.imageAlt ?? g.title }],
    },
    twitter: { card: "summary_large_image", images: [ogImg] },
  };
}

export default async function GuidePage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!isValidLang(lang)) notFound();
  const g = guideFor(lang, slug);
  if (!g) notFound();
  const ui = localize(UI, lang);
  const locale = lang === "fr" ? "fr-FR" : "en-GB";

  // Chiffres live pour le bloc citable (échec silencieux : bloc masqué).
  const [total, france] = await Promise.all([
    countFires("first_seen=gte.2026-08-03"),
    countFires("country=eq.FR"),
  ]);
  const today = new Date().toLocaleDateString(locale, {
    day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris",
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: g.title,
    description: g.metaDesc,
    image: [`https://kanari.io/guides/${g.slug}.png`],
    dateModified: g.updated,
    inLanguage: lang,
    author: { "@type": "Organization", name: "kanari", url: "https://kanari.io" },
    publisher: { "@id": "https://kanari.io/#org" },
    mainEntityOfPage: `https://kanari.io/${lang}/guide/${g.slug}`,
  };
  const faqLd =
    g.faq && g.faq.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: g.faq.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;

  const others = (lang === "fr" ? GUIDES : GUIDES_EN).filter((x) => x.slug !== g.slug);
  const affiliate = lang === "fr" ? AFFILIATE[g.slug] : undefined;

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <Adsense />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {faqLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      )}
      <article className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <p className="mb-1 text-[13px]" style={{ color: "var(--ink-3)" }}>
          <Link href={`/${lang}/guide`} style={{ color: "var(--link)" }}>{ui.guides}</Link> · {ui.updatedOn}{" "}
          {new Date(g.updated).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })}
        </p>
        <h1 className="mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          {g.title}
        </h1>
        <p className="mb-4 text-[15.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {g.intro}
        </p>
        {/* Schéma illustratif (SVG net à l'écran, PNG pour l'OG/JSON-LD) :
            le multimédia en page pèse lourd dans les réponses IA (+156 %
            mesurés côté AI Overviews vs texte seul). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/guides/${g.slug}.svg`}
          alt={g.imageAlt ?? g.title}
          width={1200}
          height={630}
          className="mb-5 w-full rounded-[18px]"
          style={{ boxShadow: "var(--shadow-s)", background: "var(--white)" }}
        />
        {/* Bloc citable daté, dans le premier tiers de la page : stat
            attribuée + source — le motif que les moteurs de réponse IA
            reprennent le plus volontiers. */}
        {total !== null && total > 0 && (
          <blockquote
            className="mb-7 border-l-4 py-1 pl-4 text-[14px] leading-relaxed"
            style={{ borderColor: "var(--canary)", color: "var(--ink)" }}
          >
            {ui.citable(today, total, france)}
          </blockquote>
        )}
        {g.sections.map((s) => (
          <section key={s.h2} className="mb-7">
            <h2 className="mb-2.5 text-[20px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
              {s.h2}
            </h2>
            {s.paras.map((p, i) => (
              <p key={i} className="mb-3 text-[14.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                {p}
              </p>
            ))}
          </section>
        ))}

        {g.faq && g.faq.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-[20px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
              {ui.faqTitle}
            </h2>
            <div className="flex flex-col gap-3">
              {g.faq.map((f) => (
                <div key={f.q} className="rounded-[16px] px-5 py-4" style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}>
                  <h3 className="mb-1 text-[15px] font-semibold" style={{ color: "var(--ink)" }}>{f.q}</h3>
                  <p className="text-[14px] leading-relaxed" style={{ color: "var(--ink-2)" }}>{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {affiliate && (
          <section className="mb-8">
            <h2 className="mb-2 text-[17px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
              S&apos;équiper
            </h2>
            <ul className="mb-2 flex flex-col gap-1.5 text-[14px]" style={{ color: "var(--ink-2)", paddingLeft: 18, listStyle: "disc" }}>
              {affiliate.map((a) => (
                <li key={a.q}>
                  <a
                    href={`https://www.amazon.fr/s?k=${encodeURIComponent(a.q)}&tag=${AFFILIATE_TAG}`}
                    target="_blank"
                    rel="noopener noreferrer sponsored"
                    style={{ color: "var(--link)" }}
                  >
                    {a.label}
                  </a>
                </li>
              ))}
            </ul>
            <p className="text-[11.5px]" style={{ color: "var(--ink-3)" }}>
              Liens partenaires : en tant que Partenaire Amazon, kanari réalise un bénéfice sur les
              achats remplissant les conditions requises. Cela finance le service, qui reste gratuit.
            </p>
          </section>
        )}

        <div
          className="mb-8 rounded-[18px] p-5"
          style={{ background: "var(--canary-tint)" }}
        >
          <p className="text-[14.5px] leading-relaxed" style={{ color: "var(--ink)" }}>
            <strong>{ui.liveTitle}</strong>{" "}
            {ui.liveLinks.map((l, i) => (
              <span key={l.href}>
                {i > 0 && " · "}
                <Link href={l.href} style={{ color: "var(--link)" }}>{l.label}</Link>
              </span>
            ))}
          </p>
        </div>

        <section className="mb-4">
          <h2 className="mb-2 text-[15px] font-semibold" style={{ color: "var(--ink)" }}>{ui.also}</h2>
          <p className="flex flex-col gap-1 text-[14px]">
            {others.map((o) => (
              <Link key={o.slug} href={`/${lang}/guide/${o.slug}`} style={{ color: "var(--link)" }}>
                {o.title}
              </Link>
            ))}
          </p>
        </section>

        <p className="mt-8 border-t pt-4 text-[12.5px]" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
          {ui.disclaimer}
        </p>
        <SiteFooter lang={lang} />
      </article>
    </div>
  );
}
