// Observatoire : agrégats de la mémoire des feux, partagés entre les pages
// /[lang]/statistiques/[country]/[month], le serveur MCP et l'API. Une seule
// source de vérité pour « combien de feux en <pays> en <mois> » — c'est ce
// que citent la presse et les assistants IA, donc ça doit être cohérent
// partout.

import citiesJson from "../data/cities.json";
import type { ArchivedFire } from "@/lib/firearchive";

export const ARCHIVE_START = "2026-08-03";

function supabaseCreds(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

// ---- Lecture paginée (PostgREST plafonne à 1000 lignes par requête) -------
const PAGE = 1000;
async function fetchPaged<T>(query: string, limit: number): Promise<T[]> {
  const sb = supabaseCreds();
  if (!sb) return [];
  const H = { apikey: sb.key, Authorization: `Bearer ${sb.key}` };
  const out: T[] = [];
  try {
    for (let offset = 0; offset < limit; offset += PAGE) {
      const size = Math.min(PAGE, limit - offset);
      const res = await fetch(`${sb.url}/rest/v1/fire_events?${query}&limit=${size}&offset=${offset}`, {
        headers: H,
        cache: "no-store",
      });
      if (!res.ok) break;
      const rows = (await res.json()) as T[];
      out.push(...rows);
      if (rows.length < size) break;
    }
  } catch {
    /* lecture partielle : on renvoie ce qu'on a */
  }
  return out;
}

// ---- Mois ------------------------------------------------------------------
export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function monthRange(month: string): { fromIso: string; toIso: string } | null {
  if (!MONTH_RE.test(month)) return null;
  const [y, m] = month.split("-").map(Number);
  const from = new Date(Date.UTC(y, m - 1, 1));
  const to = new Date(Date.UTC(y, m, 1));
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

// Mois couverts par l'archive, du plus récent au premier (2026-08).
export function archiveMonths(now: Date = new Date()): string[] {
  const out: string[] = [];
  const start = new Date(`${ARCHIVE_START}T00:00:00Z`);
  let y = now.getUTCFullYear();
  let m = now.getUTCMonth();
  while (y > start.getUTCFullYear() || (y === start.getUTCFullYear() && m >= start.getUTCMonth())) {
    out.push(`${y}-${String(m + 1).padStart(2, "0")}`);
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  return out;
}

// ---- Recherche dans l'archive -------------------------------------------
export type ArchiveRow = Pick<
  ArchivedFire,
  | "slug"
  | "first_seen"
  | "last_seen"
  | "lat"
  | "lon"
  | "place"
  | "admin"
  | "country"
  | "dept_code"
  | "dept_slug"
  | "detections"
  | "viirs"
  | "goes"
  | "mtg"
  | "max_frp"
  | "confidence"
  | "status"
  | "post_count"
  | "first_press"
> & { aircraft: ArchivedFire["aircraft"] | null };

const ROW_SELECT =
  "slug,first_seen,last_seen,lat,lon,place,admin,country,dept_code,dept_slug,detections,viirs,goes,mtg,max_frp,confidence,status,post_count,first_press,aircraft";

export type ArchiveQuery = {
  cc?: string | null; // ISO-2
  fromIso?: string | null; // first_seen >= from
  toIso?: string | null; // first_seen < to
  minDetections?: number | null;
  minFrp?: number | null;
  status?: "active" | "ended" | null;
  order?: "recent" | "power";
  limit?: number;
};

export async function searchArchive(q: ArchiveQuery): Promise<ArchiveRow[]> {
  const parts = [`select=${ROW_SELECT}`];
  if (q.cc) parts.push(`country=eq.${encodeURIComponent(q.cc.toUpperCase())}`);
  if (q.fromIso) parts.push(`first_seen=gte.${encodeURIComponent(q.fromIso)}`);
  if (q.toIso) parts.push(`first_seen=lt.${encodeURIComponent(q.toIso)}`);
  if (q.minDetections) parts.push(`detections=gte.${q.minDetections}`);
  if (q.minFrp) parts.push(`max_frp=gte.${q.minFrp}`);
  if (q.status) parts.push(`status=eq.${q.status}`);
  parts.push(q.order === "power" ? "order=max_frp.desc" : "order=first_seen.desc");
  return fetchPaged<ArchiveRow>(parts.join("&"), Math.min(Math.max(q.limit ?? 100, 1), 20000));
}

export function fireUrl(slug: string): string {
  return `https://kanari.io/fr/feu/${slug}`;
}

// ---- Agrégats d'une période -----------------------------------------------
export type PeriodStats = {
  fromIso: string;
  toIso: string;
  cc: string | null;
  total: number;
  active: number;
  withAircraft: number;
  withWitnesses: number;
  corroborated: number;
  maxFrp: number;
  byDay: { day: string; n: number }[];
  byCountry: { cc: string; n: number }[];
  byDept: { slug: string; code: string; n: number }[];
  biggest: ArchiveRow[];
  longest: ArchiveRow[];
  truncated: boolean;
};

const MAX_ROWS = 20000;

export async function periodStats(
  fromIso: string,
  toIso: string,
  cc: string | null = null
): Promise<PeriodStats> {
  const rows = await searchArchive({ cc, fromIso, toIso, order: "recent", limit: MAX_ROWS });
  const byDay = new Map<string, number>();
  const byCountry = new Map<string, number>();
  const byDept = new Map<string, { code: string; n: number }>();
  let active = 0;
  let withAircraft = 0;
  let withWitnesses = 0;
  let corroborated = 0;
  let maxFrp = 0;
  for (const r of rows) {
    const day = r.first_seen.slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
    const c = r.country ?? "??";
    byCountry.set(c, (byCountry.get(c) ?? 0) + 1);
    if (r.country === "FR" && r.dept_slug) {
      const d = byDept.get(r.dept_slug) ?? { code: r.dept_code ?? "", n: 0 };
      d.n += 1;
      byDept.set(r.dept_slug, d);
    }
    if (r.status === "active") active += 1;
    if ((r.aircraft?.length ?? 0) > 0) withAircraft += 1;
    if ((r.post_count ?? 0) > 0) withWitnesses += 1;
    if (r.confidence === "corrobore") corroborated += 1;
    if (r.max_frp > maxFrp) maxFrp = r.max_frp;
  }
  const biggest = [...rows].sort((a, b) => b.max_frp - a.max_frp).slice(0, 10);
  const longest = [...rows]
    .sort((a, b) => Date.parse(b.last_seen) - Date.parse(b.first_seen) - (Date.parse(a.last_seen) - Date.parse(a.first_seen)))
    .slice(0, 5);
  return {
    fromIso,
    toIso,
    cc,
    total: rows.length,
    active,
    withAircraft,
    withWitnesses,
    corroborated,
    maxFrp,
    byDay: [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([day, n]) => ({ day, n })),
    byCountry: [...byCountry.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([c, n]) => ({ cc: c, n })),
    byDept: [...byDept.entries()]
      .sort((a, b) => b[1].n - a[1].n)
      .slice(0, 10)
      .map(([slug, d]) => ({ slug, code: d.code, n: d.n })),
    biggest,
    longest,
    truncated: rows.length >= MAX_ROWS,
  };
}

// ---- Pays d'un point : index grille du gazetteer (153 k villes) -------------
// La même table que le géocodage de l'archive (cohérence des codes pays),
// indexée par cellule de 1° pour rester instantané sur des milliers de foyers.
type GazEntry = [number, number, string, string];
let GRID: Map<string, { lat: number; lon: number; cc: string; name: string }[]> | null = null;

function cellKey(lat: number, lon: number): string {
  return `${Math.floor(lat)}:${Math.floor(lon)}`;
}

function buildGrid(): void {
  GRID = new Map();
  for (const entries of Object.values(citiesJson as unknown as Record<string, GazEntry[]>)) {
    for (const [la, lo, cc, name] of entries) {
      const k = cellKey(la, lo);
      const arr = GRID.get(k);
      const item = { lat: la, lon: lo, cc, name };
      if (arr) arr.push(item);
      else GRID.set(k, [item]);
    }
  }
}

export function placeAt(lat: number, lon: number): { place: string | null; country: string | null } {
  if (!GRID) buildGrid();
  let best: { name: string; cc: string } | null = null;
  let bestD = Infinity;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cell = GRID!.get(cellKey(lat + dy, lon + dx));
      if (!cell) continue;
      for (const c of cell) {
        const dLat = c.lat - lat;
        const dLon = (c.lon - lon) * cosLat;
        const d2 = dLat * dLat + dLon * dLon;
        if (d2 < bestD) {
          bestD = d2;
          best = { name: c.name, cc: c.cc };
        }
      }
    }
  }
  // ~80 km max (0.72° au carré) : au-delà, zone inhabitée, on ne nomme pas.
  if (!best || bestD > 0.52) return { place: null, country: null };
  return { place: best.name, country: best.cc };
}
