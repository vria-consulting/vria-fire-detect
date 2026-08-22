// Libellés de l'observatoire citable (pages /[lang]/statistiques/[country]/
// [month]) — 4 langues, un seul dictionnaire partagé entre la page pays et la
// page pays × mois.

import type { Lang } from "@/lib/i18n";
import { COUNTRIES, COUNTRY_BY_SLUG, countryName, type FireCountry } from "@/lib/countries";

export const WORLD_SLUG = "world";

export type Scope = { slug: string; cc: string | null; name: string; flag: string };

const WORLD_NAME: Record<Lang, string> = { fr: "Monde", en: "World", es: "Mundo", pt: "Mundo" };

export function flagOf(cc: string | null): string {
  if (!cc || !/^[A-Za-z]{2}$/.test(cc)) return "🌍";
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function resolveScope(slug: string, lang: Lang): Scope | null {
  if (slug === WORLD_SLUG) return { slug, cc: null, name: WORLD_NAME[lang], flag: "🌍" };
  const c: FireCountry | undefined = COUNTRY_BY_SLUG.get(slug);
  if (!c) return null;
  return { slug, cc: c.cc, name: countryName(c.cc, lang, c.name), flag: flagOf(c.cc) };
}

export function allScopes(lang: Lang): Scope[] {
  return [resolveScope(WORLD_SLUG, lang)!, ...COUNTRIES.map((c) => resolveScope(c.slug, lang)!)];
}

export const LOCALE: Record<Lang, string> = { fr: "fr-FR", en: "en-GB", es: "es-ES", pt: "pt-BR" };

export function monthLabel(month: string, lang: Lang): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  const s = d.toLocaleString(LOCALE[lang], { month: "long", year: "numeric", timeZone: "UTC" });
  return lang === "en" ? s : s;
}

export function fmtDate(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleString(LOCALE[lang], {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    hour12: false,
  });
}

