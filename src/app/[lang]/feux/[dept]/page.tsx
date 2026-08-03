import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isValidLang } from "@/lib/i18n";
import { DEPT_BY_SLUG, DEPT_RADIUS_KM, DEPARTEMENTS, distKm } from "@/lib/departements";
import { getEvents, staleEvents, staleBlobEvents } from "@/lib/eventscache";
import { computeFireRisk, type FireRisk } from "@/lib/firerisk";
import type { FireEvent } from "@/lib/cluster";

// Pages locales SEO « Incendie [département] aujourd'hui » : rendues à la
// demande puis revalidées (ISR) — fraîches sans peser sur le build ni sur
// les sources amont.
export const revalidate = 900;
export async function generateStaticParams() {
  return [];
}

const RISK_LABELS = ["faible", "modéré", "élevé", "très élevé"];
const RISK_COLORS = ["#3A9D5B", "#F0B400", "#E8622C", "#D64545"];

function hoursAgo(iso: string): number {
  return Math.max(0, (Date.now() - new Date(iso).getTime()) / 3_600_000);
}
function ageLabel(h: number): string {
  if (h < 1) return `il y a ${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `il y a ${Math.round(h)} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

async function loadLocalFires(lat: number, lon: number): Promise<FireEvent[] | null> {
  try {
    const data = await getEvents(24);
    return data.events.filter((ev) => distKm(lat, lon, ev.centroid[1], ev.centroid[0]) <= DEPT_RADIUS_KM);
  } catch {
    const stale = staleEvents(24) ?? (await staleBlobEvents(24));
    if (!stale) return null;
    return stale.events.filter((ev) => distKm(lat, lon, ev.centroid[1], ev.centroid[0]) <= DEPT_RADIUS_KM);
  }
}

async function loadRisk(lat: number, lon: number): Promise<{ risk: FireRisk; windKmh: number } | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=wind_speed_10m,temperature_2m,relative_humidity_2m` +
      `&daily=precipitation_sum&past_days=3&forecast_days=1&wind_speed_unit=kmh&timezone=auto`;
    const res = await fetch(url, { next: { revalidate: 900 } });
    if (!res.ok) return null;
    const j = await res.json();
    const c = j.current ?? {};
    if (typeof c.temperature_2m !== "number" || typeof c.relative_humidity_2m !== "number") return null;
    const rain: number[] = j.daily?.precipitation_sum ?? [];
    const recentRainMm = rain.slice(0, Math.max(0, rain.length - 1)).reduce(
      (s: number, v: number) => s + (typeof v === "number" ? v : 0), 0);
    const windKmh = Math.round(c.wind_speed_10m ?? 0);
    return {
      risk: computeFireRisk({ tempC: c.temperature_2m, rh: c.relative_humidity_2m, windKmh, recentRainMm }),
      windKmh,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; dept: string }>;
}): Promise<Metadata> {
  const { dept } = await params;
  const d = DEPT_BY_SLUG.get(dept);
  if (!d) return {};
  return {
    title: `Incendie ${d.name} aujourd'hui : feux en cours, carte en temps réel | kanari`,
    description: `Y a-t-il un feu de forêt en ${d.name} (${d.code}) en ce moment ? Carte des départs de feu en temps réel (satellites + témoins vérifiés), risque incendie du jour et suivi des Canadair. Gratuit, sans compte.`,
    alternates: { canonical: `/fr/feux/${d.slug}` },
  };
}

