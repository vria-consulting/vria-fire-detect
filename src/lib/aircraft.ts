// Bombardiers d'eau (Canadair) en vol, en quasi temps réel.
// Source : airplanes.live (ADS-B communautaire, gratuit, sans clé, 1 req/s).
// On interroge par type ICAO : CL2T = Canadair CL-415 SuperScooper,
// CL21 = Canadair CL-215. Le résultat est minuscule (quelques appareils dans
// le monde) et mis en cache pour ne pas taper l'API à chaque visite.

// Deux requêtes complémentaires (airplanes.live, gratuit, sans clé) :
//  1) par TYPE ICAO -> les moyens aériens anti-feu du monde entier.
//     Types « purs » (quasi exclusivement lutte incendie) : Canadair
//     (CL2T/CL4T/CL21), S-2T Turbo Tracker (S2T), DC-10 Air Tanker (DC10),
//     Conair CV-580 (CVLT), S-64 Air Crane (S64), MD-87 (MD87), RJ85/BAe 146
//     tankers (RJ85/B461/B462/B463), OV-10 Bronco de coordination (OV10),
//     K-MAX (K126). Types « mixtes » filtrés ensuite par opérateur/callsign :
//     AT-802 Fire Boss (AT8T, vs épandage agricole), Dash 8 Q400AT (DH8D,
//     Conair vs lignes régulières), C-130 (L382, Coulson vs cargo), Chinook
//     (H47, Coulson/Billings vs militaires), Black Hawk (H60, Firehawk
//     CalFire vs militaires).
//  2) par HEX -> la flotte française de bombardiers d'eau (Pélican + Milan),
//     captée de façon garantie même si son type n'est pas renseigné dans le
//     flux live. Liste de flotte : contribution d'Henri (canadair-tracker),
//     scan du bloc hex 3B7Bxx.
const BASE = "https://api.airplanes.live/v2";
const TYPE_URL = `${BASE}/type/CL2T,CL4T,CL21,AT8T,S2T,DC10,CVLT,S64,MD87,RJ85,B461,B462,B463,OV10,K126,DH8D,L382,H47,H60`;
const UA = "kanari.io wildfire map (+https://kanari.io)";
const CACHE_MS = 15_000; // un appel amont toutes les 15 s au maximum

// Flotte française de bombardiers d'eau (hors hélicos Dragon). hex -> libellé.
export const FRENCH_FLEET: Record<string, { reg: string; model: string }> = {
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
  type: string; // type ICAO (CL2T, AT8T, S64…)
  kind: "plane" | "helo"; // pour l'icône carte
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
  ownOp?: string; // propriétaire/opérateur (base FAA & co)
  lat?: number;
  lon?: number;
  track?: number;
  gs?: number;
  alt_baro?: number | "ground";
  seen_pos?: number;
};

let cache: { at: number; planes: Plane[] } | null = null;
let inflight: Promise<Plane[]> | null = null;

// Filtre anti-faux-positifs des types « mixtes ». Un type absent de cette
// table est considéré pur lutte incendie et passe toujours.
function isFireTanker(a: Upstream): boolean {
  const t = a.t || "";
  const cs = (a.flight || "").trim().toUpperCase();
  const reg = (a.r || "").trim().toUpperCase();
  const op = (a.ownOp || "").toUpperCase();
  switch (t) {
    case "AT8T":
      // AT-802 : aussi épandeur agricole (USA). On garde les callsigns
      // « tanker » (T###, TKR###, S### = SEAT, BOSS…) et les immats hors USA
      // (les Fire Boss européens/canadiens).
      return (
        /^(T|TKR|S)\d{2,3}$/.test(cs) || /^BOSS/.test(cs) || (reg !== "" && !reg.startsWith("N"))
      );
    case "DH8D":
      // Dash 8-400 : avion de ligne courant — on ne garde que les Q400AT
      // de Conair (la flotte française « Milan » est couverte par hex).
      return op.includes("CONAIR");
    case "L382":
      // Hercules civil : Coulson = tanker, le reste est du cargo.
      return op.includes("COULSON");
    case "H47":
      // Chinook : civils porteurs d'eau (Coulson, Billings) vs militaires.
      return op.includes("COULSON") || op.includes("BILLINGS");
    case "H60":
      // Black Hawk : Firehawks CalFire (immat N…DF) ou opérateurs feu/forêt.
      return /^N\d+DF$/.test(reg) || op.includes("FIRE") || op.includes("FORESTRY");
    default:
      return true;
  }
}

// Types hélicoptère (icône dédiée sur la carte).
const HELO_TYPES = new Set(["S64", "H47", "H60", "K126", "EC45"]);

// Libellés lisibles pour les types au descriptif austère.
const TYPE_LABEL: Record<string, string> = {
  AT8T: "Air Tractor AT-802 Fire Boss",
  S2T: "S-2T Turbo Tracker",
  DC10: "DC-10 Air Tanker",
  CVLT: "Conair CV-580 Air Tanker",
  CL21: "Canadair CL-215",
  CL2T: "Canadair CL-415",
  CL4T: "Canadair CL-415",
  S64: "S-64 Air Crane (hélico)",
  MD87: "MD-87 Air Tanker",
  RJ85: "RJ85 Air Tanker",
  B461: "BAe 146 Air Tanker",
  B462: "BAe 146 Air Tanker",
  B463: "BAe 146 Air Tanker",
  OV10: "OV-10 Bronco (coordination)",
  K126: "K-MAX (hélico)",
  DH8D: "Dash 8 Q400AT Air Tanker",
  L382: "C-130 Air Tanker",
  H47: "CH-47 Chinook (hélico)",
  H60: "Firehawk (hélico)",
};

function parse(list: Upstream[]): Plane[] {
  const out: Plane[] = [];
  for (const a of list) {
    if (!isFireTanker(a)) continue;
    const lat = a.lat;
    const lon = a.lon;
    // On écarte les appareils sans position fraîche (lat/lon absents ou 0,0,
    // position vue il y a plus de 5 min) ET ceux au sol (parkings/bases) :
    // la carte ne montre que les moyens réellement en vol.
    if (
      typeof lat !== "number" ||
      typeof lon !== "number" ||
      (lat === 0 && lon === 0) ||
      (typeof a.seen_pos === "number" && a.seen_pos > 300) ||
      a.alt_baro === "ground"
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
      kind: HELO_TYPES.has(a.t || "") ? "helo" : "plane",
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
