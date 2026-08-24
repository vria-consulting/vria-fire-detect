import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidLang, localize, type Lang } from "@/lib/i18n";
import { ARCHIVE_START, MONTH_RE, archiveMonths, fireUrl, monthRange, periodStats } from "@/lib/observatory";
import { LOCALE, OBS, allScopes, fmtDate, monthLabel, resolveScope } from "@/lib/observatory-i18n";
import { SiteFooter } from "@/components/SiteFooter";

// Observatoire citable : une page permanente par pays (ou monde) et par mois
// — « combien de feux de forêt au Brésil en août 2026 ? ». Peu de pages,
// toutes uniques (chiffres, série quotidienne, feux majeurs), les permaliens
// que la presse et les assistants IA peuvent citer et relier.
export const revalidate = 1800;

function hasArchive(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function isCurrentMonth(month: string): boolean {
  return month === new Date().toISOString().slice(0, 7);
}

function validMonth(month: string): boolean {
  if (!MONTH_RE.test(month)) return false;
  const first = ARCHIVE_START.slice(0, 7);
  const current = new Date().toISOString().slice(0, 7);
  return month >= first && month <= current;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; country: string; month: string }>;
}): Promise<Metadata> {
  const { lang, country, month } = await params;
  const l: Lang = isValidLang(lang) ? lang : "en";
  const scope = resolveScope(country, l);
  if (!scope || !validMonth(month)) return {};
  const t = localize(OBS, l);
  const label = monthLabel(month, l);
  const path = `/statistiques/${country}/${month}`;
  const og = `https://kanari.io/ogobs/${country}/${month}.png?lang=${l}`;
  return {
    title: t.titleMonth(scope.name, label),
    description: t.descMonth(scope.name, label),
    alternates: {
      canonical: `/${l}${path}`,
      languages: { fr: `/fr${path}`, en: `/en${path}`, es: `/es${path}`, pt: `/pt${path}` },
    },
    openGraph: {
      type: "article",
      url: `https://kanari.io/${l}${path}`,
      title: t.h1Month(scope.name, label),
      description: t.descMonth(scope.name, label),
      images: [{ url: og, width: 1200, height: 630, alt: t.ogAlt(scope.name, label) }],
    },
    twitter: { card: "summary_large_image", images: [og] },
  };
}

