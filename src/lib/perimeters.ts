// Périmètres officiels multi-continents, sous un type commun :
// - États-Unis : NIFC/WFIGS (nifc.ts, ArcGIS)
// - Canada : CWFIS m3_polygons_current (GeoServer WFS, périmètres estimés M3)
// - Europe : EFFIS burnt areas (MapServer WFS, Rapid Damage Assessment)
// Tous publics, gratuits, sans clé. Appelés UNIQUEMENT pour les feux actifs
// (les pages archivées crawlées en masse ne sollicitent aucun service externe).

import { fetchNifcPerimeter } from "./nifc";

export type OfficialPerimeter = {
  source: "NIFC" | "CWFIS" | "EFFIS";
  name: string | null; // nom d'incident (NIFC) ou commune/province (EFFIS)
  hectares: number;
  containedPct: number | null; // NIFC uniquement
  discovered: string | null; // ISO
};

// Pays où EFFIS cartographie les surfaces brûlées (Europe élargie + rives sud
// et est de la Méditerranée).
const EFFIS_COUNTRIES = new Set([
  "ES", "PT", "FR", "IT", "GR", "HR", "AL", "TR", "CY", "BG", "RO", "RS", "BA",
  "ME", "MK", "SI", "AT", "CH", "DE", "BE", "NL", "LU", "GB", "IE", "PL", "CZ",
  "SK", "HU", "UA", "MD", "DK", "SE", "NO", "FI", "EE", "LV", "LT", "MA", "DZ",
  "TN", "IL", "LB", "SY",
]);

const UA = "kanari.io wildfire map (contact@kanari.io)";

// Canada : périmètres estimés M3 (pas de nom d'incident dans la couche —
// hcount + surface + dates). bbox en LAT,LON (WFS 2.0 + CRS urn).
async function fetchCwfisPerimeter(lat: number, lon: number): Promise<OfficialPerimeter | null> {
  const dLat = 0.3;
  const dLon = 0.3 / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeNames: "public:m3_polygons_current",
    outputFormat: "application/json",
    srsName: "urn:ogc:def:crs:EPSG::4326",
    bbox: `${(lat - dLat).toFixed(3)},${(lon - dLon).toFixed(3)},${(lat + dLat).toFixed(3)},${(lon + dLon).toFixed(3)},urn:ogc:def:crs:EPSG::4326`,
    count: "20",
  });
  try {
    const res = await fetch(`https://cwfis.cfs.nrcan.gc.ca/geoserver/public/wfs?${params}`, {
      headers: { "user-agent": UA },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      features?: { properties: { area?: number; hcount?: number; firstdate?: string; lastdate?: string } }[];
    };
    const best = (j.features ?? [])
      .map((f) => f.properties)
      .filter((p) => (p.area ?? 0) >= 5)
      .sort((a, b) => (b.area ?? 0) - (a.area ?? 0))[0];
    if (!best) return null;
    return {
      source: "CWFIS",
      name: null,
      hectares: Math.round(best.area ?? 0),
      containedPct: null,
      discovered: best.firstdate ?? null,
    };
  } catch {
    return null;
  }
}

// Europe : surfaces brûlées EFFIS (consolidation en quelques jours — un feu
// tout neuf peut ne pas y être encore). Filtre OGC date récente + bbox
// (MapServer : pas de CQL, axis order lat lon dans l'Envelope 1.1).
async function fetchEffisPerimeter(
  lat: number,
  lon: number,
  sinceIso: string
): Promise<OfficialPerimeter | null> {
  const dLat = 0.3;
  const dLon = 0.3 / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
  const since = `${sinceIso.slice(0, 10)} 00:00:00`;
  const filter =
    `<Filter><And>` +
    `<PropertyIsGreaterThanOrEqualTo><PropertyName>FIREDATE</PropertyName><Literal>${since}</Literal></PropertyIsGreaterThanOrEqualTo>` +
    `<BBOX><PropertyName>msGeometry</PropertyName>` +
    `<gml:Envelope xmlns:gml="http://www.opengis.net/gml" srsName="EPSG:4326">` +
    `<gml:lowerCorner>${(lat - dLat).toFixed(3)} ${(lon - dLon).toFixed(3)}</gml:lowerCorner>` +
    `<gml:upperCorner>${(lat + dLat).toFixed(3)} ${(lon + dLon).toFixed(3)}</gml:upperCorner>` +
    `</gml:Envelope></BBOX></And></Filter>`;
  const params = new URLSearchParams({
    service: "WFS",
    version: "1.1.0",
    request: "GetFeature",
    typename: "ms:modis.ba.poly",
    outputformat: "geojson",
    maxfeatures: "40",
    filter,
  });
  try {
    const res = await fetch(`https://maps.wild-fire.eu/effis?${params}`, {
      headers: { "user-agent": UA },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      features?: {
        properties: {
          AREA_HA?: string | number;
          COMMUNE?: string;
          PROVINCE?: string;
          FIREDATE?: string;
        };
      }[];
    };
    const rows = (j.features ?? [])
      .map((f) => ({
        ha: Math.round(Number(f.properties.AREA_HA ?? 0)),
        commune: f.properties.COMMUNE ?? null,
        province: f.properties.PROVINCE ?? null,
        firedate: f.properties.FIREDATE ?? null,
      }))
      .filter((r) => r.ha >= 5)
      .sort((a, b) => b.ha - a.ha);
    const best = rows[0];
    if (!best) return null;
    return {
      source: "EFFIS",
      name: [best.commune, best.province].filter(Boolean).join(", ") || null,
      hectares: best.ha,
      containedPct: null,
      discovered: best.firedate ? best.firedate.replace(" ", "T") : null,
    };
  } catch {
    return null;
  }
}

// Point d'entrée : choisit la source officielle selon le pays du feu.
export async function fetchOfficialPerimeter(
  lat: number,
  lon: number,
  country: string | null,
  firstSeenIso: string
): Promise<OfficialPerimeter | null> {
  if (country === "US") {
    const n = await fetchNifcPerimeter(lat, lon);
    return n
      ? {
          source: "NIFC",
          name: n.name,
          hectares: n.hectares,
          containedPct: n.containedPct,
          discovered: n.discovered,
        }
      : null;
  }
  if (country === "CA") return fetchCwfisPerimeter(lat, lon);
  if (country && EFFIS_COUNTRIES.has(country)) {
    // Fenêtre : 30 jours avant la première détection — un grand feu européen
    // brûle des semaines et sa surface EFFIS porte la date du départ initial
    // (vérifié : Fermoselle, BA du 29/07 pour un foyer re-détecté le 14/08).
    const since = new Date(new Date(firstSeenIso).getTime() - 30 * 86400_000).toISOString();
    return fetchEffisPerimeter(lat, lon, since);
  }
  return null;
}
