import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isValidLang } from "@/lib/i18n";
import { GUIDES, GUIDE_BY_SLUG } from "@/lib/guides";

// Guides évergreens : contenu 100 % statique -> prérendu au build.
export async function generateStaticParams() {
  return GUIDES.map((g) => ({ lang: "fr", slug: g.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const g = GUIDE_BY_SLUG.get(slug);
  if (!g) return {};
  return {
    title: g.metaTitle,
    description: g.metaDesc,
    alternates: { canonical: `/fr/guide/${g.slug}` },
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

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: g.title,
    description: g.metaDesc,
    dateModified: g.updated,
    inLanguage: "fr",
    author: { "@type": "Organization", name: "kanari", url: "https://kanari.io" },
    publisher: { "@id": "https://kanari.io/#org" },
    mainEntityOfPage: `https://kanari.io/fr/guide/${g.slug}`,
  };

  const others = GUIDES.filter((x) => x.slug !== g.slug);

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <p className="mb-1 text-[13px]" style={{ color: "var(--ink-3)" }}>
          <Link href="/fr/guide" style={{ color: "var(--link)" }}>Guides</Link> · mis à jour le{" "}
          {new Date(g.updated).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
        </p>
        <h1 className="mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          {g.title}
        </h1>
        <p className="mb-7 text-[15.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {g.intro}
        </p>
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
