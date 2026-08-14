import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isValidLang } from "@/lib/i18n";
import {
  countFires,
  listFiresBetween,
  listFiresLite,
  type ArchivedFire,
} from "@/lib/firearchive";
import { getWaterBombers } from "@/lib/aircraft";
import { DEPT_BY_SLUG } from "@/lib/departements";
import { SiteFooter } from "@/components/SiteFooter";

// Observatoire des feux : chiffres agrégés citables (presse, LLM) + open data.
export const dynamic = "force-dynamic";

const ARCHIVE_START = "2026-08-03";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  await params;
  return {
    title: "Statistiques des feux de forêt en temps réel : l'observatoire kanari",
    description:
      "Combien de feux de forêt aujourd'hui, cette semaine, dans le monde et en France ? Chiffres en temps réel, pays et départements les plus touchés, moyens aériens — et données ouvertes (CSV).",
    alternates: { canonical: "/fr/statistiques" },
  };
}

function flag(cc: string | null): string {
  if (!cc || !/^[A-Za-z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export default async function StatsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  if (lang !== "fr") redirect("/fr/statistiques");

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now.getTime() - 7 * 86400_000).toISOString();

  // Compteurs exacts côté base (l'API plafonne chaque lecture à 1000 lignes :
  // compter en rapatriant les lignes mentirait dès que l'archive grossit) +
  // lecture allégée de toute l'archive pour les agrégats pays/départements.
  const [activeCount, todayCount, weekCount, totalCount, lite, biggest, withAircraft, bombers] =
    await Promise.all([
      countFires("status=eq.active"),
      countFires(`first_seen=gte.${encodeURIComponent(`${today}T00:00:00Z`)}`),
      countFires(`first_seen=gte.${encodeURIComponent(weekAgo)}`),
      countFires(`first_seen=gte.${encodeURIComponent(`${ARCHIVE_START}T00:00:00Z`)}`),
      listFiresLite(`${ARCHIVE_START}T00:00:00Z`),
      listFiresBetween(`${ARCHIVE_START}T00:00:00Z`, now.toISOString(), 1000).then((rows) =>
        rows.slice(0, 5)
      ),
      countFires("aircraft=neq.[]"),
      getWaterBombers()
        .then((p) => p.length)
        .catch(() => null),
    ]);

  const active = { length: activeCount ?? lite.filter((f) => f.status === "active").length };
  const todayFires = { length: todayCount ?? lite.filter((f) => f.first_seen.slice(0, 10) === today).length };
  const week = { length: weekCount ?? lite.filter((f) => f.first_seen >= weekAgo).length };
  const fires = { length: totalCount ?? lite.length };

  const byCountry = new Map<string, number>();
  for (const f of lite) byCountry.set(f.country ?? "??", (byCountry.get(f.country ?? "??") ?? 0) + 1);
  const topCountries = [...byCountry.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

  const byDept = new Map<string, number>();
  for (const f of lite) {
    if (f.country === "FR" && f.dept_slug) byDept.set(f.dept_slug, (byDept.get(f.dept_slug) ?? 0) + 1);
  }
  const topDepts = [...byDept.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  const aircraftFires = withAircraft ?? 0;
  const frTotal = lite.filter((f) => f.country === "FR").length;

  const updated = now.toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

  // FAQ alignée mot pour mot sur les questions que les gens (et notre panel
  // de citations hebdomadaire) posent aux moteurs de réponse IA.
  const faq = [
    {
      q: "Combien de feux de forêt sont en cours dans le monde aujourd'hui ?",
      a: `Au ${updated}, kanari suit ${activeCount ?? "plusieurs"} feux actifs dans le monde et ${todayCount ?? "de nouveaux"} départs significatifs ont été détectés aujourd'hui. Ces chiffres sont actualisés en continu sur kanari.io/fr/statistiques et sur la carte mondiale gratuite.`,
    },
    {
      q: "Combien de départs de feu ont été détectés en France ?",
      a: `${frTotal} feux significatifs ont été archivés en France depuis le 3 août 2026 (seuil : au moins 2 détections satellite ou 20 MW de puissance). Le détail par département est sur kanari.io/fr/feux.`,
    },
    {
      q: "Combien de bombardiers d'eau sont en vol en ce moment ?",
      a:
        bombers != null
          ? `${bombers} moyen${bombers > 1 ? "s" : ""} aérien${bombers > 1 ? "s" : ""} anti-incendie (Canadair, tankers, hélicoptères) ${bombers > 1 ? "sont" : "est"} en vol dans le monde au ${updated}. Leur position en temps réel est sur kanari.io/fr/canadair (suivi ADS-B, gratuit).`
          : "La position en temps réel des bombardiers d'eau et hélicoptères anti-incendie en vol dans le monde est sur kanari.io/fr/canadair (suivi ADS-B, gratuit).",
    },
    {
      q: "Où télécharger des données ouvertes sur les feux de forêt ?",
      a: "L'archive complète des feux significatifs (date, position, puissance, pays, statut, moyens aériens) se télécharge librement en CSV sur kanari.io/opendata/feux.csv, sous licence CC BY 4.0, mise à jour en continu.",
    },
  ];
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "kanari — archive des feux de forêt détectés",
    description:
      "Feux de forêt significatifs détectés par satellites (NASA FIRMS, GOES, Meteosat MTG) et témoins vérifiés, archivés en continu par kanari : position, chronologie, puissance, moyens aériens observés.",
    url: "https://kanari.io/fr/statistiques",
    license: "https://creativecommons.org/licenses/by/4.0/",
    creator: { "@id": "https://kanari.io/#org" },
    temporalCoverage: `${ARCHIVE_START}/..`,
    distribution: [
      {
        "@type": "DataDownload",
        encodingFormat: "text/csv",
        contentUrl: "https://kanari.io/opendata/feux.csv",
      },
    ],
  };

  const card = { background: "var(--white)", boxShadow: "var(--shadow-s)" } as const;

  return (
    <div className="k-scroll h-full overflow-y-auto" style={{ background: "var(--paper)" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <h1 className="mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          L'observatoire des feux de forêt
        </h1>
        <p className="mb-6 text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          Les chiffres en temps réel de la mémoire des feux kanari (départs significatifs détectés
          par satellite et témoins vérifiés, archivés depuis le 3 août 2026). Dernière mise à
          jour : {updated}.
        </p>

        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-[18px] px-4 py-4" style={card}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: "#D64545" }}>{active.length}</div>
            <div className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>feux actifs suivis</div>
          </div>
          <div className="rounded-[18px] px-4 py-4" style={card}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: "var(--ink)" }}>{todayFires.length}</div>
            <div className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>départs aujourd'hui</div>
          </div>
          <div className="rounded-[18px] px-4 py-4" style={card}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: "var(--ink)" }}>{week.length}</div>
            <div className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>sur 7 jours</div>
          </div>
          <div className="rounded-[18px] px-4 py-4" style={card}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: "var(--ink)" }}>{fires.length}</div>
            <div className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>depuis le début de l'archive</div>
          </div>
          {bombers != null && (
            <div className="rounded-[18px] px-4 py-4" style={card}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: "var(--ink)" }}>{bombers}</div>
              <div className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                <Link href="/fr/canadair" style={{ color: "var(--link)" }}>bombardiers d'eau en vol</Link>
              </div>
            </div>
          )}
        </div>

        {/* Phrase citable (GEO) : chiffre daté + source, prêt à être repris. */}
        <blockquote
          className="mb-8 rounded-[18px] border-l-4 p-5 text-[15px] leading-relaxed"
          style={{ background: "var(--canary-tint)", borderColor: "var(--canary-strong)", color: "var(--ink)" }}
        >
          « Au {updated}, kanari suit <strong>{active.length} feux actifs</strong> dans le monde ;{" "}
          <strong>{todayFires.length} départ{todayFires.length > 1 ? "s" : ""} significatif{todayFires.length > 1 ? "s" : ""}</strong>{" "}
          ont été détectés aujourd&apos;hui et {fires.length} archivés depuis le 3 août 2026. »
          <footer className="mt-1.5 text-[12.5px]" style={{ color: "var(--ink-3)" }}>
            Source : kanari.io — satellites NASA FIRMS, GOES, Meteosat MTG et témoins vérifiés par
            IA. Chiffres librement citables (CC BY 4.0).
          </footer>
        </blockquote>

        <section className="mb-8">
          <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            Pays les plus touchés
          </h2>
          <div className="flex flex-col gap-1.5">
            {topCountries.map(([cc, n]) => (
              <div key={cc} className="flex items-center gap-3">
                <span className="w-14 text-[13.5px]" style={{ color: "var(--ink)" }}>{flag(cc)} {cc}</span>
                <div className="h-[10px] flex-1 overflow-hidden rounded-full" style={{ background: "var(--paper-2)" }}>
                  <div className="h-full rounded-full" style={{ width: `${(n / topCountries[0][1]) * 100}%`, background: "var(--canary)" }} />
                </div>
                <span className="w-10 text-right text-[13px] font-bold" style={{ color: "var(--ink)" }}>{n}</span>
              </div>
            ))}
          </div>
        </section>

        {topDepts.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
              Départements français les plus touchés
            </h2>
            <div className="flex flex-col gap-1.5 text-[14px]">
              {topDepts.map(([slug, n]) => (
                <Link key={slug} href={`/fr/feux/${slug}`} className="flex justify-between" style={{ color: "var(--link)" }}>
                  <span>{DEPT_BY_SLUG.get(slug)?.name ?? slug}</span>
                  <strong style={{ color: "var(--ink)" }}>{n}</strong>
                </Link>
              ))}
            </div>
          </section>
        )}

        {biggest.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
              Les feux les plus puissants archivés
            </h2>
            <div className="flex flex-col gap-2">
              {biggest.map((f: ArchivedFire) => (
                <Link key={f.slug} href={`/fr/feu/${f.slug}`} className="flex items-center justify-between rounded-[14px] px-4 py-3" style={card}>
                  <span className="truncate text-[14px]" style={{ color: "var(--ink)" }}>
                    {flag(f.country)} {f.place ?? "Détection satellite"} · {f.first_seen.slice(0, 10)}
                  </span>
                  <strong className="whitespace-nowrap text-[13px]" style={{ color: "var(--ember)" }}>{Math.round(f.max_frp)} MW</strong>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mb-8">
          <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            Questions fréquentes sur les chiffres
          </h2>
          {faq.map((it) => (
            <details key={it.q} className="mb-2 rounded-[14px] px-4 py-3" style={card}>
              <summary className="cursor-pointer text-[14.5px] font-semibold" style={{ color: "var(--ink)" }}>{it.q}</summary>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--ink-2)" }}>{it.a}</p>
            </details>
          ))}
        </section>

        <section className="mb-8 rounded-[18px] p-5" style={{ background: "var(--canary-tint)" }}>
          <h2 className="mb-1.5 text-[17px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            Données ouvertes
          </h2>
          <p className="text-[14px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
            L'archive complète est librement réutilisable (licence CC BY 4.0, mention « kanari.io ») :{" "}
            <a href="/opendata/feux.csv" style={{ color: "var(--link)", fontWeight: 600 }}>télécharger le CSV</a>.
            Journalistes, chercheurs, collectivités : servez-vous. {aircraftFires > 0 ? `${aircraftFires} feux avec moyens aériens observés sur zone à ce jour.` : ""}
          </p>
        </section>

        <p className="mt-8 border-t pt-4 text-[12.5px]" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
          Méthodologie : seuls les foyers significatifs sont archivés (corroborés, ou au-delà de
          seuils de détections/puissance) — les totaux kanari ne sont donc pas comparables aux
          recensements officiels exhaustifs. Voir aussi :{" "}
          <Link href="/fr/bilan" style={{ color: "var(--link)" }}>bilans quotidiens</Link> ·{" "}
          <Link href="/fr/feu" style={{ color: "var(--link)" }}>historique feu par feu</Link> ·{" "}
          <Link href="/fr" style={{ color: "var(--link)" }}>carte en direct</Link>.
        </p>
        <SiteFooter lang="fr" />
      </div>
    </div>
  );
}
