import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidLang, type Lang } from "@/lib/i18n";
import { getIssue, periodLabel, ISSUE_LOCALE, fmtDeltaMin, type NewsletterIssue } from "@/lib/newsletter";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { SiteFooter } from "@/components/SiteFooter";

// Un numéro de la newsletter = une page permanente et indexable. Le contenu
// est régénéré depuis l'objet stocké (pas de HTML figé) : les 4 langues
// partagent les mêmes chiffres.
export const revalidate = 3600;

const D: Record<Lang, {
  kicker: string;
  h: (n: string) => string;
  inCountries: (c: string, aircraft: string, corr: string) => string;
  vsPrev: (pct: string) => string;
  topTitle: string;
  topText: (place: string, mw: string, det: string) => string;
  topLink: string;
  earlyTitle: string;
  earlyText: (n: number, median: string | null, place: string, lead: string) => string;
  earlyLink: string;
  backArchive: string;
  subscribeNudge: string;
}> = {
  fr: {
    kicker: "Le bilan des feux de forêt",
    h: (n) => `${n} départs de feu détectés`,
    inCountries: (c, a, corr) => `dans ${c} pays. ${a} foyers avec des moyens aériens observés sur zone, ${corr} corroborés par des témoignages vérifiés.`,
    vsPrev: (pct) => `${pct} par rapport à la période précédente.`,
    topTitle: "Le feu de la période",
    topText: (place, mw, det) => `${place} : ${mw} MW de puissance radiative maximale, ${det} détections satellite.`,
    topLink: "Voir sa page permanente",
    earlyTitle: "Vu avant la presse",
    earlyText: (n, median, place, lead) =>
      `${n} foyer${n > 1 ? "s" : ""} détecté${n > 1 ? "s" : ""} avant le premier article de presse${median ? ` (avance médiane ${median})` : ""}. Record : ${place}, ${lead} d'avance.`,
    earlyLink: "La méthodologie de la précocité",
    backArchive: "Tous les numéros",
    subscribeNudge: "Recevez le prochain bilan directement par e-mail :",
  },
  en: {
    kicker: "The wildfire digest",
    h: (n) => `${n} fire starts detected`,
    inCountries: (c, a, corr) => `across ${c} countries. ${a} fires with firefighting aircraft observed on zone, ${corr} corroborated by verified witness reports.`,
    vsPrev: (pct) => `${pct} versus the previous period.`,
    topTitle: "Fire of the period",
    topText: (place, mw, det) => `${place}: ${mw} MW peak radiative power, ${det} satellite detections.`,
    topLink: "View its permanent page",
    earlyTitle: "Seen before the press",
    earlyText: (n, median, place, lead) =>
      `${n} fire${n > 1 ? "s" : ""} detected before the first press article${median ? ` (median lead ${median})` : ""}. Record: ${place}, ${lead} ahead.`,
    earlyLink: "The earliness methodology",
    backArchive: "All issues",
    subscribeNudge: "Get the next digest straight to your inbox:",
  },
  es: {
    kicker: "El resumen de incendios",
    h: (n) => `${n} incendios detectados`,
    inCountries: (c, a, corr) => `en ${c} países. ${a} focos con medios aéreos observados en la zona, ${corr} corroborados por testimonios verificados.`,
    vsPrev: (pct) => `${pct} respecto al período anterior.`,
    topTitle: "El incendio del período",
    topText: (place, mw, det) => `${place}: ${mw} MW de potencia radiativa máxima, ${det} detecciones satelitales.`,
    topLink: "Ver su página permanente",
    earlyTitle: "Visto antes que la prensa",
    earlyText: (n, median, place, lead) =>
      `${n} foco${n > 1 ? "s" : ""} detectado${n > 1 ? "s" : ""} antes del primer artículo de prensa${median ? ` (ventaja mediana ${median})` : ""}. Récord: ${place}, ${lead} de ventaja.`,
    earlyLink: "La metodología de la precocidad",
    backArchive: "Todos los números",
    subscribeNudge: "Recibe el próximo resumen directamente en tu correo:",
  },
  pt: {
    kicker: "O resumo de incêndios",
    h: (n) => `${n} incêndios detectados`,
    inCountries: (c, a, corr) => `em ${c} países. ${a} focos com meios aéreos observados na zona, ${corr} corroborados por testemunhos verificados.`,
    vsPrev: (pct) => `${pct} em relação ao período anterior.`,
    topTitle: "O incêndio do período",
    topText: (place, mw, det) => `${place}: ${mw} MW de potência radiativa máxima, ${det} detecções de satélite.`,
    topLink: "Ver sua página permanente",
    earlyTitle: "Visto antes da imprensa",
    earlyText: (n, median, place, lead) =>
      `${n} foco${n > 1 ? "s" : ""} detectado${n > 1 ? "s" : ""} antes do primeiro artigo de imprensa${median ? ` (vantagem mediana ${median})` : ""}. Recorde: ${place}, ${lead} de vantagem.`,
    earlyLink: "A metodologia da precocidade",
    backArchive: "Todas as edições",
    subscribeNudge: "Receba o próximo resumo direto no seu e-mail:",
  },
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string; slug: string }> }) {
  const { lang, slug } = await params;
  const l: Lang = isValidLang(lang) ? lang : "en";
  const issue = await getIssue(slug);
  if (!issue) return { title: "kanari" };
  const label = periodLabel(issue, l);
  const n = issue.total.toLocaleString(ISSUE_LOCALE[l]);
  const titles: Record<Lang, string> = {
    fr: `Bilan feux de forêt ${label} : ${n} départs — kanari`,
    en: `Wildfire digest ${label}: ${n} fire starts — kanari`,
    es: `Resumen de incendios ${label}: ${n} focos — kanari`,
    pt: `Resumo de incêndios ${label}: ${n} focos — kanari`,
  };
  const path = `/newsletter/${slug}`;
  return {
    title: titles[l],
    description: D[l].inCountries(
      String(issue.countries) + (issue.countriesTruncated ? "+" : ""),
      issue.withAircraft.toLocaleString(ISSUE_LOCALE[l]),
      issue.corroborated.toLocaleString(ISSUE_LOCALE[l])
    ),
    alternates: {
      canonical: `/${l}${path}`,
      languages: Object.fromEntries((["fr", "en", "es", "pt"] as const).map((x) => [x, `/${x}${path}`])),
    },
  };
}

