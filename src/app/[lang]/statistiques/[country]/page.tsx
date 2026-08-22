import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidLang, localize, type Lang } from "@/lib/i18n";
import { countFires } from "@/lib/firearchive";
import { ARCHIVE_START, archiveMonths, monthRange, periodStats } from "@/lib/observatory";
import { OBS, allScopes, monthLabel, resolveScope } from "@/lib/observatory-i18n";
import { SiteFooter } from "@/components/SiteFooter";
import { Adsense } from "@/components/Adsense";

// Observatoire citable, niveau pays : le mois en cours en un coup d'œil et la
// série mensuelle complète (un lien par mois vers la page permanente).
export const revalidate = 1800;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; country: string }>;
}): Promise<Metadata> {
  const { lang, country } = await params;
  const l: Lang = isValidLang(lang) ? lang : "en";
  const scope = resolveScope(country, l);
  if (!scope) return {};
  const t = localize(OBS, l);
  const path = `/statistiques/${country}`;
  return {
    title: t.titleCountry(scope.name),
    description: t.descCountry(scope.name),
    alternates: {
      canonical: `/${l}${path}`,
      languages: { fr: `/fr${path}`, en: `/en${path}`, es: `/es${path}`, pt: `/pt${path}` },
    },
  };
}

export default async function ObservatoryCountryPage({
  params,
}: {
  params: Promise<{ lang: string; country: string }>;
}) {
  const { lang, country } = await params;
  if (!isValidLang(lang)) notFound();
  const scope = resolveScope(country, lang);
  if (!scope) notFound();
  const t = localize(OBS, lang);
  const months = archiveMonths();
  const current = months[0];
  const range = monthRange(current)!;
  const ccFilter = scope.cc ? `&country=eq.${encodeURIComponent(scope.cc)}` : "";

  const [stats, counts, total] = await Promise.all([
    periodStats(range.fromIso, range.toIso, scope.cc),
    Promise.all(
      months.map(async (m) => {
        const r = monthRange(m)!;
        const n = await countFires(
          `first_seen=gte.${encodeURIComponent(r.fromIso)}&first_seen=lt.${encodeURIComponent(r.toIso)}${ccFilter}`
        );
        return { month: m, n };
      })
    ),
    countFires(`first_seen=gte.${encodeURIComponent(`${ARCHIVE_START}T00:00:00Z`)}${ccFilter}`),
  ]);

  const card = { background: "var(--white)", boxShadow: "var(--shadow-s)" } as const;
  const h2 = { fontFamily: "var(--font-display)", color: "var(--ink)" } as const;
  const crumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "kanari", item: `https://kanari.io/${lang}` },
      { "@type": "ListItem", position: 2, name: t.crumbObs, item: `https://kanari.io/${lang}/statistiques` },
      { "@type": "ListItem", position: 3, name: scope.name, item: `https://kanari.io/${lang}/statistiques/${country}` },
    ],
  };

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <Adsense />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbLd) }} />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <nav className="mb-3 text-[13px]" style={{ color: "var(--ink-3)" }} aria-label="breadcrumb">
          <Link href={`/${lang}/statistiques`} style={{ color: "var(--link)" }}>{t.crumbObs}</Link>
          {" › "}
          <span>{scope.name}</span>
        </nav>
        <h1 className="mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          {scope.flag} {t.h1Country(scope.name)}
        </h1>
        <p className="mb-6 text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {t.sinceArchive(total ?? counts.reduce((s, c) => s + (c.n ?? 0), 0))}.
        </p>

        <section className="mb-8 rounded-[18px] p-5" style={card}>
          <h2 className="mb-2 text-[17px] font-semibold" style={h2}>
            <Link href={`/${lang}/statistiques/${country}/${current}`} style={{ color: "var(--link)" }}>
              {t.currentMonth} : {monthLabel(current, lang)} →
            </Link>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { v: stats.total, l: t.cards.total, c: "#D64545" },
              { v: stats.active, l: t.cards.active, c: "var(--ink)" },
              { v: stats.withWitnesses, l: t.cards.witnesses, c: "var(--ink)" },
              { v: Math.round(stats.maxFrp), l: t.cards.maxFrp, c: "var(--ink)" },
            ].map((k) => (
              <div key={k.l}>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: k.c }}>{k.v}</div>
                <div className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>{k.l}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-[19px] font-semibold" style={h2}>{t.monthsTitle}</h2>
          <table className="w-full text-[14px]" style={{ color: "var(--ink-2)" }}>
            <thead>
              <tr className="text-left" style={{ color: "var(--ink-3)" }}>
                <th className="py-1 font-semibold">{t.colMonth}</th>
                <th className="py-1 text-right font-semibold">{t.colFires}</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((c) => (
                <tr key={c.month} style={{ borderTop: "1px solid var(--line)" }}>
                  <td className="py-1.5">
                    <Link href={`/${lang}/statistiques/${country}/${c.month}`} style={{ color: "var(--link)" }}>{monthLabel(c.month, lang)}</Link>
                  </td>
                  <td className="py-1.5 text-right font-semibold" style={{ color: "var(--ink)" }}>{c.n ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mb-8 text-[13.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          <p className="mb-2">
            {t.methodo} <Link href={`/${lang}/methodologie`} style={{ color: "var(--link)" }}>{t.methodoLink}</Link>.
          </p>
          <p>
            <a href="/opendata/feux.csv" style={{ color: "var(--link)" }}>{t.openData}</a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-2 text-[15px] font-semibold" style={h2}>{t.otherScopes}</h2>
          <p className="text-[13px] leading-relaxed">
            {allScopes(lang)
              .filter((s) => s.slug !== country)
              .map((s, i) => (
                <span key={s.slug}>
                  {i > 0 ? " · " : ""}
                  <Link href={`/${lang}/statistiques/${s.slug}`} style={{ color: "var(--link)" }}>{s.name}</Link>
                </span>
              ))}
          </p>
        </section>

        <SiteFooter lang={lang} />
      </div>
    </div>
  );
}
