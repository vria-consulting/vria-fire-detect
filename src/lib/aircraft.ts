// Bombardiers d'eau (Canadair) en vol, en quasi temps réel.
// Source : airplanes.live (ADS-B communautaire, gratuit, sans clé, 1 req/s).
// On interroge par type ICAO : CL2T = Canadair CL-415 SuperScooper,
// CL21 = Canadair CL-215. Le résultat est minuscule (quelques appareils dans
// le monde) et mis en cache pour ne pas taper l'API à chaque visite.

// Deux requêtes complémentaires (airplanes.live, gratuit, sans clé) :
//  1) par TYPE ICAO -> les bombardiers d'eau du monde entier :
//     CL2T/CL4T/CL21 (Canadair 415/215), AT8T (Air Tractor AT-802 /
//     Fire Boss), S2T (S-2T Turbo Tracker CalFire), DC10 (DC-10 Air Tanker),
//     CVLT (Conair CV-580). Les types « avion de ligne » (Dash-8, RJ85…)
//     sont volontairement exclus : trop de faux positifs commerciaux — les
//     Dash-8 bombardiers français sont couverts par la flotte hex ci-dessous.
//  2) par HEX -> la flotte française de bombardiers d'eau (Pélican + Milan),
//     captée de façon garantie même si son type n'est pas renseigné dans le
//     flux live. Liste de flotte : contribution d'Henri (canadair-tracker),
//     scan du bloc hex 3B7Bxx.
const BASE = "https://api.airplanes.live/v2";
const TYPE_URL = `${BASE}/type/CL2T,CL4T,CL21,AT8T,S2T,DC10,CVLT`;
const UA = "kanari.io wildfire map (+https://kanari.io)";
const CACHE_MS = 15_000; // un appel amont toutes les 15 s au maximum

// Flotte française de bombardiers d'eau (hors hélicos Dragon). hex -> libellé.
const FRENCH_FLEET: Record<string, { reg: string; model: string }> = {
  // Pélican — Canadair CL-415
  "3b7b6b": { reg: "F-ZBMG", model: "Canadair CL-415 « Pélican »" },
  "3b7b6c": { reg: "F-ZBFX", model: "Canadair CL-415 « Pélican »" },
  "3b7b6d": { reg: "F-ZBFN", model: "Canadair CL-415 « Pélican »" },
  "3b7b6e": { reg: "F-ZBFS", model: "Canadair CL-415 « Pélican »" },
  "3b7b6f": { reg: "F-ZBFP", model: "Canadair CL-415 « Pélican »" },
  "3b7b70": { reg: "F-ZBMF", model: "Canadair CL-415 « Pélican »" },
  "3b7b71": { reg: "F-ZBME", model: "Canadair CL-415 « Pélican »" },
  "3b7b72": { reg: "F-ZBEU", model: "Canadair CL-415 « Pélican »" },
  "3b7b73": { reg: "F-ZBEG", model: "Canadair CL-415 « Pélican »" },
  "3b7b74": { reg: "F-ZBFW", model: "Canadair CL-415 « Pélican »" },
  "3b7b75": { reg: "F-ZBFV", model: "Canadair CL-415 « Pélican »" },
  "3b7b76": { reg: "F-ZBFY", model: "Canadair CL-415 « Pélican »" },
  // Milan — Dash 8-402MR (gros bombardier d'eau)
  "3b7b3d": { reg: "F-ZBMK", model: "Dash 8 « Milan »" },
  "3b7b3e": { reg: "F-ZBMJ", model: "Dash 8 « Milan »" },
  "3b7b3f": { reg: "F-ZBMI", model: "Dash 8 « Milan »" },
  "3b7b63": { reg: "F-ZBMH", model: "Dash 8 « Milan »" },
  "3b7b85": { reg: "F-ZBMD", model: "Dash 8 « Milan »" },
  "3b7b86": { reg: "F-ZBMC", model: "Dash 8 « Milan »" },
};
const HEX_URL = `${BASE}/hex/${Object.keys(FRENCH_FLEET).join(",")}`;

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

// L'AT-802 sert aussi à l'épandage agricole (surtout aux USA). On ne garde
// que les appareils en configuration lutte incendie : callsign « tanker »
// (T###, TKR###, S### = SEAT) ou immatriculation hors USA (les AT-802
// européens/canadiens suivis ici sont des Fire Boss anti-incendie).
function isFireTanker(a: Upstream): boolean {
  if (a.t !== "AT8T") return true;
  const cs = (a.flight || "").trim().toUpperCase();
  if (/^(T|TKR|S)\d{2,3}$/.test(cs) || /^BOSS/.test(cs)) return true;
  const reg = (a.r || "").trim().toUpperCase();
  return reg !== "" && !reg.startsWith("N");
}

// Libellés lisibles pour les types au descriptif austère.
const TYPE_LABEL: Record<string, string> = {
  AT8T: "Air Tractor AT-802 Fire Boss",
  S2T: "S-2T Turbo Tracker",
  DC10: "DC-10 Air Tanker",
  CVLT: "Conair CV-580 Air Tanker",
  CL21: "Canadair CL-215",
  CL2T: "Canadair CL-415",
  CL4T: "Canadair CL-415",
};

function parse(list: Upstream[]): Plane[] {
  const out: Plane[] = [];
  for (const a of list) {
    if (!isFireTanker(a)) continue;
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
    const hex = (a.hex || "").toLowerCase();
    const fleet = FRENCH_FLEET[hex];
    out.push({
      id: a.hex || `${lat},${lon}`,
      callsign: (a.flight || "").trim(),
      reg: (a.r || "").trim() || fleet?.reg || "",
      type: a.t || "",
      // Libellé de la flotte française prioritaire (« Pélican », « Milan »),
      // puis libellé dédié par type, puis descriptif brut de la base.
      model:
        fleet?.model || TYPE_LABEL[a.t || ""] || a.desc || "Bombardier d'eau",
      lat,
      lon,
      track: typeof a.track === "number" ? a.track : 0,
      speed: typeof a.gs === "number" ? Math.round(a.gs) : 0,
      alt: typeof a.alt_baro === "number" ? a.alt_baro : null,
      country: fleet ? "FR" : countryOf(a.hex || "", (a.r || "").trim()),
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
      const pull = async (url: string): Promise<Upstream[]> => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 6000);
        try {
          const res = await fetch(url, {
            headers: { "User-Agent": UA, accept: "application/json" },
            signal: ctrl.signal,
            cache: "no-store",
          });
          if (!res.ok) return [];
          return ((await res.json()) as { ac?: Upstream[] }).ac ?? [];
        } catch {
          return [];
        } finally {
          clearTimeout(timer);
        }
      };
      // L'API amont limite à 1 req/s : on sérialise les deux requêtes.
      const byType = await pull(TYPE_URL);
      await new Promise((r) => setTimeout(r, 1100));
      const byHex = await pull(HEX_URL);
      // Fusion dédoublonnée par hex (un Pélican peut sortir des deux listes).
      const seen = new Set<string>();
      const merged: Upstream[] = [];
      for (const a of [...byType, ...byHex]) {
        const key = (a.hex || "").toLowerCase();
        if (key && seen.has(key)) continue;
        if (key) seen.add(key);
        merged.push(a);
      }
      if (merged.length === 0 && byType.length === 0 && byHex.length === 0 && cache) {
        // Deux échecs réseau : on garde le dernier état connu.
        return cache.planes;
      }
      const planes = parse(merged);
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
