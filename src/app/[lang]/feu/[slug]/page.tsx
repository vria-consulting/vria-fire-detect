import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isValidLang } from "@/lib/i18n";
import { getFireBySlug, type ArchivedFire } from "@/lib/firearchive";
import { DEPT_BY_SLUG } from "@/lib/departements";

// Page événement permanente : chaque feu significatif archivé a son URL à
// vie (« incendie [lieu] [date] »). Mise à jour tant que le feu est actif,
// puis figée en archive.
export const dynamic = "force-dynamic";

function flag(cc: string | null): string {
  if (!cc || !/^[A-Za-z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function frDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}
function frDateTime(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris",
  });
}

function titleOf(f: ArchivedFire): string {
  const deptName = f.dept_slug ? DEPT_BY_SLUG.get(f.dept_slug)?.name : null;
  const where = f.place
    ? `${f.place}${deptName ? ` (${deptName})` : f.admin ? ` (${f.admin})` : ""}`
    : deptName ?? f.admin ?? "zone inconnue";
  return `Feu de forêt à ${where}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const f = await getFireBySlug(slug);
  if (!f) return {};
  const t = titleOf(f);
  return {
    title: `${t} — ${frDate(f.first_seen)} : chronologie et carte | kanari`,
    description: `${t} détecté le ${frDate(f.first_seen)} : ${f.detections} détection${f.detections > 1 ? "s" : ""} satellite, puissance max ${Math.round(f.max_frp)} MW${f.aircraft.length > 0 ? `, ${f.aircraft.length} moyen(s) aérien(s) engagé(s)` : ""}. Chronologie complète et carte sur kanari.`,
    alternates: { canonical: `/fr/feu/${f.slug}` },
    robots: { index: true, follow: true },
  };
}

export default async function FirePage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!isValidLang(lang)) notFound();
  if (lang !== "fr") redirect(`/fr/feu/${slug}`);
  const f = await getFireBySlug(slug);
  if (!f) notFound();

  const deptName = f.dept_slug ? DEPT_BY_SLUG.get(f.dept_slug)?.name : null;
  const active = f.status === "active";
  const lastAgeH = (Date.now() - new Date(f.last_seen).getTime()) / 3_600_000;
  const title = titleOf(f);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${title} — ${frDate(f.first_seen)}`,
    datePublished: f.first_seen,
    dateModified: f.updated_at ?? f.last_seen,
    inLanguage: "fr",
    author: { "@type": "Organization", name: "kanari", url: "https://kanari.io" },
    publisher: { "@id": "https://kanari.io/#org" },
    mainEntityOfPage: `https://kanari.io/fr/feu/${f.slug}`,
  };

  const timeline: { label: string; value: string; color: string }[] = [
    { label: "Première détection", value: frDateTime(f.first_seen), color: "var(--ember)" },
    ...(f.first_press
      ? [{ label: "Premier article de presse repéré", value: frDateTime(f.first_press), color: "#4A90C2" }]
      : []),
    { label: "Dernier signal satellite", value: frDateTime(f.last_seen), color: active ? "#D64545" : "#8A8880" },
  ];

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <article className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <p className="mb-1 text-[13px]" style={{ color: "var(--ink-3)" }}>
          <Link href="/fr/feu" style={{ color: "var(--link)" }}>Historique des feux</Link>
          {f.dept_slug && deptName && (
            <> · <Link href={`/fr/feux/${f.dept_slug}`} style={{ color: "var(--link)" }}>Feux en {deptName}</Link></>
          )}
        </p>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span
            className="flex h-[24px] items-center rounded-full px-3 text-[12px] font-bold"
            style={
              active
                ? { background: "var(--danger-soft)", color: "#9C2B2B" }
                : { background: "var(--paper-2)", color: "var(--ink-2)" }
            }
          >
            {active
              ? lastAgeH < 6
                ? "EN COURS"
                : "ACTIF RÉCEMMENT"
              : "TERMINÉ / PLUS DÉTECTÉ"}
          </span>
          {f.confidence === "corrobore" && (
            <span className="flex h-[24px] items-center rounded-full px-3 text-[12px] font-bold" style={{ background: "var(--safe-soft)", color: "#22684A" }}>
              corroboré par témoins
            </span>
          )}
        </div>
        <h1 className="mb-2" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          {flag(f.country)} {title}
        </h1>
        <p className="mb-6 text-[14px]" style={{ color: "var(--ink-3)" }}>
          Détecté le {frDate(f.first_seen)} · position {f.lat.toFixed(3)}, {f.lon.toFixed(3)}
          {f.admin && !deptName ? ` · ${f.admin}` : ""}
        </p>

        {/* Chiffres clés */}
        <div className="mb-6 flex flex-wrap gap-3">
          <div className="rounded-[18px] px-5 py-3.5" style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: "var(--ink)" }}>{f.detections}</div>
            <div className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>détections satellite</div>
          </div>
          <div className="rounded-[18px] px-5 py-3.5" style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: "var(--ink)" }}>{Math.round(f.max_frp)} MW</div>
            <div className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>puissance radiative max</div>
          </div>
          {f.post_count > 0 && (
            <div className="rounded-[18px] px-5 py-3.5" style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: "var(--ink)" }}>{f.post_count}</div>
              <div className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>témoignages publics</div>
            </div>
          )}
        </div>

        <Link
          href={`/fr?lat=${f.lat.toFixed(3)}&lon=${f.lon.toFixed(3)}&z=10`}
          className="mb-7 flex h-[50px] items-center justify-center rounded-full text-[15px] font-semibold"
          style={{ background: "var(--canary)", color: "var(--charcoal)", boxShadow: "var(--shadow-m)" }}
        >
          Voir la zone sur la carte en direct →
        </Link>

        {/* Chronologie */}
        <section className="mb-7">
          <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            Chronologie
          </h2>
          <div className="flex flex-col gap-2.5">
            {timeline.map((t) => (
              <div key={t.label} className="flex items-center gap-3 rounded-[14px] px-4 py-3" style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}>
                <span className="h-[9px] w-[9px] shrink-0 rounded-full" style={{ background: t.color }} />
                <span className="flex-1 text-[14px]" style={{ color: "var(--ink)" }}>{t.label}</span>
                <span className="text-[13px]" style={{ color: "var(--ink-2)" }}>{t.value}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[12.5px]" style={{ color: "var(--ink-3)" }}>
            Sources : {f.viirs > 0 ? `VIIRS (${f.viirs})` : ""}{f.goes > 0 ? ` · GOES (${f.goes})` : ""}{f.mtg > 0 ? ` · Meteosat MTG (${f.mtg})` : ""} — heures de Paris.
          </p>
        </section>

        {/* Moyens aériens */}
        {f.aircraft.length > 0 && (
          <section className="mb-7">
            <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
              Moyens aériens observés sur zone
            </h2>
            <div className="flex flex-col gap-2">
              {f.aircraft.map((a, i) => (
                <div key={`${a.id}-${a.day}-${i}`} className="flex items-center gap-3 rounded-[14px] px-4 py-3" style={{ background: "var(--white)", boxShadow: "var(--shadow-s)" }}>
                  <span style={{ fontSize: 17 }}>{a.model.includes("hélico") ? "🚁" : "🛩️"}</span>
                  <span className="flex-1 text-[14px]" style={{ color: "var(--ink)" }}>
                    {flag(a.country)} {a.model} {a.callsign ? `· ${a.callsign}` : ""}
                  </span>
                  <span className="text-[12.5px]" style={{ color: "var(--ink-3)" }}>{frDate(a.day)}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[12.5px]" style={{ color: "var(--ink-3)" }}>
              Appareils détectés en ADS-B à moins de 40 km du foyer pendant son activité —
              voir <Link href="/fr/canadair" style={{ color: "var(--link)" }}>les Canadair en direct</Link>.
            </p>
          </section>
        )}

        <section className="mb-7 text-[14.5px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          <h2 className="mb-2 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            D'où viennent ces données ?
          </h2>
          <p>
            Cette page est générée et mise à jour automatiquement par kanari à partir des
            détections thermiques satellites (NASA FIRMS/VIIRS, GOES, Meteosat MTG) et des
            témoignages publics vérifiés par IA. Les surfaces brûlées et bilans officiels
            relèvent des autorités : cette chronologie documente ce que les capteurs ont vu,
            au moment où ils l'ont vu.
          </p>
        </section>

        <p className="mt-8 border-t pt-4 text-[12.5px]" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
          kanari est un service d'information indépendant et gratuit, pas un canal d'alerte
          officiel. En cas d'urgence : 18 ou 112. Page mise à jour le {frDateTime(f.updated_at ?? f.last_seen)}.
        </p>
      </article>
    </div>
  );
}
