// Bombardiers d'eau (Canadair) en vol, en quasi temps réel.
// Source : airplanes.live (ADS-B communautaire, gratuit, sans clé, 1 req/s).
// On interroge par type ICAO : CL2T = Canadair CL-415 SuperScooper,
// CL21 = Canadair CL-215. Le résultat est minuscule (quelques appareils dans
// le monde) et mis en cache pour ne pas taper l'API à chaque visite.

const SOURCE = "https://api.airplanes.live/v2/type/CL2T,CL21";
const UA = "kanari.io wildfire map (+https://kanari.io)";
const CACHE_MS = 15_000; // un appel amont toutes les 15 s au maximum

export type Plane = {
  id: string; // hex ICAO 24 bits
  callsign: string;
  reg: string;
  type: string; // CL2T | CL21
  model: string; // libellé lisible (CL-415…)
  lat: number;
  lon: number;
  track: number; // cap en degrés (0 = nord)
  speed: number; // vitesse sol en nœuds
  alt: number | null; // altitude baro en pieds (null si au sol)
};

type Upstream = {
  hex?: string;
  flight?: string;
  r?: string;
  t?: string;
  desc?: string;
  lat?: number;
  lon?: number;
  track?: number;
  gs?: number;
  alt_baro?: number | "ground";
  seen_pos?: number;
};

let cache: { at: number; planes: Plane[] } | null = null;
let inflight: Promise<Plane[]> | null = null;

function parse(list: Upstream[]): Plane[] {
  const out: Plane[] = [];
  for (const a of list) {
    const lat = a.lat;
    const lon = a.lon;
    // On écarte les appareils sans position fraîche (au sol/hangar : lat/lon
    // absents ou 0,0, ou position vue il y a plus de 5 min).
    if (
      typeof lat !== "number" ||
      typeof lon !== "number" ||
      (lat === 0 && lon === 0) ||
      (typeof a.seen_pos === "number" && a.seen_pos > 300)
    ) {
      continue;
    }
    out.push({
      id: a.hex || `${lat},${lon}`,
      callsign: (a.flight || "").trim(),
      reg: (a.r || "").trim(),
      type: a.t || "",
      model: a.desc || (a.t === "CL21" ? "Canadair CL-215" : "Canadair CL-415"),
      lat,
      lon,
      track: typeof a.track === "number" ? a.track : 0,
      speed: typeof a.gs === "number" ? Math.round(a.gs) : 0,
      alt: typeof a.alt_baro === "number" ? a.alt_baro : null,
    });
  }
  return out;
}

export async function getWaterBombers(): Promise<Plane[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.planes;
  // Dédoublonnage des requêtes concurrentes : un seul appel amont à la fois.
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch(SOURCE, {
        headers: { "User-Agent": UA, accept: "application/json" },
        signal: ctrl.signal,
        cache: "no-store",
      });
      clearTimeout(timer);
      if (!res.ok) return cache?.planes ?? [];
      const json = (await res.json()) as { ac?: Upstream[] };
      const planes = parse(json.ac ?? []);
      cache = { at: Date.now(), planes };
      return planes;
    } catch {
      // Source indisponible : on garde le dernier cache connu (jamais d'erreur
      // visible côté carte).
      return cache?.planes ?? [];
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