function jsonLd(issue: NewsletterIssue, lang: Lang) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: `${D[lang].kicker} ${periodLabel(issue, lang)}`,
    datePublished: issue.sentAt,
    inLanguage: lang,
    author: { "@type": "Organization", name: "kanari", url: "https://kanari.io" },
    publisher: { "@type": "Organization", name: "kanari", url: "https://kanari.io" },
    mainEntityOfPage: `https://kanari.io/${lang}/newsletter/${issue.slug}`,
    license: "https://creativecommons.org/licenses/by/4.0/",
  };
}

export default async function NewsletterIssuePage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  if (!isValidLang(lang)) notFound();
  const issue = await getIssue(slug);
  if (!issue) notFound();
  const t = D[lang];
  const loc = ISSUE_LOCALE[lang];
  const deltaPct =
    issue.prevTotal > 0 ? Math.round(((issue.total - issue.prevTotal) / issue.prevTotal) * 100) : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl px-6 py-12" style={{ color: "var(--ink-2)" }}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd(issue, lang)) }}
        />
        <p className="mb-1 text-[13px] font-medium uppercase tracking-wide" style={{ color: "var(--ink-3)" }}>
          {t.kicker} · {periodLabel(issue, lang)}
        </p>
        <h1 className="mb-4" style={{ fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          {t.h(issue.total.toLocaleString(loc))}
        </h1>
        <p className="mb-2 text-[15px] leading-relaxed">
          {t.inCountries(
            String(issue.countries) + (issue.countriesTruncated ? "+" : ""),
            issue.withAircraft.toLocaleString(loc),
            issue.corroborated.toLocaleString(loc)
          )}
          {deltaPct !== null && (
            <> {t.vsPrev(`${deltaPct >= 0 ? "+" : ""}${deltaPct} %`)}</>
          )}
        </p>

        {issue.topFire && (
          <section className="mt-6">
            <h2 style={{ fontSize: "var(--text-h3)", color: "var(--ink)" }}>{t.topTitle}</h2>
            <p className="mt-2 text-[15px] leading-relaxed">
              {t.topText(
                `${issue.topFire.place ?? "?"}${issue.topFire.country ? ` (${issue.topFire.country})` : ""}`,
                issue.topFire.maxFrp.toLocaleString(loc),
                issue.topFire.detections.toLocaleString(loc)
              )}{" "}
              <Link href={`/${lang === "fr" ? "fr" : lang}/feu/${issue.topFire.slug}`} style={{ color: "var(--link)" }}>
                {t.topLink}
              </Link>
              .
            </p>
          </section>
        )}

        {issue.earliness && issue.earliness.bestPlace && issue.earliness.bestDeltaMin != null && (
          <section className="mt-6">
            <h2 style={{ fontSize: "var(--text-h3)", color: "var(--ink)" }}>{t.earlyTitle}</h2>
            <p className="mt-2 text-[15px] leading-relaxed">
              {t.earlyText(
                issue.earliness.cases,
                issue.earliness.medianMin != null ? fmtDeltaMin(issue.earliness.medianMin) : null,
                issue.earliness.bestPlace,
                fmtDeltaMin(issue.earliness.bestDeltaMin)
              )}{" "}
              <Link href={`/${lang}/precocite`} style={{ color: "var(--link)" }}>
                {t.earlyLink}
              </Link>
              .
            </p>
          </section>
        )}

        <div className="mt-8">
          <p className="mb-2 text-[13.5px]" style={{ color: "var(--ink-3)" }}>
            {t.subscribeNudge}
          </p>
          <NewsletterSignup lang={lang} variant="page" compact />
        </div>

        <p className="mt-8 text-[13.5px]">
          <Link href={`/${lang}/newsletter`} style={{ color: "var(--link)" }}>
            ← {t.backArchive}
          </Link>
        </p>
        <SiteFooter lang={lang} />
      </div>
    </div>
  );
}
