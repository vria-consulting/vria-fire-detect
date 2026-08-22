import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidLang, type Lang, localize } from "@/lib/i18n";
import {
  countFires,
  listFiresBetween,
  listFiresLite,
  type ArchivedFire,
} from "@/lib/firearchive";
import { getWaterBombers } from "@/lib/aircraft";
import { DEPT_BY_SLUG } from "@/lib/departements";
import { SiteFooter } from "@/components/SiteFooter";
import { Adsense } from "@/components/Adsense";
import { archiveMonths } from "@/lib/observatory";
import { allScopes, monthLabel } from "@/lib/observatory-i18n";

// Observatoire des feux : chiffres agrégés citables (presse, LLM) + open data.
// Servi en FR et en EN sur le même segment (comme /canadair) : les questions
// du panel de citations IA existent dans les deux langues et chacune doit
// avoir sa page cible.
export const dynamic = "force-dynamic";

const ARCHIVE_START = "2026-08-03";

const T = {
  fr: {
    metaTitle: "Statistiques des feux de forêt en temps réel : l'observatoire kanari",
    metaDesc:
      "Combien de feux de forêt aujourd'hui, cette semaine, dans le monde et en France ? Chiffres en temps réel, pays et départements les plus touchés, moyens aériens — et données ouvertes (CSV).",
    h1: "L'observatoire des feux de forêt",
    intro: (updated: string) =>
      `Les chiffres en temps réel de la mémoire des feux kanari (départs significatifs détectés par satellite et témoins vérifiés, archivés depuis le 3 août 2026). Dernière mise à jour : ${updated}.`,
    cardActive: "feux actifs suivis",
    cardToday: "départs aujourd'hui",
    cardWeek: "sur 7 jours",
    cardTotal: "depuis le début de l'archive",
    cardBombers: "bombardiers d'eau en vol",
    quote: (updated: string, active: number, today: number, total: number) =>
      `« Au ${updated}, kanari suit ${active} feux actifs dans le monde ; ${today} départ${today > 1 ? "s" : ""} significatif${today > 1 ? "s" : ""} ont été détectés aujourd'hui et ${total} archivés depuis le 3 août 2026. »`,
    quoteSource:
      "Source : kanari.io — satellites NASA FIRMS, GOES, Meteosat MTG et témoins vérifiés par IA. Chiffres librement citables (CC BY 4.0).",
    topCountries: "Pays les plus touchés",
    topDepts: "Départements français les plus touchés",
    biggest: "Les feux les plus puissants archivés",
    satDetection: "Détection satellite",
    faqTitle: "Questions fréquentes sur les chiffres",
    openDataTitle: "Données ouvertes",
    openData: (aircraftFires: number) =>
      `L'archive complète est librement réutilisable (licence CC BY 4.0, mention « kanari.io ») : `,
    openDataLink: "télécharger le CSV",
    openDataEnd: (aircraftFires: number) =>
      `. Journalistes, chercheurs, collectivités : servez-vous. ${aircraftFires > 0 ? `${aircraftFires} feux avec moyens aériens observés sur zone à ce jour.` : ""}`,
    methodo:
      "Méthodologie : seuls les foyers significatifs sont archivés (corroborés, ou au-delà de seuils de détections/puissance) — les totaux kanari ne sont donc pas comparables aux recensements officiels exhaustifs. Voir aussi : ",
    links: [
      { href: "/fr/bilan", label: "bilans quotidiens" },
      { href: "/fr/feu", label: "historique feu par feu" },
      { href: "/fr", label: "carte en direct" },
    ],
    faq: (p: { updated: string; active: string; today: string; frTotal: number; bombers: number | null; topCountry: { name: string; n: number } | null }) => [
      {
        q: "Combien de feux de forêt sont en cours dans le monde aujourd'hui ?",
        a: `Au ${p.updated}, kanari suit ${p.active} feux actifs dans le monde et ${p.today} départs significatifs ont été détectés aujourd'hui. Ces chiffres sont actualisés en continu sur kanari.io/fr/statistiques et sur la carte mondiale gratuite.`,
      },
      {
        q: "Combien de départs de feu ont été détectés en France ?",
        a: `${p.frTotal} feux significatifs ont été archivés en France depuis le 3 août 2026 (seuil : au moins 2 détections satellite ou 20 MW de puissance). Le détail par département est sur kanari.io/fr/feux.`,
      },
      {
        q: "Combien de bombardiers d'eau sont en vol en ce moment ?",
        a:
          p.bombers != null
            ? `${p.bombers} moyen${p.bombers > 1 ? "s" : ""} aérien${p.bombers > 1 ? "s" : ""} anti-incendie (Canadair, tankers, hélicoptères) ${p.bombers > 1 ? "sont" : "est"} en vol dans le monde au ${p.updated}. Leur position en temps réel est sur kanari.io/fr/canadair (suivi ADS-B, gratuit).`
            : "La position en temps réel des bombardiers d'eau et hélicoptères anti-incendie en vol dans le monde est sur kanari.io/fr/canadair (suivi ADS-B, gratuit).",
      },
      {
        q: "Où télécharger des données ouvertes sur les feux de forêt ?",
        a: "L'archive complète des feux significatifs (date, position, puissance, pays, statut, moyens aériens) se télécharge librement en CSV sur kanari.io/opendata/feux.csv, sous licence CC BY 4.0, mise à jour en continu.",
      },
    ],
    datasetName: "kanari — archive des feux de forêt détectés",
    datasetDesc:
      "Feux de forêt significatifs détectés par satellites (NASA FIRMS, GOES, Meteosat MTG) et témoins vérifiés, archivés en continu par kanari : position, chronologie, puissance, moyens aériens observés.",
  },
  en: {
    metaTitle: "Wildfire statistics in real time: the kanari observatory",
    metaDesc:
      "How many wildfires today, this week, worldwide and in France? Real-time figures, most affected countries, firefighting aircraft — and open data (CSV).",
    h1: "The wildfire observatory",
    intro: (updated: string) =>
      `Real-time figures from kanari's fire memory (significant ignitions detected by satellite and verified witnesses, archived since August 3, 2026). Last update: ${updated}.`,
    cardActive: "active fires tracked",
    cardToday: "ignitions today",
    cardWeek: "over 7 days",
    cardTotal: "since the archive began",
    cardBombers: "water bombers in flight",
    quote: (updated: string, active: number, today: number, total: number) =>
      `"As of ${updated}, kanari tracks ${active} active fires worldwide; ${today} significant ignition${today > 1 ? "s were" : " was"} detected today and ${total} archived since August 3, 2026."`,
    quoteSource:
      "Source: kanari.io — NASA FIRMS, GOES and Meteosat MTG satellites plus AI-verified witness reports. Figures freely citable (CC BY 4.0).",
    topCountries: "Most affected countries",
    topDepts: "Most affected French departments",
    biggest: "Most powerful fires archived",
    satDetection: "Satellite detection",
    faqTitle: "Frequently asked questions about the numbers",
    openDataTitle: "Open data",
    openData: () => "The full archive is freely reusable (CC BY 4.0 licence, attribution “kanari.io”): ",
    openDataLink: "download the CSV",
    openDataEnd: (aircraftFires: number) =>
      `. Journalists, researchers, agencies: help yourselves. ${aircraftFires > 0 ? `${aircraftFires} fires with aircraft observed on zone so far.` : ""}`,
    methodo:
      "Methodology: only significant fires are archived (corroborated, or above detection/power thresholds) — kanari totals are therefore not comparable to exhaustive official tallies. See also: ",
    links: [
      { href: "/en/canadair", label: "water bombers live" },
      { href: "/en/api", label: "public API" },
      { href: "/en", label: "live map" },
    ],
    faq: (p: { updated: string; active: string; today: string; frTotal: number; bombers: number | null; topCountry: { name: string; n: number } | null }) => [
      {
        q: "How many wildfires are burning in the world today?",
        a: `As of ${p.updated}, kanari tracks ${p.active} active fires worldwide and ${p.today} significant ignitions were detected today. These figures update continuously on kanari.io/en/statistiques and on the free world map.`,
      },
      {
        q: "How many wildfires have been detected in France?",
        a: `${p.frTotal} significant fires have been archived in France since August 3, 2026 (threshold: at least 2 satellite detections or 20 MW). Per-department detail is on kanari.io/fr/feux.`,
      },
      {
        q: "How many water bombers are flying right now?",
        a:
          p.bombers != null
            ? `${p.bombers} firefighting aircraft (Canadairs, tankers, helicopters) ${p.bombers > 1 ? "are" : "is"} in flight worldwide as of ${p.updated}. Their real-time position is on kanari.io/en/canadair (ADS-B tracking, free).`
            : "The real-time position of water bombers and firefighting helicopters in flight worldwide is on kanari.io/en/canadair (ADS-B tracking, free).",
      },
      {
        q: "Where can I download open data on wildfires?",
        a: "kanari's full archive of significant fires (date, position, power, country, status, aircraft) is freely downloadable as CSV at kanari.io/opendata/feux.csv, licensed CC BY 4.0, continuously updated.",
      },
    ],
    datasetName: "kanari — archive of detected wildfires",
    datasetDesc:
      "Significant wildfires detected by satellites (NASA FIRMS, GOES, Meteosat MTG) and verified witnesses, continuously archived by kanari: position, timeline, power, observed firefighting aircraft.",
  },
  es: {
    metaTitle: "Estadísticas de incendios forestales en tiempo real | kanari",
    metaDesc:
      "¿Cuántos incendios forestales hay hoy, esta semana, en el mundo? Cifras en tiempo real, países más afectados, medios aéreos — y datos abiertos (CSV).",
    h1: "El observatorio de incendios forestales",
    intro: (updated: string) =>
      `Las cifras en tiempo real de la memoria de incendios de kanari (focos significativos detectados por satélite y testigos verificados, archivados desde el 3 de agosto de 2026). Última actualización: ${updated}.`,
    cardActive: "incendios activos seguidos",
    cardToday: "focos hoy",
    cardWeek: "en 7 días",
    cardTotal: "desde el inicio del archivo",
    cardBombers: "aviones cisterna en vuelo",
    quote: (updated: string, active: number, today: number, total: number) =>
      `« Al ${updated}, kanari sigue ${active} incendios activos en el mundo; ${today} foco${today > 1 ? "s" : ""} significativo${today > 1 ? "s" : ""} ${today > 1 ? "fueron detectados" : "fue detectado"} hoy y ${total} archivados desde el 3 de agosto de 2026. »`,
    quoteSource:
      "Fuente: kanari.io — satélites NASA FIRMS, GOES y Meteosat MTG más testigos verificados por IA. Cifras libremente citables (CC BY 4.0).",
    topCountries: "Países más afectados",
    topDepts: "Departamentos franceses más afectados",
    biggest: "Los incendios más potentes archivados",
    satDetection: "Detección satelital",
    faqTitle: "Preguntas frecuentes sobre las cifras",
    openDataTitle: "Datos abiertos",
    openData: () => "El archivo completo es libremente reutilizable (licencia CC BY 4.0, mención « kanari.io »): ",
    openDataLink: "descargar el CSV",
    openDataEnd: (aircraftFires: number) =>
      `. Periodistas, investigadores, instituciones: sírvanse. ${aircraftFires > 0 ? `${aircraftFires} incendios con medios aéreos observados en zona hasta hoy.` : ""}`,
    methodo:
      "Metodología: solo se archivan los focos significativos (corroborados, o por encima de umbrales de detecciones/potencia) — los totales de kanari no son comparables con los recuentos oficiales exhaustivos. Ver también: ",
    links: [
      { href: "/es", label: "mapa en vivo" },
      { href: "/en/canadair", label: "aviones cisterna en vivo" },
      { href: "/en/api", label: "API pública" },
    ],
    faq: (p: { updated: string; active: string; today: string; frTotal: number; bombers: number | null; topCountry: { name: string; n: number } | null }) => [
      {
        q: "¿Cuántos incendios forestales hay en el mundo hoy?",
        a: `Al ${p.updated}, kanari sigue ${p.active} incendios activos en el mundo y ${p.today} focos significativos fueron detectados hoy. Estas cifras se actualizan de forma continua en kanari.io/es/statistiques y en el mapa mundial gratuito.`,
      },
      {
        q: "¿Qué país registra más incendios en este momento?",
        a: p.topCountry
          ? `Desde el 3 de agosto de 2026, el país con más focos significativos archivados por kanari es ${p.topCountry.name}, con ${p.topCountry.n} incendios. El ranking completo y actualizado en tiempo real está en kanari.io/es/statistiques.`
          : "El ranking de países más afectados, actualizado en tiempo real, está en kanari.io/es/statistiques.",
      },
      {
        q: "¿Cuántos aviones cisterna están volando ahora mismo?",
        a:
          p.bombers != null
            ? `${p.bombers} medio${p.bombers > 1 ? "s" : ""} aéreo${p.bombers > 1 ? "s" : ""} contra incendios (aviones cisterna, helicópteros) ${p.bombers > 1 ? "están" : "está"} en vuelo en el mundo al ${p.updated}. Su posición en tiempo real está en kanari.io (seguimiento ADS-B, gratuito).`
            : "La posición en tiempo real de los aviones cisterna y helicópteros contra incendios en vuelo está en kanari.io (seguimiento ADS-B, gratuito).",
      },
      {
        q: "¿Dónde descargar datos abiertos sobre incendios forestales?",
        a: "El archivo completo de incendios significativos (fecha, posición, potencia, país, estado, medios aéreos) se descarga libremente en CSV en kanari.io/opendata/feux.csv, bajo licencia CC BY 4.0, actualizado de forma continua.",
      },
    ],
    datasetName: "kanari — archivo de incendios forestales detectados",
    datasetDesc:
      "Incendios forestales significativos detectados por satélites (NASA FIRMS, GOES, Meteosat MTG) y testigos verificados, archivados de forma continua por kanari: posición, cronología, potencia, medios aéreos observados.",
  },
  pt: {
    metaTitle: "Estatísticas de incêndios florestais em tempo real | kanari",
    metaDesc:
      "Quantos incêndios florestais hoje, nesta semana, no mundo? Números em tempo real, países mais afetados, meios aéreos — e dados abertos (CSV).",
    h1: "O observatório de incêndios florestais",
    intro: (updated: string) =>
      `Os números em tempo real da memória de incêndios do kanari (focos significativos detectados por satélite e testemunhas verificadas, arquivados desde 3 de agosto de 2026). Última atualização: ${updated}.`,
    cardActive: "incêndios ativos acompanhados",
    cardToday: "focos hoje",
    cardWeek: "em 7 dias",
    cardTotal: "desde o início do arquivo",
    cardBombers: "aviões-tanque em voo",
    quote: (updated: string, active: number, today: number, total: number) =>
      `« Em ${updated}, o kanari acompanha ${active} incêndios ativos no mundo; ${today} foco${today > 1 ? "s" : ""} significativo${today > 1 ? "s" : ""} ${today > 1 ? "foram detectados" : "foi detectado"} hoje e ${total} arquivados desde 3 de agosto de 2026. »`,
    quoteSource:
      "Fonte: kanari.io — satélites NASA FIRMS, GOES e Meteosat MTG mais testemunhas verificadas por IA. Números livremente citáveis (CC BY 4.0).",
    topCountries: "Países mais afetados",
    topDepts: "Departamentos franceses mais afetados",
    biggest: "Os incêndios mais potentes arquivados",
    satDetection: "Detecção por satélite",
    faqTitle: "Perguntas frequentes sobre os números",
    openDataTitle: "Dados abertos",
    openData: () => "O arquivo completo é livremente reutilizável (licença CC BY 4.0, menção « kanari.io »): ",
    openDataLink: "baixar o CSV",
    openDataEnd: (aircraftFires: number) =>
      `. Jornalistas, pesquisadores, instituições: fiquem à vontade. ${aircraftFires > 0 ? `${aircraftFires} incêndios com meios aéreos observados na zona até hoje.` : ""}`,
    methodo:
      "Metodologia: só os focos significativos são arquivados (corroborados, ou acima de limiares de detecções/potência) — os totais do kanari não são comparáveis aos levantamentos oficiais exaustivos. Ver também: ",
    links: [
      { href: "/pt", label: "mapa ao vivo" },
      { href: "/en/canadair", label: "aviões-tanque ao vivo" },
      { href: "/en/api", label: "API pública" },
    ],
    faq: (p: { updated: string; active: string; today: string; frTotal: number; bombers: number | null; topCountry: { name: string; n: number } | null }) => [
      {
        q: "Quantos incêndios florestais há no mundo hoje?",
        a: `Em ${p.updated}, o kanari acompanha ${p.active} incêndios ativos no mundo e ${p.today} focos significativos foram detectados hoje. Esses números se atualizam continuamente em kanari.io/pt/statistiques e no mapa mundial gratuito.`,
      },
      {
        q: "Qual país registra mais incêndios neste momento?",
        a: p.topCountry
          ? `Desde 3 de agosto de 2026, o país com mais focos significativos arquivados pelo kanari é ${p.topCountry.name}, com ${p.topCountry.n} incêndios. O ranking completo, atualizado em tempo real, está em kanari.io/pt/statistiques.`
          : "O ranking dos países mais afetados, atualizado em tempo real, está em kanari.io/pt/statistiques.",
      },
      {
        q: "Quantos aviões-tanque estão voando agora?",
        a:
          p.bombers != null
            ? `${p.bombers} meio${p.bombers > 1 ? "s" : ""} aéreo${p.bombers > 1 ? "s" : ""} de combate a incêndios (aviões-tanque, helicópteros) ${p.bombers > 1 ? "estão" : "está"} em voo no mundo em ${p.updated}. A posição em tempo real está em kanari.io (rastreamento ADS-B, gratuito).`
            : "A posição em tempo real dos aviões-tanque e helicópteros de combate a incêndios em voo está em kanari.io (rastreamento ADS-B, gratuito).",
      },
      {
        q: "Onde baixar dados abertos sobre incêndios florestais?",
        a: "O arquivo completo de incêndios significativos (data, posição, potência, país, status, meios aéreos) pode ser baixado livremente em CSV em kanari.io/opendata/feux.csv, sob licença CC BY 4.0, atualizado continuamente.",
      },
    ],
    datasetName: "kanari — arquivo de incêndios florestais detectados",
    datasetDesc:
      "Incêndios florestais significativos detectados por satélites (NASA FIRMS, GOES, Meteosat MTG) e testemunhas verificadas, arquivados continuamente pelo kanari: posição, cronologia, potência, meios aéreos observados.",
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
      canonical: `/${l}/statistiques`,
      languages: {
        fr: "/fr/statistiques",
        en: "/en/statistiques",
        es: "/es/statistiques",
        pt: "/pt/statistiques",
      },
    },
  };
}

