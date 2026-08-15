import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidLang, localize, type Lang } from "@/lib/i18n";
import { WidgetBuilder } from "@/components/WidgetBuilder";
import { SiteFooter } from "@/components/SiteFooter";

// Page « intégrer la carte » pour médias, mairies, sites météo : le widget
// gratuit contre un lien d'attribution — la machine à backlinks. v2 : un
// générateur par zone (département, pays, monde) en 4 langues — une rédaction
// locale repart avec SA carte en 20 secondes.
const T = {
  fr: {
    metaTitle: "Intégrer la carte des feux kanari sur votre site (widget gratuit)",
    metaDesc:
      "Médias, mairies, sites météo : intégrez gratuitement la carte des feux en temps réel de kanari, centrée sur votre département ou votre pays. Générateur de code, 4 langues, mise à jour continue.",
    h1: "Intégrez la carte des feux sur votre site",
    intro:
      "Média, mairie, site météo, blog : la carte kanari (feux en temps réel, Canadair en direct, fumée) est intégrable gratuitement, centrée sur la zone de votre choix. Une seule condition : conserver le lien d'attribution vers kanari.io.",
    pressTitle: "Pour les rédactions",
    press: [
      "Le widget est libre d'utilisation dans vos articles et pages en direct, y compris en couverture d'un incendie en cours.",
      "Les chiffres de kanari (feux actifs, détections, chronologies) sont citables librement : données ouvertes CC BY 4.0, mention « kanari.io ».",
      "Besoin d'une carte sur mesure, d'un export, d'un commentaire ou d'une chronologie précise pendant un épisode : contact@kanari.io — réponse rapide en période de feux.",
    ],
    faqTitle: "Questions fréquentes",
    faq: [
      {
        q: "Le widget est-il vraiment gratuit ?",
        a: "Oui, sans limite de trafic ni de durée. La seule condition est l'attribution : le lien vers kanari.io sous la carte.",
      },
      {
        q: "Puis-je centrer la carte sur ma commune ?",
        a: "Le générateur propose les départements et les pays. Pour un centrage plus fin, ajustez les paramètres lat, lon et z de l'URL de l'iframe : la carte les accepte librement.",
      },
      {
        q: "Les données sont-elles à jour pendant un incendie ?",
        a: "La carte embarquée est la même que kanari.io : détections satellite rafraîchies en continu (toutes les 10 minutes pour les satellites géostationnaires), avions en vol, signalements vérifiés.",
      },
    ],
  },
  en: {
    metaTitle: "Embed the kanari wildfire map on your site (free widget)",
    metaDesc:
      "Newsrooms, municipalities, weather sites: embed kanari's real-time wildfire map for free, centered on your country or area. Code generator, 4 languages, continuously updated.",
    h1: "Embed the wildfire map on your site",
    intro:
      "Newsroom, municipality, weather site, blog: the kanari map (real-time fires, water bombers, smoke) can be embedded for free, centered on the area of your choice. One condition: keep the attribution link to kanari.io.",
    pressTitle: "For newsrooms",
    press: [
      "The widget is free to use in your articles and live pages, including live coverage of an ongoing wildfire.",
      "kanari's figures (active fires, detections, timelines) are freely quotable: open data CC BY 4.0, attribution “kanari.io”.",
      "Need a custom map, an export, a quote or a precise timeline during an event: contact@kanari.io — fast replies during fire season.",
    ],
    faqTitle: "Frequently asked questions",
    faq: [
      {
        q: "Is the widget really free?",
        a: "Yes, with no traffic or time limit. The only condition is attribution: the link to kanari.io below the map.",
      },
      {
        q: "Can I center the map on my town?",
        a: "The generator offers departments and countries. For finer centering, adjust the lat, lon and z parameters of the iframe URL: the map accepts them freely.",
      },
      {
        q: "Is the data current during a wildfire?",
        a: "The embedded map is the same as kanari.io: satellite detections refreshed continuously (every 10 minutes for geostationary satellites), aircraft in flight, verified reports.",
      },
    ],
  },
} as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const l: Lang = isValidLang(lang) ? lang : "fr";
  const t = localize(T, l);
  return {
    title: t.metaTitle,
    description: t.metaDesc,
    alternates: {
      canonical: `/${l === "fr" ? "fr" : "en"}/widget`,
      languages: { fr: "/fr/widget", en: "/en/widget" },
    },
  };
}

export default async function WidgetPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  const t = localize(T, lang);

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: t.faq.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <h1 className="mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          {t.h1}
        </h1>
        <p className="mb-7 text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {t.intro}
        </p>

        <WidgetBuilder lang={lang} />

        <section className="mb-8 mt-8 rounded-[18px] p-5" style={{ background: "var(--canary-tint)" }}>
          <h2 className="mb-2 text-[17px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            {t.pressTitle}
          </h2>
          <ul className="flex flex-col gap-2 pl-5 text-[14px] leading-relaxed" style={{ color: "var(--ink-2)", listStyle: "disc" }}>
            {t.press.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </section>

        <section className="mb-4">
          <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            {t.faqTitle}
          </h2>
          {t.faq.map((it) => (
            <details key={it.q} className="mb-2 rounded-[14px] px-4 py-3" style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}>
              <summary className="cursor-pointer text-[14.5px] font-semibold" style={{ color: "var(--ink)" }}>{it.q}</summary>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--ink-2)" }}>{it.a}</p>
            </details>
          ))}
        </section>

        <p className="mt-8 border-t pt-4 text-[12.5px]" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
          {lang === "fr" ? (
            <>
              Voir aussi : <Link href="/fr/api" style={{ color: "var(--link)" }}>l&apos;API publique</Link> ·{" "}
              <Link href="/fr/statistiques" style={{ color: "var(--link)" }}>les chiffres en direct</Link> ·{" "}
              <Link href="/fr/sdis" style={{ color: "var(--link)" }}>l&apos;offre SDIS et collectivités</Link>.
            </>
          ) : (
            <>
              See also: <Link href="/en/api" style={{ color: "var(--link)" }}>the public API</Link> ·{" "}
              <Link href="/en/statistiques" style={{ color: "var(--link)" }}>live statistics</Link>.
            </>
          )}
        </p>
        <SiteFooter lang={lang} />
      </div>
    </div>
  );
}