export default async function DeptPage({
  params,
}: {
  params: Promise<{ lang: string; dept: string }>;
}) {
  const { lang, dept } = await params;
  if (!isValidLang(lang)) notFound();
  const d = DEPT_BY_SLUG.get(dept);
  if (!d) notFound();
  // Contenu français uniquement : une seule URL canonique.
  if (lang !== "fr") redirect(`/fr/feux/${d.slug}`);

  const [fires, meteo] = await Promise.all([
    loadLocalFires(d.lat, d.lon),
    loadRisk(d.lat, d.lon),
  ]);
  const sorted = (fires ?? []).sort((a, b) => Date.parse(b.lastSeen) - Date.parse(a.lastSeen));
  const active = sorted.filter((ev) => hoursAgo(ev.lastSeen) < 24);
  const now = new Date().toLocaleString("fr-FR", {
    day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
  });
  const mapHref = `/fr?lat=${d.lat}&lon=${d.lon}&z=8.3`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "kanari", item: "https://kanari.io/fr" },
      { "@type": "ListItem", position: 2, name: "Feux en France", item: "https://kanari.io/fr/feux" },
      { "@type": "ListItem", position: 3, name: d.name, item: `https://kanari.io/fr/feux/${d.slug}` },
    ],
  };

  // Départements voisins (les 6 plus proches) : maillage interne.
  const neighbors = DEPARTEMENTS
    .filter((x) => x.slug !== d.slug)
    .map((x) => ({ x, dist: distKm(d.lat, d.lon, x.lat, x.lon) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 6)
    .map((n) => n.x);

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <p className="mb-1 text-[13px]" style={{ color: "var(--ink-3)" }}>
          <Link href="/fr/feux" style={{ color: "var(--link)" }}>Feux en France</Link> · {d.name} ({d.code})
        </p>
        <h1 className="mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          Incendies en {d.name} : la situation en temps réel
        </h1>
        <p className="mb-6 text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          Situation au {now} (heure de Paris), dans un rayon de {DEPT_RADIUS_KM} km autour du
          département : détections satellites des dernières 24 h (NASA FIRMS, GOES, Meteosat MTG)
          et signalements citoyens vérifiés. Mise à jour continue.
        </p>

        {/* Bilan chiffré */}
        <div className="mb-6 flex flex-wrap gap-3">
          <div className="rounded-[18px] px-5 py-4" style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600, color: active.length > 0 ? "#D64545" : "#22684A" }}>
              {fires === null ? "—" : active.length}
            </div>
            <div className="text-[13px]" style={{ color: "var(--ink-2)" }}>
              {fires === null
                ? "données momentanément indisponibles"
                : active.length === 0
                  ? "aucun foyer détecté sur 24 h"
                  : active.length === 1 ? "foyer détecté sur 24 h" : "foyers détectés sur 24 h"}
            </div>
          </div>
          {meteo && (
            <div className="rounded-[18px] px-5 py-4" style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600, color: RISK_COLORS[meteo.risk.level - 1] }}>
                {RISK_LABELS[meteo.risk.level - 1]}
              </div>
              <div className="text-[13px]" style={{ color: "var(--ink-2)" }}>
                risque météo de feu estimé aujourd'hui · vent {meteo.windKmh} km/h
              </div>
            </div>
          )}
        </div>

        <Link
          href={mapHref}
          className="mb-8 flex h-[50px] items-center justify-center rounded-full text-[15px] font-semibold"
          style={{ background: "var(--canary)", color: "var(--charcoal)", boxShadow: "var(--shadow-m)" }}
        >
          Voir la carte en direct de {d.name} →
        </Link>

        {/* Liste des foyers */}
        {active.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
              Foyers détectés (24 dernières heures)
            </h2>
            <div className="flex flex-col gap-2.5">
              {active.slice(0, 10).map((ev) => {
                const lastH = hoursAgo(ev.lastSeen);
                return (
                  <Link
                    key={ev.id}
                    href={`/fr?lat=${ev.centroid[1].toFixed(3)}&lon=${ev.centroid[0].toFixed(3)}&z=10&ev=${encodeURIComponent(ev.id)}`}
                    className="flex items-start gap-3 rounded-[14px] px-4 py-3"
                    style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}
                  >
                    <span className="mt-[6px] h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: lastH < 3 ? "#D64545" : lastH < 12 ? "#E8622C" : "#F0B400" }} />
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[14.5px]" style={{ color: "var(--ink)" }}>
                        {ev.social?.place ?? `Détection satellite — ${ev.centroid[1].toFixed(2)}, ${ev.centroid[0].toFixed(2)}`}
                      </strong>
                      <span className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                        {ev.count} détection{ev.count > 1 ? "s" : ""} satellite · dernier signal {ageLabel(lastH)}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Texte de fond (SEO + honnêteté méthodo) */}
        <section className="mb-8 text-[14.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          <h2 className="mb-2 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            Comment savoir s'il y a un feu en {d.name} en ce moment ?
          </h2>
          <p className="mb-3">
            kanari croise en continu les détections thermiques des satellites (VIIRS 375 m environ
            toutes les 12 h, Meteosat MTG toutes les 10 min) avec les témoignages publiés sur les
            réseaux sociaux, vérifiés deux fois par IA avant affichage. Un départ de feu en {d.name} peut
            ainsi apparaître sur la carte quelques minutes après ses premiers signaux, souvent avant
            les premiers articles de presse.
          </p>
          <p className="mb-3">
            Un feu très petit, très récent ou masqué par les nuages peut échapper temporairement aux
            satellites : si vous êtes témoin d'un départ de feu, appelez d'abord le <strong>18</strong> ou
            le <strong>112</strong>, puis signalez-le sur la carte pour aider les autres habitants.
          </p>
          <p>
            Pendant les opérations, vous pouvez aussi <Link href="/fr/canadair" style={{ color: "var(--link)" }}>suivre
            les Canadair et bombardiers d'eau en direct</Link> au-dessus du département.
          </p>
        </section>

        {/* Maillage interne */}
        <section className="mb-4">
          <h2 className="mb-2 text-[15px] font-semibold" style={{ color: "var(--ink)" }}>Départements voisins</h2>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-[14px]">
            {neighbors.map((n) => (
              <Link key={n.slug} href={`/fr/feux/${n.slug}`} style={{ color: "var(--link)" }}>
                Feux en {n.name}
              </Link>
            ))}
          </p>
        </section>

        <p className="mt-8 border-t pt-4 text-[12.5px]" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
          kanari est un service d'information indépendant et gratuit, pas un canal d'alerte
          officiel. En cas d'urgence : 18 ou 112. Données : NASA FIRMS, NOAA GOES, EUMETSAT MTG,
          témoignages vérifiés.
        </p>
      </div>
    </div>
  );
}
