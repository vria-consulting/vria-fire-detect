import Link from "next/link";
import type { Lang } from "@/lib/i18n";

// Curated sources for places with existing search demand, reviewed 2026-09-10.
// Link to the authority; do not freeze a temporary restriction into evergreen copy.
const SOURCES: Record<string, { name: string; url: string }> = {
  yonne: { name: "Préfecture de l’Yonne : forêt", url: "https://www.yonne.gouv.fr/Actions-de-l-Etat/Environnement/Protection-de-l-environnement/Foret" },
  vendee: { name: "Préfecture de la Vendée : prévention des incendies de forêt", url: "https://www.vendee.gouv.fr/Actualites/Actualites-locales/Grands-dossiers/Alertes/Prevention-des-incendies-de-foret" },
  bosnia: { name: "Federalna uprava civilne zaštite (Federation of Bosnia and Herzegovina)", url: "https://fucz.gov.ba/" },
  algeria: { name: "Direction Générale de la Protection Civile : les feux de forêt", url: "https://dgpc.dz/les-feux-de-foret/" },
};
const TEXT = {
  fr: {
    title: "Vérifier la situation et préparer sa sortie",
    body: "La carte localise les détections reçues ; elle ne donne pas l’autorisation d’entrer dans un massif. Pour l’accès aux forêts, les restrictions temporaires et les consignes, consultez les informations de la préfecture et la signalisation sur place. Une absence de détection ne garantit pas l’absence de feu.",
    scope: "Les informations de la Fédération de Bosnie-Herzégovine couvrent son territoire ; vérifiez également les autorités compétentes pour votre commune.",
    methods: "Comprendre les sources et les limites", stats: "Consulter les archives mensuelles",
  },
  en: {
    title: "Check local information before travelling",
    body: "Satellite detections help locate observed heat sources. They do not establish that a road or trail is open, or provide an official evacuation notice. Check the relevant authority and local instructions. No detection does not guarantee there is no fire.",
    scope: "The Federal Civil Protection Administration covers the Federation of Bosnia and Herzegovina. Also consult the competent authority for your municipality; this is not a single nationwide incident feed.",
    methods: "Understand the sources and limitations", stats: "Explore the monthly archive",
  },
  es: {
    title: "Consulte la información local antes de viajar",
    body: "Las detecciones ayudan a localizar fuentes de calor observadas. No confirman que una carretera o sendero esté abierto ni constituyen un aviso oficial de evacuación. Consulte a las autoridades y las indicaciones locales. La ausencia de detección no garantiza que no haya fuego.",
    scope: "La administración federal de protección civil cubre la Federación de Bosnia y Herzegovina. Consulte también a la autoridad competente de su municipio; no es un registro único de incidentes de todo el país.",
    methods: "Fuentes y limitaciones", stats: "Archivo mensual",
  },
  pt: {
    title: "Consulte as informações locais antes de viajar",
    body: "As detecções ajudam a localizar fontes de calor observadas. Não confirmam a abertura de estradas ou trilhas, nem constituem um aviso oficial de evacuação. Consulte as autoridades e orientações locais. A ausência de detecção não garante que não haja fogo.",
    scope: "A administração federal de proteção civil cobre a Federação da Bósnia e Herzegovina. Consulte também a autoridade competente do município; não é um registro único de incidentes de todo o país.",
    methods: "Fontes e limitações", stats: "Arquivo mensal",
  },
};
export function LocalFireSources({ place, lang }: { place: string; lang: Lang }) {
  const source = SOURCES[place];
  if (!source) return null;
  const t = TEXT[lang];
  const country = place === "yonne" || place === "vendee" ? "france" : place;
  return <section className="my-8 rounded-[18px] border p-5" style={{ borderColor: "var(--line)" }}>
    <h2 className="mb-2 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)" }}>{t.title}</h2>
    <p className="text-[14px] leading-relaxed">{t.body}</p>
    {place === "bosnia" && <p className="mt-2 text-[14px] leading-relaxed">{t.scope}</p>}
    <p className="mt-3 text-[14px]"><a href={source.url} style={{ color: "var(--link)" }}>{source.name}</a></p>
    <p className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-[14px]">
      <Link href={`/${lang}/methodologie`} style={{ color: "var(--link)" }}>{t.methods}</Link>
      <Link href={`/${lang}/statistiques/${country}`} style={{ color: "var(--link)" }}>{t.stats}</Link>
    </p>
  </section>;
}
