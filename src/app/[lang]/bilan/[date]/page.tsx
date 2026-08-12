import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isValidLang } from "@/lib/i18n";
import { listFiresBetween, type ArchivedFire } from "@/lib/firearchive";
import { DEPT_BY_SLUG } from "@/lib/departements";
import { SiteFooter } from "@/components/SiteFooter";

// Bilan quotidien automatique : « le [date], X départs de feu détectés ».
// Contenu frais chaque jour (signal de fraîcheur SEO) + matière à citations.
export const dynamic = "force-dynamic";

const ARCHIVE_START = "2026-08-03"; // premier jour de la mémoire des feux

function isValidDate(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const today = new Date().toISOString().slice(0, 10);
  return d >= ARCHIVE_START && d <= today;
}

function nextDay(d: string): string {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}
function prevDay(d: string): string {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}

function frLongDate(d: string): string {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function flag(cc: string | null): string {
  if (!cc || !/^[A-Za-z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

// cache() : le même fetch sert generateMetadata ET la page sans double appel.
const firesOfDay = cache((date: string) =>
  listFiresBetween(`${date}T00:00:00Z`, `${nextDay(date)}T00:00:00Z`, 5000)
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  if (!isValidDate(date)) return {};
  const fires = await firesOfDay(date);
  const fr = fires.filter((f) => f.country === "FR").length;
  // Titre façon Discover : chiffres précis + enjeu, sans sensationnalisme.
  const title =
    fires.length > 0
      ? `Feux de forêt du ${frLongDate(date)} : ${fires.length} départs détectés dans le monde${fr > 0 ? `, dont ${fr} en France` : ""}`
      : `Bilan des feux de forêt du ${frLongDate(date)} : départs détectés dans le monde | kanari`;
  const img = `https://kanari.io/ogbilan/${date}`;
  return {
    title,
    description: `Combien de feux de forêt le ${frLongDate(date)} ? Le bilan automatique kanari : départs détectés par satellite, foyers les plus puissants, pays touchés, moyens aériens engagés.`,
    alternates: { canonical: `/fr/bilan/${date}` },
    openGraph: { type: "article", title, images: [{ url: img, width: 1200, height: 630, alt: title }] },
    twitter: { card: "summary_large_image", images: [img] },
  };
}

export default async function BilanPage({
  params,
}: {
  params: Promise<{ lang: string; date: string }>;
}) {
  const { lang, date } = await params;
  if (!isValidLang(lang)) notFound();
  if (!isValidDate(date)) notFound();
  if (lang !== "fr") redirect(`/fr/bilan/${date}`);

  const fires = await firesOfDay(date);
  const fr = fires.filter((f) => f.country === "FR");
  const byCountry = new Map<string, number>();
  for (const f of fires) byCountry.set(f.country ?? "??", (byCountry.get(f.country ?? "??") ?? 0) + 1);
  const countries = [...byCountry.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const aircraftIds = new Set<string>();
  for (const f of fires) for (const a of f.aircraft) aircraftIds.add(a.id);
  const top = fires.slice(0, 10);
  const isToday = date === new Date().toISOString().slice(0, 10);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: `Bilan des feux de forêt du ${frLongDate(date)}`,
    image: [`https://kanari.io/ogbilan/${date}`],
    datePublished: `${date}T00:00:00Z`,
    dateModified: new Date().toISOString(),
    inLanguage: "fr",
    author: { "@type": "Organization", name: "kanari", url: "https://kanari.io" },
    publisher: { "@id": "https://kanari.io/#org" },
    mainEntityOfPage: `https://kanari.io/fr/bilan/${date}`,
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "kanari", item: "https://kanari.io/fr" },
      { "@type": "ListItem", position: 2, name: "Bilans quotidiens", item: "https://kanari.io/fr/bilan" },
      { "@type": "ListItem", position: 3, name: `Bilan du ${frLongDate(date)}`, item: `https://kanari.io/fr/bilan/${date}` },
    ],
  };

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <article className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <p className="mb-1 text-[13px]" style={{ color: "var(--ink-3)" }}>
          <Link href="/fr/bilan" style={{ color: "var(--link)" }}>Bilans quotidiens</Link>
        </p>
        <h1 className="mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          Feux de forêt du {frLongDate(date)}
        </h1>
        <p className="mb-6 text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {isToday
            ? "Bilan de la journée en cours, mis à jour en continu"
            : "Bilan automatique de la journée"} : départs de feu significatifs détectés par les
          satellites (NASA FIRMS, GOES, Meteosat MTG) et les témoins vérifiés de kanari.
        </p>

        {/* Grande image unique du bilan (exigence Discover) — la même que l'og:image. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/ogbilan/${date}`}
          alt={`Bilan des feux de forêt du ${frLongDate(date)} : ${fires.length} départs détectés`}
          width={1200}
          height={630}
          className="mb-6 w-full rounded-[18px]"
          style={{ boxShadow: "var(--shadow-s)" }}
        />

        <div className="mb-6 flex flex-wrap gap-3">
          <div className="rounded-[18px] px-5 py-4" style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600, color: "var(--ink)" }}>{fires.length}</div>
            <div className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>départs significatifs détectés</div>
          </div>
          <div className="rounded-[18px] px-5 py-4" style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600, color: fr.length > 0 ? "#D64545" : "#22684A" }}>{fr.length}</div>
            <div className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>en France</div>
          </div>
          {aircraftIds.size > 0 && (
            <div className="rounded-[18px] px-5 py-4" style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600, color: "var(--ink)" }}>{aircraftIds.size}</div>
              <div className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>moyens aériens observés sur zone</div>
            </div>
          )}
        </div>

        {/* Phrase citable (GEO) : le format exact que les moteurs IA lèvent
            tel quel — chiffre daté + source + licence. */}
        {fires.length > 0 && (
          <blockquote
            className="mb-7 rounded-[18px] border-l-4 p-5 text-[15px] leading-relaxed"
            style={{ background: "var(--canary-tint)", borderColor: "var(--canary-strong)", color: "var(--ink)" }}
          >
            « Le {frLongDate(date)}, kanari a détecté{" "}
            <strong>{fires.length} départ{fires.length > 1 ? "s" : ""} de feu significatif{fires.length > 1 ? "s" : ""}</strong>{" "}
            dans le monde{fr.length > 0 ? <>, dont <strong>{fr.length} en France</strong></> : null}. »
            <footer className="mt-1.5 text-[12.5px]" style={{ color: "var(--ink-3)" }}>
              Source : kanari.io — satellites NASA FIRMS, GOES, Meteosat MTG et témoins vérifiés
              par IA. Chiffre librement citable (CC BY 4.0).
            </footer>
          </blockquote>
        )}

        {top.length > 0 && (
          <section className="mb-7">
            <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
              Les foyers les plus puissants du jour
            </h2>
            <div className="flex flex-col gap-2">
              {top.map((f: ArchivedFire) => {
                const deptName = f.dept_slug ? DEPT_BY_SLUG.get(f.dept_slug)?.name : null;
                return (
                  <Link
                    key={f.slug}
                    href={`/fr/feu/${f.slug}`}
                    className="flex items-center gap-3 rounded-[14px] px-4 py-3"
                    style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}
                  >
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[14.5px]" style={{ color: "var(--ink)" }}>
                        {flag(f.country)} {f.place ?? "Détection satellite"}
                        {deptName ? ` — ${deptName}` : f.admin ? ` — ${f.admin}` : ""}
                      </strong>
                      <span className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                        {f.detections} détection{f.detections > 1 ? "s" : ""}
                        {f.aircraft.length > 0 ? ` · ${f.aircraft.length} moyen(s) aérien(s)` : ""}
                        {f.confidence === "corrobore" ? " · corroboré" : ""}
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-[13px] font-bold" style={{ color: "var(--ember)" }}>
                      {Math.round(f.max_frp)} MW
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {countries.length > 0 && (
          <section className="mb-7">
            <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
              Pays touchés
            </h2>
            <p className="flex flex-wrap gap-x-4 gap-y-1.5 text-[14px]" style={{ color: "var(--ink-2)" }}>
              {countries.map(([cc, n]) => (
                <span key={cc}>
                  {flag(cc)} {cc} · <strong style={{ color: "var(--ink)" }}>{n}</strong>
                </span>
              ))}
            </p>
          </section>
        )}

        {fires.length === 0 && (
          <p className="mb-7 rounded-[14px] px-4 py-3 text-[13.5px]" style={{ background: "var(--canary-tint)", color: "var(--ink-2)" }}>
            Aucun départ significatif archivé pour cette journée{isToday ? " — pour l'instant. La page se remplit au fil des détections." : "."}
          </p>
        )}

        <div className="mb-7 flex items-center justify-between text-[14px]">
          {date > ARCHIVE_START ? (
            <Link href={`/fr/bilan/${prevDay(date)}`} style={{ color: "var(--link)" }}>← {frLongDate(prevDay(date))}</Link>
          ) : <span />}
          {!isToday ? (
            <Link href={`/fr/bilan/${nextDay(date)}`} style={{ color: "var(--link)" }}>{frLongDate(nextDay(date))} →</Link>
          ) : <span />}
        </div>

        <p className="mt-8 border-t pt-4 text-[12.5px]" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
          Méthodologie : seuls les foyers significatifs sont archivés (corroborés par témoins, ou
          au-delà de seuils de détection/puissance) — journée en temps universel (UTC). Voir aussi :{" "}
          <Link href="/fr/statistiques" style={{ color: "var(--link)" }}>l'observatoire des feux</Link> ·{" "}
          <Link href="/fr" style={{ color: "var(--link)" }}>la carte en direct</Link>. En cas d'urgence : 18 ou 112.
        </p>
        <SiteFooter lang="fr" />
      </article>
    </div>
  );
}
