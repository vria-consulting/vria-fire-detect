// NASA FIRMS (Fire Information for Resource Management System) ingestion.
// Docs: https://firms.modaps.eosdis.nasa.gov/api/area/
// Rate limit: 5000 transactions / 10 min per MAP_KEY.

export type FireProperties = {
  frp: number; // Fire Radiative Power (MW)
  conf: "l" | "n" | "h"; // low / nominal / high
  sat: string; // N20 = NOAA-20, N21 = NOAA-21, G18/G19 = GOES West/East
  acq: string; // ISO 8601 UTC acquisition datetime
  dn: "D" | "N"; // day / night detection
  src: "viirs" | "goes" | "mtg";
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
// GOES 2 km (géostationnaire, rafraîchi ~10 min → précocité).
// Suomi-NPP retiré : plus de production NRT depuis le 2026-07-10.
// « GOES_NRT » est en réalité un composite géostationnaire mondial : G18/G19
// (+ variantes G18FRP/G19FRP, Amériques), Himawari-9 (Asie-Pacifique) et
// Meteosat 9/10/12 (Europe/Afrique/océan Indien).
const SOURCES = ["VIIRS_NOAA20_NRT", "VIIRS_NOAA21_NRT", "GOES_NRT"];

// Les géostationnaires détectent vite mais avec des fausses alarmes à basse
// confiance ; en dessous de ce seuil (%), la détection est écartée. G18/G19
// publient leurs pixels sûrs via G18FRP/G19FRP (confiance 80-100) et une
// traîne de pixels à confiance fixe 30 % que ce seuil écarte volontairement.
const GEO_MIN_CONF = 40;

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

    const sat = f[iSat] || "?";
    // Les Meteosat du composite géostationnaire sont étiquetés « mtg » pour ne
    // pas compter deux fois la même famille de satellites dans la confiance
    // (le flux EUMETSAT direct de mtg.ts couvre le même disque).
    const rowSrc: FireProperties["src"] =
      src === "viirs" ? "viirs" : sat.startsWith("Met") ? "mtg" : "goes";

    // Confiance : lettre (l/n/h) pour VIIRS, nombre pour les géostationnaires —
    // pourcentage 0-100 en général, fraction 0-1 pour Met12 (observé
    // 2026-07-19 : sans normalisation, le filtre vidait Amériques et Europe).
    const confRaw = (f[iConf] || "n").toLowerCase();
    let conf: FireProperties["conf"];
    let confNum = parseFloat(confRaw);
    if (isFinite(confNum)) {
      if (confNum <= 1) confNum *= 100;
      if (rowSrc !== "viirs" && confNum < GEO_MIN_CONF) continue;
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
        sat,
        acq,
        dn: f[iDn] === "N" ? "N" : "D",
        src: rowSrc,
      },
    });
  }
  return features;
}

// Dernier téléchargement réussi par source : FIRMS rejette parfois un CSV
// mondial (plusieurs Mo, surtout GOES) — sans repli, un continent entier
// disparaissait de la carte pendant 5 min (observé le 2026-07-19 : goes=0
// un snapshot sur deux). Des détections vieilles de quelques minutes valent
// toujours mieux qu'un trou.
const lastGood = new Map<string, { at: number; features: FireFeature[] }>();
const LAST_GOOD_MS = 45 * 60 * 1000;

async function fetchSource(
  source: string,
  key: string,
  days: number
): Promise<FireFeature[]> {
  const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${key}/${source}/${WORLD_BBOX}/${days}`;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, { next: { revalidate: 0 } });
      if (!res.ok) {
        console.error(`FIRMS ${source} HTTP ${res.status} (essai ${attempt})`);
        continue;
      }
      const text = await res.text();
      if (text.startsWith("Invalid")) {
        throw new Error("FIRMS_MAP_KEY_INVALID");
      }
      const features = parseCsv(text, source === "GOES_NRT" ? "goes" : "viirs");
      if (features.length > 0) {
        lastGood.set(source, { at: Date.now(), features });
      }
      return features;
    } catch (e) {
      if (e instanceof Error && e.message === "FIRMS_MAP_KEY_INVALID") throw e;
      console.error(`FIRMS ${source} échec réseau (essai ${attempt}):`, e);
    }
  }
  const cached = lastGood.get(source);
  if (cached && Date.now() - cached.at < LAST_GOOD_MS) {
    console.warn(
      `FIRMS ${source} indisponible — réutilisation du téléchargement de ` +
        `${Math.round((Date.now() - cached.at) / 60000)} min`
    );
    return cached.features;
  }
  return [];
}

export async function fetchFires(days: number): Promise<FireCollection> {
  const key = process.env.FIRMS_MAP_KEY;
  if (!key) {
    throw new Error("FIRMS_MAP_KEY_MISSING");
  }
  const results = await Promise.all(
    SOURCES.map((source) => fetchSource(source, key, days))
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