export const OBS = {
  fr: {
    crumbObs: "Observatoire",
    titleMonth: (name: string, month: string) => `${name}, ${month} : feux de forêt détectés | kanari`,
    descMonth: (name: string, month: string) =>
      `Combien de feux de forêt en ${month} (${name}) ? Nombre de départs significatifs détectés par satellite, feux les plus puissants, jours les plus actifs. Chiffres kanari, citables, données ouvertes CC BY 4.0.`,
    h1Month: (name: string, month: string) => `${name} : feux de forêt en ${month}`,
    titleCountry: (name: string) => `${name} : feux de forêt mois par mois | kanari`,
    descCountry: (name: string) =>
      `Nombre de feux de forêt significatifs détectés chaque mois (${name}) par kanari : satellites NASA FIRMS, GOES, Meteosat MTG et témoins vérifiés. Chiffres citables, données ouvertes.`,
    h1Country: (name: string) => `${name} : feux de forêt mois par mois`,
    introMonth: (name: string, month: string, total: number, updated: string) =>
      `Entre le 1er et la fin du mois, kanari a archivé ${total} départ${total > 1 ? "s" : ""} de feu significatif${total > 1 ? "s" : ""} (${name}, ${month}). Chiffres issus de la mémoire des feux kanari, actualisés le ${updated}.`,
    quote: (name: string, month: string, total: number, active: number, maxFrp: number) =>
      `« En ${month}, kanari a détecté ${total} feu${total > 1 ? "x" : ""} de forêt significatif${total > 1 ? "s" : ""} (${name}), dont ${active} encore actif${active > 1 ? "s" : ""} à la dernière mise à jour ; le plus puissant a atteint ${Math.round(maxFrp)} MW. »`,
    quoteSource: "Source : kanari.io, satellites NASA FIRMS, GOES, Meteosat MTG et témoins vérifiés par IA. Librement citable (CC BY 4.0).",
    cards: { total: "feux significatifs", active: "encore actifs", witnesses: "avec témoins vérifiés", aircraft: "avec moyens aériens observés", maxFrp: "puissance max (MW)" },
    byDay: "Départs de feu par jour",
    topCountries: "Pays les plus touchés ce mois-ci",
    topDepts: "Départements français les plus touchés",
    biggest: "Les feux les plus puissants du mois",
    colPlace: "Lieu",
    colDate: "Première détection (UTC)",
    colDet: "Détections",
    colFrp: "MW",
    otherMonths: "Autres mois",
    otherScopes: "Autres pays",
    world: "Monde entier",
    noData: "Aucun feu significatif archivé pour cette période (ou archive momentanément indisponible).",
    fewData: "Peu de feux ce mois-ci : page informative, chiffres à manier avec prudence.",
    cite: "Citer ces chiffres",
    citeText: (name: string, month: string, total: number) =>
      `kanari (2026). Feux de forêt détectés, ${name}, ${month} : ${total} départs significatifs. https://kanari.io — consulté le`,
    methodo: "Méthodologie : seuls les foyers significatifs sont archivés (corroborés par des témoins, ou au-delà de seuils de détections et de puissance) ; les totaux ne sont pas comparables aux recensements officiels exhaustifs.",
    methodoLink: "Méthodologie complète et licence",
    openData: "Télécharger l'archive complète (CSV, CC BY 4.0)",
    monthsTitle: "Mois couverts par l'archive",
    colMonth: "Mois",
    colFires: "Feux significatifs",
    currentMonth: "Mois en cours",
    sinceArchive: (n: number) => `${n} feux significatifs archivés depuis le 3 août 2026`,
    seeLive: "Voir la situation en direct",
  },
  en: {
    crumbObs: "Observatory",
    titleMonth: (name: string, month: string) => `${name}, ${month}: wildfires detected | kanari`,
    descMonth: (name: string, month: string) =>
      `How many wildfires in ${name} in ${month}? Number of significant ignitions detected by satellite, most powerful fires, busiest days. kanari figures, citable, open data CC BY 4.0.`,
    h1Month: (name: string, month: string) => `${name}: wildfires in ${month}`,
    titleCountry: (name: string) => `${name}: wildfires month by month | kanari`,
    descCountry: (name: string) =>
      `Number of significant wildfires detected each month in ${name} by kanari: NASA FIRMS, GOES, Meteosat MTG satellites and verified witnesses. Citable figures, open data.`,
    h1Country: (name: string) => `${name}: wildfires month by month`,
    introMonth: (name: string, month: string, total: number, updated: string) =>
      `Over the month, kanari archived ${total} significant fire ignition${total > 1 ? "s" : ""} in ${name} (${month}). Figures from kanari's fire memory, updated ${updated}.`,
    quote: (name: string, month: string, total: number, active: number, maxFrp: number) =>
      `"In ${month}, kanari detected ${total} significant wildfire${total > 1 ? "s" : ""} in ${name}, ${active} of them still active at the last update; the most powerful reached ${Math.round(maxFrp)} MW."`,
    quoteSource: "Source: kanari.io, NASA FIRMS, GOES and Meteosat MTG satellites plus AI-verified witness reports. Freely citable (CC BY 4.0).",
    cards: { total: "significant fires", active: "still active", witnesses: "with verified witnesses", aircraft: "with aircraft observed", maxFrp: "peak power (MW)" },
    byDay: "Fire ignitions per day",
    topCountries: "Most affected countries this month",
    topDepts: "Most affected French departments",
    biggest: "Most powerful fires of the month",
    colPlace: "Place",
    colDate: "First detection (UTC)",
    colDet: "Detections",
    colFrp: "MW",
    otherMonths: "Other months",
    otherScopes: "Other countries",
    world: "Worldwide",
    noData: "No significant fire archived for this period (or the archive is temporarily unavailable).",
    fewData: "Few fires this month: informative page, handle the figures with care.",
    cite: "Cite these figures",
    citeText: (name: string, month: string, total: number) =>
      `kanari (2026). Wildfires detected, ${name}, ${month}: ${total} significant ignitions. https://kanari.io — accessed`,
    methodo: "Methodology: only significant fires are archived (corroborated by witnesses, or above detection and power thresholds); totals are not comparable to exhaustive official tallies.",
    methodoLink: "Full methodology and licence",
    openData: "Download the full archive (CSV, CC BY 4.0)",
    monthsTitle: "Months covered by the archive",
    colMonth: "Month",
    colFires: "Significant fires",
    currentMonth: "Current month",
    sinceArchive: (n: number) => `${n} significant fires archived since August 3, 2026`,
    seeLive: "See the live situation",
  },
  es: {
    crumbObs: "Observatorio",
    titleMonth: (name: string, month: string) => `${name}, ${month}: incendios detectados | kanari`,
    descMonth: (name: string, month: string) =>
      `¿Cuántos incendios forestales en ${name} en ${month}? Número de focos significativos detectados por satélite, incendios más potentes, días más activos. Cifras kanari, citables, datos abiertos CC BY 4.0.`,
    h1Month: (name: string, month: string) => `${name}: incendios forestales en ${month}`,
    titleCountry: (name: string) => `${name}: incendios forestales mes a mes | kanari`,
    descCountry: (name: string) =>
      `Número de incendios forestales significativos detectados cada mes en ${name} por kanari: satélites NASA FIRMS, GOES, Meteosat MTG y testigos verificados. Cifras citables, datos abiertos.`,
    h1Country: (name: string) => `${name}: incendios forestales mes a mes`,
    introMonth: (name: string, month: string, total: number, updated: string) =>
      `A lo largo del mes, kanari archivó ${total} foco${total > 1 ? "s" : ""} significativo${total > 1 ? "s" : ""} en ${name} (${month}). Cifras de la memoria de incendios de kanari, actualizadas el ${updated}.`,
    quote: (name: string, month: string, total: number, active: number, maxFrp: number) =>
      `« En ${month}, kanari detectó ${total} incendio${total > 1 ? "s" : ""} forestal${total > 1 ? "es" : ""} significativo${total > 1 ? "s" : ""} en ${name}, ${active} todavía activo${active > 1 ? "s" : ""} en la última actualización; el más potente alcanzó ${Math.round(maxFrp)} MW. »`,
    quoteSource: "Fuente: kanari.io, satélites NASA FIRMS, GOES y Meteosat MTG más testigos verificados por IA. Libremente citable (CC BY 4.0).",
    cards: { total: "incendios significativos", active: "todavía activos", witnesses: "con testigos verificados", aircraft: "con medios aéreos observados", maxFrp: "potencia máx. (MW)" },
    byDay: "Focos por día",
    topCountries: "Países más afectados este mes",
    topDepts: "Departamentos franceses más afectados",
    biggest: "Los incendios más potentes del mes",
    colPlace: "Lugar",
    colDate: "Primera detección (UTC)",
    colDet: "Detecciones",
    colFrp: "MW",
    otherMonths: "Otros meses",
    otherScopes: "Otros países",
    world: "Todo el mundo",
    noData: "Ningún incendio significativo archivado en este periodo (o archivo temporalmente no disponible).",
    fewData: "Pocos incendios este mes: página informativa, cifras a manejar con prudencia.",
    cite: "Citar estas cifras",
    citeText: (name: string, month: string, total: number) =>
      `kanari (2026). Incendios forestales detectados, ${name}, ${month}: ${total} focos significativos. https://kanari.io — consultado el`,
    methodo: "Metodología: solo se archivan los focos significativos (corroborados por testigos o por encima de umbrales de detecciones y potencia); los totales no son comparables con los recuentos oficiales exhaustivos.",
    methodoLink: "Metodología completa y licencia",
    openData: "Descargar el archivo completo (CSV, CC BY 4.0)",
    monthsTitle: "Meses cubiertos por el archivo",
    colMonth: "Mes",
    colFires: "Incendios significativos",
    currentMonth: "Mes en curso",
    sinceArchive: (n: number) => `${n} incendios significativos archivados desde el 3 de agosto de 2026`,
    seeLive: "Ver la situación en vivo",
  },
  pt: {
    crumbObs: "Observatório",
    titleMonth: (name: string, month: string) => `${name}, ${month}: incêndios detectados | kanari`,
    descMonth: (name: string, month: string) =>
      `Quantos incêndios florestais em ${name} em ${month}? Número de focos significativos detectados por satélite, incêndios mais potentes, dias mais ativos. Números kanari, citáveis, dados abertos CC BY 4.0.`,
    h1Month: (name: string, month: string) => `${name}: incêndios florestais em ${month}`,
    titleCountry: (name: string) => `${name}: incêndios florestais mês a mês | kanari`,
    descCountry: (name: string) =>
      `Número de incêndios florestais significativos detectados a cada mês em ${name} pelo kanari: satélites NASA FIRMS, GOES, Meteosat MTG e testemunhas verificadas. Números citáveis, dados abertos.`,
    h1Country: (name: string) => `${name}: incêndios florestais mês a mês`,
    introMonth: (name: string, month: string, total: number, updated: string) =>
      `Ao longo do mês, o kanari arquivou ${total} foco${total > 1 ? "s" : ""} significativo${total > 1 ? "s" : ""} em ${name} (${month}). Números da memória de incêndios do kanari, atualizados em ${updated}.`,
    quote: (name: string, month: string, total: number, active: number, maxFrp: number) =>
      `« Em ${month}, o kanari detectou ${total} incêndio${total > 1 ? "s" : ""} florestal${total > 1 ? "is" : ""} significativo${total > 1 ? "s" : ""} em ${name}, ${active} ainda ativo${active > 1 ? "s" : ""} na última atualização; o mais potente chegou a ${Math.round(maxFrp)} MW. »`,
    quoteSource: "Fonte: kanari.io, satélites NASA FIRMS, GOES e Meteosat MTG mais testemunhas verificadas por IA. Livremente citável (CC BY 4.0).",
    cards: { total: "incêndios significativos", active: "ainda ativos", witnesses: "com testemunhas verificadas", aircraft: "com meios aéreos observados", maxFrp: "potência máx. (MW)" },
    byDay: "Focos por dia",
    topCountries: "Países mais afetados neste mês",
    topDepts: "Departamentos franceses mais afetados",
    biggest: "Os incêndios mais potentes do mês",
    colPlace: "Local",
    colDate: "Primeira detecção (UTC)",
    colDet: "Detecções",
    colFrp: "MW",
    otherMonths: "Outros meses",
    otherScopes: "Outros países",
    world: "Mundo inteiro",
    noData: "Nenhum incêndio significativo arquivado neste período (ou arquivo temporariamente indisponível).",
    fewData: "Poucos incêndios neste mês: página informativa, números a usar com cautela.",
    cite: "Citar estes números",
    citeText: (name: string, month: string, total: number) =>
      `kanari (2026). Incêndios florestais detectados, ${name}, ${month}: ${total} focos significativos. https://kanari.io — acessado em`,
    methodo: "Metodologia: só os focos significativos são arquivados (corroborados por testemunhas ou acima de limiares de detecções e potência); os totais não são comparáveis aos levantamentos oficiais exaustivos.",
    methodoLink: "Metodologia completa e licença",
    openData: "Baixar o arquivo completo (CSV, CC BY 4.0)",
    monthsTitle: "Meses cobertos pelo arquivo",
    colMonth: "Mês",
    colFires: "Incêndios significativos",
    currentMonth: "Mês atual",
    sinceArchive: (n: number) => `${n} incêndios significativos arquivados desde 3 de agosto de 2026`,
    seeLive: "Ver a situação ao vivo",
  },
} as const;