export default async function ObservatoryMonthPage({
  params,
}: {
  params: Promise<{ lang: string; country: string; month: string }>;
}) {
  const { lang, country, month } = await params;
  if (!isValidLang(lang)) notFound();
  const scope = resolveScope(country, lang);
  if (!scope || !validMonth(month)) notFound();
  const range = monthRange(month)!;
  const t = localize(OBS, lang);
  const label = monthLabel(month, lang);

  const months = archiveMonths();
  const idx = months.indexOf(month);
  const newer = idx > 0 ? months[idx - 1] : null;
  const older = idx >= 0 && idx < months.length - 1 ? months[idx + 1] : null;
  const [stats, prevStats] = await Promise.all([
    periodStats(range.fromIso, range.toIso, scope.cc),
    older ? periodStats(monthRange(older)!.fromIso, monthRange(older)!.toIso, scope.cc) : Promise.resolve(null),
  ]);
  // Résumé narratif : les phrases qu'un journaliste ou un assistant IA reprend
  // telles quelles (journée de pointe, pays dominant, feu le plus long, écart
  // avec le mois précédent).
  const narrative: string[] = [];
  if (stats.total > 0) {
    const peak = [...stats.byDay].sort((a, b) => b.n - a.n)[0];
    if (peak) narrative.push(t.peakDay(new Date(`${peak.day}T12:00:00Z`).toLocaleDateString(LOCALE[lang], { day: "numeric", month: "long", timeZone: "UTC" }), peak.n));
    if (!scope.cc && stats.byCountry[0] && stats.byCountry[0].cc !== "??") {
      const topScope = allScopes(lang).find((x) => x.cc === stats.byCountry[0].cc);
      narrative.push(t.topShare(topScope?.name ?? stats.byCountry[0].cc, Math.round((100 * stats.byCountry[0].n) / stats.total), stats.byCountry[0].n));
    }
    const lg = stats.longest[0];
    if (lg) {
      const h = Math.round((Date.parse(lg.last_seen) - Date.parse(lg.first_seen)) / 3_600_000);
      if (h >= 6) narrative.push(t.longest(lg.place ?? lg.slug, h));
    }
    if (prevStats && prevStats.total > 0 && !isCurrentMonth(month)) {
      narrative.push(t.vsPrev(Math.round((100 * (stats.total - prevStats.total)) / prevStats.total), monthLabel(older!, lang)));
    }
  }
  const updated = new Date().toLocaleString(
    { fr: "fr-FR", en: "en-GB", es: "es-ES", pt: "pt-BR" }[lang],
    { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }
  );
  // Pages quasi vides : pas poussées aux moteurs (noindex, follow), sauf quand
  // l'archive est injoignable (CI, incident) — on ne désindexe pas sur un doute.
  const thin = hasArchive() && stats.total < 10;

  const maxDay = Math.max(1, ...stats.byDay.map((d) => d.n));
  const card = { background: "var(--white)", boxShadow: "var(--shadow-s)" } as const;
  const h2 = { fontFamily: "var(--font-display)", color: "var(--ink)" } as const;

  const datasetLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: t.h1Month(scope.name, label),
    description: t.descMonth(scope.name, label),
    url: `https://kanari.io/${lang}/statistiques/${country}/${month}`,
    license: "https://creativecommons.org/licenses/by/4.0/",
    creator: { "@id": "https://kanari.io/#org" },
    isAccessibleForFree: true,
    temporalCoverage: `${range.fromIso.slice(0, 10)}/${new Date(Date.parse(range.toIso) - 1).toISOString().slice(0, 10)}`,
    spatialCoverage: scope.cc ? { "@type": "Place", name: scope.name, address: { "@type": "PostalAddress", addressCountry: scope.cc } } : { "@type": "Place", name: "World" },
    variableMeasured: [
      { "@type": "PropertyValue", name: "significant wildfires detected", value: stats.total },
      { "@type": "PropertyValue", name: "fires still active", value: stats.active },
      { "@type": "PropertyValue", name: "peak fire radiative power", value: Math.round(stats.maxFrp), unitText: "MW" },
    ],
    distribution: [{ "@type": "DataDownload", encodingFormat: "text/csv", contentUrl: "https://kanari.io/opendata/feux.csv" }],
  };
  const crumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "kanari", item: `https://kanari.io/${lang}` },
      { "@type": "ListItem", position: 2, name: t.crumbObs, item: `https://kanari.io/${lang}/statistiques` },
      { "@type": "ListItem", position: 3, name: scope.name, item: `https://kanari.io/${lang}/statistiques/${country}` },
      { "@type": "ListItem", position: 4, name: label, item: `https://kanari.io/${lang}/statistiques/${country}/${month}` },
    ],
  };

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      {thin && <meta name="robots" content="noindex, follow" />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbLd) }} />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <nav className="mb-3 text-[13px]" style={{ color: "var(--ink-3)" }} aria-label="breadcrumb">
          <Link href={`/${lang}/statistiques`} style={{ color: "var(--link)" }}>{t.crumbObs}</Link>
          {" › "}
          <Link href={`/${lang}/statistiques/${country}`} style={{ color: "var(--link)" }}>{scope.name}</Link>
          {" › "}
          <span>{label}</span>
        </nav>
        <h1 className="mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          {scope.flag} {t.h1Month(scope.name, label)}
        </h1>
        <p className="mb-3 text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {stats.total > 0 ? t.introMonth(scope.name, label, stats.total, updated) : t.noData}
        </p>
        {narrative.length > 0 && (
          <p className="mb-6 text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>{narrative.join(" ")}</p>
        )}

        {stats.total > 0 && (
          <>
            <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { v: stats.total, l: t.cards.total, c: "#D64545" },
                { v: stats.active, l: t.cards.active, c: "var(--ink)" },
                { v: stats.withWitnesses, l: t.cards.witnesses, c: "var(--ink)" },
                { v: stats.withAircraft, l: t.cards.aircraft, c: "var(--ink)" },
                { v: Math.round(stats.maxFrp), l: t.cards.maxFrp, c: "var(--ink)" },
              ].map((k) => (
                <div key={k.l} className="rounded-[18px] px-4 py-4" style={card}>
                  <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: k.c }}>{k.v}</div>
                  <div className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>{k.l}</div>
                </div>
              ))}
            </div>

            <blockquote
              className="mb-8 rounded-[18px] border-l-4 p-5 text-[15px] leading-relaxed"
              style={{ background: "var(--canary-tint)", borderColor: "var(--canary-strong)", color: "var(--ink)" }}
            >
              {t.quote(scope.name, label, stats.total, stats.active, stats.maxFrp)}
              <footer className="mt-1.5 text-[12.5px]" style={{ color: "var(--ink-3)" }}>{t.quoteSource}</footer>
            </blockquote>

            {thin && <p className="mb-6 text-[13.5px]" style={{ color: "var(--ink-3)" }}>{t.fewData}</p>}

            <section className="mb-8">
              <h2 className="mb-3 text-[19px] font-semibold" style={h2}>{t.byDay}</h2>
              <svg viewBox={`0 0 ${Math.max(31, stats.byDay.length) * 20} 120`} width="100%" height="120" role="img" aria-label={t.byDay}>
                {stats.byDay.map((d, i) => {
                  const h = Math.round((d.n / maxDay) * 90);
                  return (
                    <g key={d.day}>
                      <rect x={i * 20 + 3} y={100 - h} width={14} height={h} rx={3} fill="var(--canary)" />
                      <text x={i * 20 + 10} y={112} fontSize={8} textAnchor="middle" fill="var(--ink-3)">{d.day.slice(8)}</text>
                      <title>{`${d.day}: ${d.n}`}</title>
                    </g>
                  );
                })}
              </svg>
            </section>

            {!scope.cc && stats.byCountry.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 text-[19px] font-semibold" style={h2}>{t.topCountries}</h2>
                <div className="flex flex-col gap-1.5">
                  {stats.byCountry.slice(0, 12).map((c) => {
                    const s = allScopes(lang).find((x) => x.cc === c.cc);
                    return (
                      <div key={c.cc} className="flex items-center gap-3">
                        <span className="w-28 truncate text-[13.5px]" style={{ color: "var(--ink)" }}>
                          {s ? <Link href={`/${lang}/statistiques/${s.slug}/${month}`} style={{ color: "var(--link)" }}>{s.flag} {s.name}</Link> : c.cc}
                        </span>
                        <div className="h-[10px] flex-1 overflow-hidden rounded-full" style={{ background: "var(--paper-2)" }}>
                          <div className="h-full rounded-full" style={{ width: `${(c.n / stats.byCountry[0].n) * 100}%`, background: "var(--canary)" }} />
                        </div>
                        <span className="w-10 text-right text-[13px] font-bold" style={{ color: "var(--ink)" }}>{c.n}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {scope.cc === "FR" && stats.byDept.length > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 text-[19px] font-semibold" style={h2}>{t.topDepts}</h2>
                <ul className="flex flex-col gap-1 text-[14px]">
                  {stats.byDept.map((d) => (
                    <li key={d.slug} className="flex justify-between">
                      <Link href={`/fr/feux/${d.slug}`} style={{ color: "var(--link)" }}>{d.slug.replace(/-/g, " ")} ({d.code})</Link>
                      <span style={{ color: "var(--ink)", fontWeight: 700 }}>{d.n}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mb-8">
              <h2 className="mb-3 text-[19px] font-semibold" style={h2}>{t.biggest}</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-[13.5px]" style={{ color: "var(--ink-2)" }}>
                  <thead>
                    <tr className="text-left" style={{ color: "var(--ink-3)" }}>
                      <th className="py-1 pr-2 font-semibold">{t.colPlace}</th>
                      <th className="py-1 pr-2 font-semibold">{t.colDate}</th>
                      <th className="py-1 pr-2 text-right font-semibold">{t.colDet}</th>
                      <th className="py-1 text-right font-semibold">{t.colFrp}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.biggest.map((f) => (
                      <tr key={f.slug} style={{ borderTop: "1px solid var(--line)" }}>
                        <td className="py-1.5 pr-2">
                          <a href={fireUrl(f.slug)} style={{ color: "var(--link)" }}>{f.place ?? f.slug}</a>
                          {f.country && f.country !== scope.cc ? <span style={{ color: "var(--ink-3)" }}> · {f.country}</span> : null}
                        </td>
                        <td className="py-1.5 pr-2 whitespace-nowrap">{fmtDate(f.first_seen, lang)}</td>
                        <td className="py-1.5 pr-2 text-right">{f.detections}</td>
                        <td className="py-1.5 text-right font-semibold" style={{ color: "var(--ink)" }}>{Math.round(f.max_frp)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="mb-8 rounded-[18px] p-4 text-[13.5px]" style={card}>
              <h2 className="mb-1 text-[15px] font-semibold" style={h2}>{t.cite}</h2>
              <p style={{ color: "var(--ink-2)" }}>
                {t.citeText(scope.name, label, stats.total)} {new Date().toISOString().slice(0, 10)}.
              </p>
            </section>
          </>
        )}

        <nav className="mb-6 flex flex-wrap gap-2 text-[13.5px]">
          {older && <Link href={`/${lang}/statistiques/${country}/${older}`} className="rounded-full px-3 py-1.5" style={{ ...card, color: "var(--link)" }}>← {monthLabel(older, lang)}</Link>}
          {newer && <Link href={`/${lang}/statistiques/${country}/${newer}`} className="rounded-full px-3 py-1.5" style={{ ...card, color: "var(--link)" }}>{monthLabel(newer, lang)} →</Link>}
          <Link href={`/${lang}/statistiques/${country}`} className="rounded-full px-3 py-1.5" style={{ ...card, color: "var(--link)" }}>{t.otherMonths}</Link>
          {scope.cc && <Link href={`/${lang}/statistiques/world/${month}`} className="rounded-full px-3 py-1.5" style={{ ...card, color: "var(--link)" }}>{t.world}</Link>}
        </nav>

        <section className="mb-8 text-[13.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          <p className="mb-2">
            {t.methodo}{" "}
            <Link href={`/${lang}/methodologie`} style={{ color: "var(--link)" }}>{t.methodoLink}</Link>.
          </p>
          <p>
            <a href="/opendata/feux.csv" style={{ color: "var(--link)" }}>{t.openData}</a>
            {" · "}
            <Link href={scope.cc === "FR" ? "/fr/feux" : `/${lang === "fr" ? "en" : lang}/fires`} style={{ color: "var(--link)" }}>{t.seeLive}</Link>
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
                  <Link href={`/${lang}/statistiques/${s.slug}/${month}`} style={{ color: "var(--link)" }}>{s.name}</Link>
                </span>
              ))}
          </p>
        </section>

        <SiteFooter lang={lang} />
      </div>
    </div>
  );
}
