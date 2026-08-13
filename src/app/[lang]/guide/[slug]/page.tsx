import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isValidLang } from "@/lib/i18n";
import { GUIDES, GUIDE_BY_SLUG } from "@/lib/guides";
import { countFires } from "@/lib/firearchive";

// Guides évergreens, rendus dynamiques depuis le 13/08 : chaque guide ouvre
// sur un bloc CITABLE daté aux compteurs live (stats attribuées en début de
// page = le motif le plus repris par les moteurs de réponse IA). countFires
// est no-store, incompatible avec un shell statique.
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const g = GUIDE_BY_SLUG.get(slug);
  if (!g) return {};
  const ogImg = `https://kanari.io/guides/${g.slug}.png`;
  return {
    title: g.metaTitle,
    description: g.metaDesc,
    alternates: { canonical: `/fr/guide/${g.slug}` },
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
  const g = GUIDE_BY_SLUG.get(slug);
  if (!g) notFound();
  if (lang !== "fr") redirect(`/fr/guide/${g.slug}`);

  // Chiffres live pour le bloc citable (échec silencieux : bloc masqué).
  const [total, france] = await Promise.all([
    countFires("first_seen=gte.2026-08-03"),
    countFires("country=eq.FR"),
  ]);
  const today = new Date().toLocaleDateString("fr-FR", {
    day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris",
  });

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: g.title,
    description: g.metaDesc,
    image: [`https://kanari.io/guides/${g.slug}.png`],
    dateModified: g.updated,
    inLanguage: "fr",
    author: { "@type": "Organization", name: "kanari", url: "https://kanari.io" },
    publisher: { "@id": "https://kanari.io/#org" },
    mainEntityOfPage: `https://kanari.io/fr/guide/${g.slug}`,
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

  const others = GUIDES.filter((x) => x.slug !== g.slug);

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {faqLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      )}
      <article className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <p className="mb-1 text-[13px]" style={{ color: "var(--ink-3)" }}>
          <Link href="/fr/guide" style={{ color: "var(--link)" }}>Guides</Link> · mis à jour le{" "}
          {new Date(g.updated).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
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
            Au {today}, kanari a archivé {total.toLocaleString("fr-FR")} feux significatifs
            détectés par satellite dans le monde depuis le 3 août 2026
            {france !== null && france > 0 ? `, dont ${france.toLocaleString("fr-FR")} en France` : ""}.
            Source : kanari.io, données ouvertes (CC BY 4.0).
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
              Questions fréquentes
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

        <div
          className="mb-8 rounded-[18px] p-5"
          style={{ background: "var(--canary-tint)" }}
        >
          <p className="text-[14.5px] leading-relaxed" style={{ color: "var(--ink)" }}>
            <strong>Voir la situation en direct :</strong>{" "}
            <Link href="/fr" style={{ color: "var(--link)" }}>carte mondiale des feux</Link> ·{" "}
            <Link href="/fr/feux" style={{ color: "var(--link)" }}>feux par département</Link> ·{" "}
            <Link href="/fr/canadair" style={{ color: "var(--link)" }}>Canadair en direct</Link>
          </p>
        </div>

        <section className="mb-4">
          <h2 className="mb-2 text-[15px] font-semibold" style={{ color: "var(--ink)" }}>À lire aussi</h2>
          <p className="flex flex-col gap-1 text-[14px]">
            {others.map((o) => (
              <Link key={o.slug} href={`/fr/guide/${o.slug}`} style={{ color: "var(--link)" }}>
                {o.title}
              </Link>
            ))}
          </p>
        </section>

        <p className="mt-8 border-t pt-4 text-[12.5px]" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
          kanari est un service d'information indépendant et gratuit, pas un canal d'alerte
          officiel. En cas d'urgence : 18 ou 112.
        </p>
      </article>
    </div>
  );
}
