// Points stratégiques autour d'un foyer, via l'API Overpass (OpenStreetMap) :
// points d'eau incendie, casernes, héli-surfaces. Indicatif uniquement — ne
// remplace pas les référentiels opérationnels (DECI/DFCI) des SDIS.
// Appelé SEULEMENT pour les feux actifs : les pages archivées (gros du crawl)
// ne doivent pas générer de trafic Overpass. Cache serveur 6 h par foyer.

import { distKm } from "@/lib/departements";

export type StrategicPoint = {
  kind: "water" | "station" | "helipad";
  label: string;
  name: string | null;
  dist: number; // km
  bearing: string; // N, NE, E…
  lat: number;
  lon: number;
};

const WATER_LABELS: Record<string, string> = {
  fire_hydrant: "Borne incendie",
  water_tank: "Réserve d'eau",
  fire_water_pond: "Bassin incendie",
  suction_point: "Point d'aspiration",
  water_tower: "Château d'eau",
};

const DIRS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
function bearingOf(lat1: number, lon1: number, lat2: number, lon2: number): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  const deg = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  return DIRS[Math.round(deg / 45) % 8];
}

type OverpassElement = {
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export async function fetchStrategicPoints(lat: number, lon: number): Promise<StrategicPoint[]> {
  const la = lat.toFixed(4);
  const lo = lon.toFixed(4);
  const q =
    `[out:json][timeout:10];(` +
    `nwr(around:6000,${la},${lo})["emergency"~"fire_hydrant|water_tank|fire_water_pond|suction_point"];` +
    `nwr(around:6000,${la},${lo})["man_made"="water_tower"];` +
    `nwr(around:15000,${la},${lo})["amenity"="fire_station"];` +
    `nwr(around:15000,${la},${lo})["aeroway"~"^(helipad|heliport)$"];` +
    `);out center 80;`;
  try {
    const res = await fetch(
      `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`,
      { next: { revalidate: 21600 }, signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return [];
    const j = (await res.json()) as { elements?: OverpassElement[] };
    const out: StrategicPoint[] = [];
    for (const e of j.elements ?? []) {
      const pLat = e.lat ?? e.center?.lat;
      const pLon = e.lon ?? e.center?.lon;
      const tags = e.tags ?? {};
      if (pLat === undefined || pLon === undefined) continue;
      const water = tags.emergency && WATER_LABELS[tags.emergency] ? tags.emergency : tags.man_made === "water_tower" ? "water_tower" : null;
      const kind: StrategicPoint["kind"] | null = water
        ? "water"
        : tags.amenity === "fire_station"
          ? "station"
          : tags.aeroway === "helipad" || tags.aeroway === "heliport"
            ? "helipad"
            : null;
      if (!kind) continue;
      out.push({
        kind,
        label: kind === "water" ? WATER_LABELS[water!] : kind === "station" ? "Caserne" : "Héli-surface",
        name: tags.name ?? null,
        dist: Math.round(distKm(lat, lon, pLat, pLon) * 10) / 10,
        bearing: bearingOf(lat, lon, pLat, pLon),
        lat: pLat,
        lon: pLon,
      });
    }
    out.sort((a, b) => a.dist - b.dist);
    // Cap par catégorie : l'urbain peut avoir des dizaines de bornes.
    const caps: Record<StrategicPoint["kind"], number> = { water: 6, station: 3, helipad: 3 };
    const seen: Record<StrategicPoint["kind"], number> = { water: 0, station: 0, helipad: 0 };
    return out.filter((p) => ++seen[p.kind] <= caps[p.kind]);
  } catch {
    return [];
  }
}
