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
  country: string; // code pays ISO-2 du propriétaire (via hex/immat), "" si inconnu
};

// Nationalité de l'appareil. On la déduit d'abord du préfixe d'immatriculation
// (fiable quand présent), sinon du bloc d'adresse ICAO 24 bits (hex).
const REG_PREFIX: [RegExp, string][] = [
  [/^I-/, "IT"], [/^F-/, "FR"], [/^EC-/, "ES"], [/^SX-/, "GR"], [/^9A-/, "HR"],
  [/^CS-/, "PT"], [/^TC-/, "TR"], [/^CN-/, "MA"], [/^G-/, "GB"], [/^D-/, "DE"],
  [/^OE-/, "AT"], [/^HB-/, "CH"], [/^LX-/, "LU"], [/^C-?[FGI]/, "CA"], [/^N\d/, "US"],
];

// Blocs d'adresse ICAO (début, fin en décimal, ISO-2) — principaux opérateurs
// de Canadair / bombardiers d'eau + grands pays.
const HEX_RANGES: [number, number, string][] = [
  [0x300000, 0x33ffff, "IT"],
  [0x340000, 0x37ffff, "ES"],
  [0x380000, 0x3bffff, "FR"],
  [0x3c0000, 0x3fffff, "DE"],
  [0x400000, 0x43ffff, "GB"],
  [0x468000, 0x46ffff, "GR"],
  [0x490000, 0x497fff, "PT"],
  [0x4b8000, 0x4bffff, "TR"],
  [0x501000, 0x501fff, "HR"],
  [0x020000, 0x027fff, "MA"],
  [0xc00000, 0xc3ffff, "CA"],
  [0xa00000, 0xafffff, "US"],
];

function countryOf(hex: string, reg: string): string {
  const r = reg.toUpperCase();
  for (const [re, iso] of REG_PREFIX) if (re.test(r)) return iso;
  const n = parseInt(hex, 16);
  if (Number.isFinite(n)) for (const [lo, hi, iso] of HEX_RANGES) if (n >= lo && n <= hi) return iso;
  return "";
}

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
      country: countryOf(a.hex || "", (a.r || "").trim()),
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