function flag(cc: string | null): string {
  if (!cc || !/^[A-Za-z]{2}$/.test(cc)) return "";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export default async function StatsPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  const t = localize(T, lang);

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

  const updated = now.toLocaleString({ fr: "fr-FR", en: "en-GB", es: "es", pt: "pt-BR" }[lang], {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  });

  // FAQ alignée mot pour mot sur les questions que les gens (et notre panel
  // de citations hebdomadaire) posent aux moteurs de réponse IA.
  let topCountry: { name: string; n: number } | null = null;
  const topCC = topCountries[0]?.[0];
  if (topCC && /^[A-Z]{2}$/i.test(topCC)) {
    try {
      const dn = new Intl.DisplayNames([{ fr: "fr", en: "en", es: "es", pt: "pt" }[lang]], { type: "region" });
      topCountry = { name: dn.of(topCC.toUpperCase()) ?? topCC, n: topCountries[0][1] };
    } catch {
      topCountry = { name: topCC, n: topCountries[0][1] };
    }
  }
  const faq = t.faq({
    updated,
    active: String(activeCount ?? active.length),
    today: String(todayCount ?? todayFires.length),
    frTotal,
    bombers,
    topCountry,
  });
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
    name: t.datasetName,
    description: t.datasetDesc,
    url: `https://kanari.io/${lang}/statistiques`,
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
      <Adsense />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <h1 className="mb-3" style={{ fontFamily: "var(--font-display)", fontSize: "var(--text-h2)", color: "var(--ink)" }}>
          {t.h1}
        </h1>
        <p className="mb-6 text-[15px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
          {t.intro(updated)}
        </p>

        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-[18px] px-4 py-4" style={card}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: "#D64545" }}>{active.length}</div>
            <div className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>{t.cardActive}</div>
          </div>
          <div className="rounded-[18px] px-4 py-4" style={card}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: "var(--ink)" }}>{todayFires.length}</div>
            <div className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>{t.cardToday}</div>
          </div>
          <div className="rounded-[18px] px-4 py-4" style={card}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: "var(--ink)" }}>{week.length}</div>
            <div className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>{t.cardWeek}</div>
          </div>
          <div className="rounded-[18px] px-4 py-4" style={card}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: "var(--ink)" }}>{fires.length}</div>
            <div className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>{t.cardTotal}</div>
          </div>
          {bombers != null && (
            <div className="rounded-[18px] px-4 py-4" style={card}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 600, color: "var(--ink)" }}>{bombers}</div>
              <div className="text-[12.5px]" style={{ color: "var(--ink-2)" }}>
                <Link href={`/${lang}/canadair`} style={{ color: "var(--link)" }}>{t.cardBombers}</Link>
              </div>
            </div>
          )}
        </div>

        {/* Phrase citable (GEO) : chiffre daté + source, prêt à être repris. */}
        <blockquote
          className="mb-8 rounded-[18px] border-l-4 p-5 text-[15px] leading-relaxed"
          style={{ background: "var(--canary-tint)", borderColor: "var(--canary-strong)", color: "var(--ink)" }}
        >
          {t.quote(updated, active.length, todayFires.length, fires.length)}
          <footer className="mt-1.5 text-[12.5px]" style={{ color: "var(--ink-3)" }}>
            {t.quoteSource}
          </footer>
        </blockquote>

        <section className="mb-8">
          <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            {t.topCountries}
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
              {t.topDepts}
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
              {t.biggest}
            </h2>
            <div className="flex flex-col gap-2">
              {biggest.map((f: ArchivedFire) => (
                <Link key={f.slug} href={`/fr/feu/${f.slug}`} className="flex items-center justify-between rounded-[14px] px-4 py-3" style={card}>
                  <span className="truncate text-[14px]" style={{ color: "var(--ink)" }}>
                    {flag(f.country)} {f.place ?? t.satDetection} · {f.first_seen.slice(0, 10)}
                  </span>
                  <strong className="whitespace-nowrap text-[13px]" style={{ color: "var(--ember)" }}>{Math.round(f.max_frp)} MW</strong>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="mb-8">
          <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            {t.faqTitle}
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
            {t.openDataTitle}
          </h2>
          <p className="text-[14px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
            {t.openData(aircraftFires)}
            <a href="/opendata/feux.csv" style={{ color: "var(--link)", fontWeight: 600 }}>{t.openDataLink}</a>
            {t.openDataEnd(aircraftFires)}
          </p>
        </section>

        <p className="mt-8 border-t pt-4 text-[12.5px]" style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}>
          {t.methodo}
          {t.links.map((l, i) => (
            <span key={l.href}>
              {i > 0 && " · "}
              <Link href={l.href} style={{ color: "var(--link)" }}>{l.label}</Link>
            </span>
          ))}
          .
        </p>
        {/* Observatoire citable : permaliens pays × mois (chiffres uniques,
            reliables par la presse et les assistants IA). */}
        <section className="mb-8">
          <h2 className="mb-3 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
            {{ fr: "Chiffres par pays et par mois", en: "Figures by country and month", es: "Cifras por país y por mes", pt: "Números por país e por mês" }[lang]}
          </h2>
          <p className="mb-2 text-[13.5px]" style={{ color: "var(--ink-2)" }}>
            {{ fr: "Pages permanentes et citables, mois en cours : ", en: "Permanent, citable pages, current month: ", es: "Páginas permanentes y citables, mes en curso: ", pt: "Páginas permanentes e citáveis, mês atual: " }[lang]}
            <strong style={{ color: "var(--ink)" }}>{monthLabel(archiveMonths()[0], lang)}</strong>
          </p>
          <p className="text-[13px] leading-relaxed">
            {allScopes(lang).map((s, i) => (
              <span key={s.slug}>
                {i > 0 ? " · " : ""}
                <Link href={`/${lang}/statistiques/${s.slug}/${archiveMonths()[0]}`} style={{ color: "var(--link)" }}>{s.name}</Link>
              </span>
            ))}
          </p>
          <p className="mt-3 text-[13px]">
            <Link href={`/${lang}/methodologie`} style={{ color: "var(--link)" }}>
              {{ fr: "Méthodologie, limites et comment citer ces chiffres", en: "Methodology, limits and how to cite these figures", es: "Metodología, límites y cómo citar estas cifras", pt: "Metodologia, limites e como citar estes números" }[lang]}
            </Link>
          </p>
        </section>

        <SiteFooter lang={lang} />
      </div>
    </div>
  );
}
