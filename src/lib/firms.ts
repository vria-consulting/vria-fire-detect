// NASA FIRMS (Fire Information for Resource Management System) ingestion.
// Docs: https://firms.modaps.eosdis.nasa.gov/api/area/
// Rate limit: 5000 transactions / 10 min per MAP_KEY.

export type FireProperties = {
  frp: number; // Fire Radiative Power (MW)
  conf: "l" | "n" | "h"; // low / nominal / high
  sat: string; // N20 = NOAA-20, N21 = NOAA-21, G18/G19 = GOES West/East
  acq: string; // ISO 8601 UTC acquisition datetime
  dn: "D" | "N"; // day / night detection
  src: "viirs" | "goes";
};

export type FireFeature = {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: FireProperties;
};

export type FireCollection = {
  type: "FeatureCollection";
  features: FireFeature[];
  meta: { sources: string[]; days: number; fetchedAt: string; count: number };
};

// VIIRS 375 m (orbite polaire, monde, ~4x/jour, sensible aux petits feux) +
// GOES 2 km (géostationnaire, Amériques, rafraîchi ~10 min → précocité).
// Suomi-NPP retiré : plus de production NRT depuis le 2026-07-10.
const SOURCES = ["VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "GOES_NRT"];

// GOES détecte vite mais avec des fausses alarmes à basse confiance ;
// en dessous de ce seuil (%), la détection est écartée.
const GOES_MIN_CONF = 40;

const WORLD_BBOX = "-180,-90,180,90";

function parseCsv(csv: string, src: FireProperties["src"]): FireFeature[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].split(",");
  const col = (name: string) => header.indexOf(name);
  const iLat = col("latitude");
  const iLon = col("longitude");
  const iDate = col("acq_date");
  const iTime = col("acq_time");
  const iSat = col("satellite");
  const iConf = col("confidence");
  const iFrp = col("frp");
  const iDn = col("daynight");
  if (iLat < 0 || iLon < 0) return [];

  const features: FireFeature[] = [];
  for (let k = 1; k < lines.length; k++) {
    const f = lines[k].split(",");
    const lat = parseFloat(f[iLat]);
    const lon = parseFloat(f[iLon]);
    if (!isFinite(lat) || !isFinite(lon)) continue;

    // Confiance : lettre (l/n/h) pour VIIRS, pourcentage pour GOES.
    const confRaw = (f[iConf] || "n").toLowerCase();
    let conf: FireProperties["conf"];
    const confNum = parseFloat(confRaw);
    if (isFinite(confNum)) {
      if (src === "goes" && confNum < GOES_MIN_CONF) continue;
      conf = confNum >= 80 ? "h" : confNum >= 50 ? "n" : "l";
    } else {
      conf = confRaw === "l" || confRaw === "h" ? (confRaw as "l" | "h") : "n";
    }

    // acq_time est "HMM"/"HHMM" (UTC).
    const hhmm = f[iTime].padStart(4, "0");
    const acq = `${f[iDate]}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00Z`;
    const frp = parseFloat(f[iFrp]);
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        frp: isFinite(frp) && frp > 0 ? frp : 0,
        conf,
        sat: f[iSat] || "?",
        acq,
        dn: f[iDn] === "N" ? "N" : "D",
        src,
      },
    });
  }
  return features;
}

export async function fetchFires(days: number): Promise<FireCollection> {
  const key = process.env.FIRMS_MAP_KEY;
  if (!key) {
    throw new Error("FIRMS_MAP_KEY_MISSING");
  }
  const results = await Promise.all(
    SOURCES.map(async (source) => {
      const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${source}/${WORLD_BBOX}/${days}`;
      const res = await fetch(url, { next: { revalidate: 0 } });
      if (!res.ok) {
        console.error(`FIRMS ${source} HTTP ${res.status}`);
        return [];
      }
      const text = await res.text();
      if (text.startsWith("Invalid")) {
        throw new Error("FIRMS_MAP_KEY_INVALID");
      }
      return parseCsv(text, source === "GOES_NRT" ? "goes" : "viirs");
    })
  );
  const features = results.flat();
  return {
    type: "FeatureCollection",
    features,
    meta: {
      sources: SOURCES,
      days,
      fetchedAt: new Date().toISOString(),
      count: features.length,
    },
  };
}
