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

async function topHotspots(): Promise<Hotspot[]> {
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

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();
  const hotspots = await topHotspots();
  return (
    <>
      {/* H1 sémantique pour les moteurs et les LLM — l'app est visuelle. */}
      <h1 className="sr-only">{H1[lang]}</h1>
      <FireMap lang={lang} hotspots={hotspots} />
    </>
  );
}
