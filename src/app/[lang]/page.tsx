import Link from "next/link";
import { unstable_cache } from "next/cache";
import { isValidLang } from "@/lib/i18n";
import { notFound } from "next/navigation";
import FireMap, { type Hotspot } from "@/components/FireMap";
import { COUNTRY_BY_CC } from "@/lib/countries";
import { listFiresLite } from "@/lib/firearchive";

// ISR 10 min : la home reste servie statique (perf) mais embarque les zones
// les plus actives du moment — la « rotation éditoriale mondiale » : quand la
// saison s'éteint ici, le chip emmène là où ça brûle.
export const revalidate = 600;

const H1 = {
  fr: "kanari — carte mondiale des feux de forêt en temps quasi réel et alertes de départs de feu",
  en: "kanari — near real-time world wildfire map and fire start alerts",
  es: "kanari — mapa mundial de incendios forestales en tiempo casi real y alertas de focos",
  pt: "kanari — mapa mundial de incêndios florestais em tempo quase real e alertas de focos",
} as const;

async function computeHotspots(): Promise<Hotspot[]> {
  try {
    const since = new Date(Date.now() - 48 * 3600_000).toISOString();
    const fires = await listFiresLite(since, 20000);
    const byCc = new Map<string, number>();
    for (const f of fires) {
      if (f.status === "active" && f.country && COUNTRY_BY_CC.has(f.country)) {
        byCc.set(f.country, (byCc.get(f.country) ?? 0) + 1);
      }
    }
    return [...byCc.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cc, count]) => {
        const c = COUNTRY_BY_CC.get(cc)!;
        return { cc, count, lat: c.lat, lon: c.lon, zoom: c.zoom };
      });
  } catch {
    return []; // build CI sans Supabase, ou API muette : la carte vit sans chip
  }
}

const topHotspots = unstable_cache(computeHotspots, ["home-hotspots-v2"], { revalidate: 600 });
const INTRO = {
  fr: { title: "Comprendre la carte et ses sources", text: "Détections satellite, signalements et positions aériennes : kanari réunit ces observations pour suivre la situation. Un point chaud n'est pas toujours un feu de forêt confirmé. L'absence de signal ne garantit pas l'absence de feu.", stats: "Observatoire", guide: "Comprendre les satellites", methods: "Sources et limites" },
  en: { title: "Understand the map and its sources", text: "kanari brings together satellite detections, reports and aircraft positions to follow the situation. A hotspot is not always a confirmed wildfire. No signal does not guarantee no fire.", stats: "Observatory", guide: "How satellites detect fires", methods: "Sources and limitations" },
  es: { title: "Entender el mapa y sus fuentes", text: "kanari reúne detecciones satelitales, avisos y posiciones aéreas. Un punto caliente no siempre es un incendio forestal confirmado. La ausencia de señal no garantiza que no haya fuego.", stats: "Observatorio", guide: "Detección por satélite", methods: "Fuentes y límites" },
  pt: { title: "Entenda o mapa e suas fontes", text: "kanari reúne detecções por satélite, relatos e posições de aeronaves. Um foco de calor nem sempre é um incêndio florestal confirmado. A ausência de sinal não garante que não haja fogo.", stats: "Observatório", guide: "Detecção por satélite", methods: "Fontes e limites" },
};

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  const hotspots = await topHotspots();
  return (
    <div className="flex h-full flex-col">
      {/* H1 sémantique pour les moteurs et les LLM — l'app est visuelle. */}
      <h1 className="sr-only">{H1[lang]}</h1>
      <details className="shrink-0 border-b px-4 py-2 text-xs" style={{ background: "var(--paper)", color: "var(--ink-2)", borderColor: "var(--line)" }}>
        <summary className="cursor-pointer font-medium">{INTRO[lang].title}</summary>
        <p className="mt-2 max-w-3xl leading-relaxed">{INTRO[lang].text}</p>
        <p className="my-2 flex flex-wrap gap-4"><Link className="underline" href={`/${lang}/statistiques`}>{INTRO[lang].stats}</Link><Link className="underline" href={`/${lang}/guide/detection-feux-satellite`}>{INTRO[lang].guide}</Link><Link className="underline" href={`/${lang}/methodologie`}>{INTRO[lang].methods}</Link></p>
      </details>
      <div className="min-h-0 flex-1"><FireMap lang={lang} hotspots={hotspots} /></div>
    </div>
  );
}
