// Mémoire des feux : archive les foyers significatifs dans Supabase
// (table fire_events) à chaque passage du cron. Chaque événement archivé
// devient une page permanente /fr/feu/[slug] — le corpus SEO grandit seul.

import type { FireEvent } from "@/lib/cluster";
import type { Plane } from "@/lib/aircraft";
import { DEPARTEMENTS, distKm } from "@/lib/departements";

function supabaseCreds(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

export type ArchivedFire = {
  archive_key: string;
  slug: string;
  event_id: string | null;
  first_seen: string;
  last_seen: string;
  lat: number;
  lon: number;
  detections: number;
  viirs: number;
  goes: number;
  mtg: number;
  max_frp: number;
  confidence: string | null;
  place: string | null;
  admin: string | null;
  country: string | null;
  dept_code: string | null;
  dept_slug: string | null;
  aircraft: { id: string; callsign: string; model: string; country: string; day: string }[];
  post_count: number;
  first_press: string | null;
  status: "active" | "ended";
  updated_at?: string;
};

// ---- Sélection : quels foyers méritent une page permanente ---------------
function inFrance(lat: number, lon: number): boolean {
  return lat >= 41 && lat <= 51.5 && lon >= -5.5 && lon <= 10;
}

export function isSignificant(ev: FireEvent): boolean {
  const [lon, lat] = ev.centroid;
  if (ev.confidence === "corrobore") return true;
  if (inFrance(lat, lon)) return ev.count >= 2 || ev.maxFrp >= 20;
  return ev.count >= 8 || ev.maxFrp >= 100;
}

// ---- Clés & slugs ---------------------------------------------------------
// Jour UTC de 1re détection + cellule ~11 km : fusionne les ids de
// clustering qui dérivent d'un scan à l'autre.
export function archiveKey(ev: FireEvent): string {
  const [lon, lat] = ev.centroid;
  return `${ev.firstSeen.slice(0, 10)}_${lon.toFixed(1)}_${lat.toFixed(1)}`;
}

function hash4(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36).slice(0, 4);
}

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "feu";
}

function makeSlug(place: string | null, key: string): string {
  const date = key.slice(0, 10);
  return `${slugify(place ?? "feu")}-${date}-${hash4(key)}`;
}

export function nearestDept(lat: number, lon: number): { code: string; slug: string } | null {
  if (!inFrance(lat, lon)) return null;
  let best: { code: string; slug: string } | null = null;
  let bestD = 60; // km
  for (const d of DEPARTEMENTS) {
    const dist = distKm(lat, lon, d.lat, d.lon);
    if (dist < bestD) {
      bestD = dist;
      best = { code: d.code, slug: d.slug };
    }
  }
  return best;
}

// ---- Géocodage inverse HORS-LIGNE : gazetteer GeoNames embarqué (153k
// villes). Photon/Nominatim refusent les IP datacenter de Vercel — le
// gazetteer, lui, répond toujours et ne coûte rien.
import citiesJson from "../data/cities.json";
type GazEntry = [number, number, string, string]; // [lat, lon, CC, nom]
let FLAT: { lat: number; lon: number; cc: string; name: string }[] | null = null;

export function nearestCity(lat: number, lon: number): { place: string | null; country: string | null } {
  if (!FLAT) {
    FLAT = [];
    for (const entries of Object.values(citiesJson as unknown as Record<string, GazEntry[]>)) {
      for (const [la, lo, cc, name] of entries) FLAT.push({ lat: la, lon: lo, cc, name });
    }
  }
  let best: { name: string; cc: string } | null = null;
  let bestD = 80; // km — au-delà, zone inhabitée : on laisse sans nom
  for (const c of FLAT) {
    if (Math.abs(c.lat - lat) > 1 || Math.abs(c.lon - lon) > 1.5) continue; // pré-filtre
    const d = distKm(lat, lon, c.lat, c.lon);
    if (d < bestD) {
      bestD = d;
      best = { name: c.name, cc: c.cc };
    }
  }
  return { place: best?.name ?? null, country: best?.cc ?? null };
}

// ---- Écriture -------------------------------------------------------------
const CONF_ORDER: Record<string, number> = { possible: 1, probable: 2, corrobore: 3 };

export async function archiveEvents(
  events: FireEvent[],
  planes: Plane[]
): Promise<{ count: number; newSlugs: string[] }> {
  const sb = supabaseCreds();
  if (!sb) return { count: 0, newSlugs: [] };
  const H = {
    apikey: sb.key,
    Authorization: `Bearer ${sb.key}`,
    "content-type": "application/json",
  };

  const candidates = events.filter(isSignificant).slice(0, 120);
  if (candidates.length === 0) return { count: 0, newSlugs: [] };

  // Lignes existantes pour ces clés (fusion des maxima côté JS).
  const keys = [...new Set(candidates.map(archiveKey))];
  const existing = new Map<string, ArchivedFire>();
  for (let i = 0; i < keys.length; i += 50) {
    const chunk = keys.slice(i, i + 50);
    try {
      const res = await fetch(
        `${sb.url}/rest/v1/fire_events?archive_key=in.(${chunk.map((k) => `"${k}"`).join(",")})`,
        { headers: H }
      );
      if (res.ok) for (const row of (await res.json()) as ArchivedFire[]) existing.set(row.archive_key, row);
    } catch {
      /* lecture partielle : on continue */
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const rows: ArchivedFire[] = [];
  const newSlugs: string[] = [];

  for (const ev of candidates) {
    const key = archiveKey(ev);
    const [lon, lat] = ev.centroid;
    const prev = existing.get(key);
    if (rows.some((r) => r.archive_key === key)) continue; // doublon même run

    let place = prev?.place ?? ev.social?.place ?? null;
    const admin = prev?.admin ?? null;
    let country = prev?.country ?? null;
    if (!place) {
      const g = nearestCity(lat, lon);
      place = g.place;
      if (!country) country = g.country;
    }
    if (!country) country = inFrance(lat, lon) ? "FR" : null;
    // Rattrapage : une ligne archivée sans nom (« feu-… ») reçoit son vrai
    // slug dès que le lieu est résolu — tant que la page est toute jeune.
    const slug =
      prev && prev.slug.startsWith("feu-") && place
        ? makeSlug(place, key)
        : prev?.slug ?? makeSlug(place, key);

    // Moyens aériens à proximité (< 40 km) au moment du scan.
    const nearPlanes = planes
      .filter((p) => distKm(lat, lon, p.lat, p.lon) <= 40)
      .map((p) => ({ id: p.id, callsign: p.callsign || p.reg, model: p.model, country: p.country, day: today }));
    const aircraft = [...(prev?.aircraft ?? [])];
    for (const np of nearPlanes) {
      if (!aircraft.some((a) => a.id === np.id && a.day === np.day)) aircraft.push(np);
    }

    const dept = nearestDept(lat, lon);
    const conf =
      (CONF_ORDER[ev.confidence ?? ""] ?? 0) >= (CONF_ORDER[prev?.confidence ?? ""] ?? 0)
        ? ev.confidence ?? prev?.confidence ?? null
        : prev?.confidence ?? null;

    if (!prev) newSlugs.push(slug);
    rows.push({
      archive_key: key,
      slug,
      event_id: ev.id,
      first_seen: prev && prev.first_seen < ev.firstSeen ? prev.first_seen : ev.firstSeen,
      last_seen: prev && prev.last_seen > ev.lastSeen ? prev.last_seen : ev.lastSeen,
      lat,
      lon,
      detections: Math.max(prev?.detections ?? 0, ev.count),
      viirs: Math.max(prev?.viirs ?? 0, ev.viirsCount),
      goes: Math.max(prev?.goes ?? 0, ev.goesCount),
      mtg: Math.max(prev?.mtg ?? 0, ev.mtgCount),
      max_frp: Math.max(prev?.max_frp ?? 0, ev.maxFrp),
      confidence: conf,
      place,
      admin,
      country,
      dept_code: dept?.code ?? prev?.dept_code ?? null,
      dept_slug: dept?.slug ?? prev?.dept_slug ?? null,
      aircraft,
      post_count: Math.max(prev?.post_count ?? 0, ev.social?.postCount ?? 0),
      first_press: prev?.first_press ?? ev.social?.firstPress ?? null,
      status: "active",
      updated_at: new Date().toISOString(),
    });
  }

  if (rows.length > 0) {
    try {
      await fetch(`${sb.url}/rest/v1/fire_events?on_conflict=archive_key`, {
        method: "POST",
        headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(rows),
      });
    } catch (e) {
      console.error("fire archive upsert failed:", e);
    }
  }

  // Clôture : plus aucun signal depuis 36 h -> « ended » (page figée).
  try {
    const cutoff = new Date(Date.now() - 36 * 3600 * 1000).toISOString();
    await fetch(
      `${sb.url}/rest/v1/fire_events?status=eq.active&last_seen=lt.${encodeURIComponent(cutoff)}`,
      { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ status: "ended", updated_at: new Date().toISOString() }) }
    );
  } catch {
    /* clôture au prochain passage */
  }

  return { count: rows.length, newSlugs };
}

// ---- Lecture (pages) ------------------------------------------------------
// PostgREST plafonne chaque réponse à 1000 lignes : toute lecture qui peut
// dépasser ce seuil doit paginer par offset, sinon les totaux mentent.
const PAGE = 1000;

async function fetchPaged<T>(query: string, limit: number): Promise<T[]> {
  const sb = supabaseCreds();
  if (!sb) return [];
  const H = { apikey: sb.key, Authorization: `Bearer ${sb.key}` };
  const out: T[] = [];
  try {
    for (let offset = 0; offset < limit; offset += PAGE) {
      const size = Math.min(PAGE, limit - offset);
      const res = await fetch(
        `${sb.url}/rest/v1/fire_events?${query}&limit=${size}&offset=${offset}`,
        { headers: H, cache: "no-store" }
      );
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

// Comptage exact sans rapatrier les lignes (en-tête Content-Range).
export async function countFires(filter: string): Promise<number | null> {
  const sb = supabaseCreds();
  if (!sb) return null;
  try {
    const res = await fetch(`${sb.url}/rest/v1/fire_events?select=archive_key&${filter}&limit=1`, {
      method: "HEAD",
      headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}`, Prefer: "count=exact" },
      cache: "no-store",
    });
    const range = res.headers.get("content-range"); // ex. "0-0/4321"
    const total = range?.split("/")[1];
    return total && total !== "*" ? Number(total) : null;
  } catch {
    return null;
  }
}

// Version allégée pour les agrégats (top pays/départements) : ~60 octets par
// ligne, on peut charger toute l'archive sans se ruiner.
export type FireLite = {
  first_seen: string;
  status: string;
  country: string | null;
  dept_slug: string | null;
  max_frp: number;
};

export async function listFiresLite(fromIso: string, limit = 50000): Promise<FireLite[]> {
  return fetchPaged<FireLite>(
    `select=first_seen,status,country,dept_slug,max_frp&first_seen=gte.${encodeURIComponent(fromIso)}&order=first_seen.desc`,
    limit
  );
}

export async function getFireBySlug(slug: string): Promise<ArchivedFire | null> {
  const sb = supabaseCreds();
  if (!sb) return null;
  try {
    const res = await fetch(
      `${sb.url}/rest/v1/fire_events?slug=eq.${encodeURIComponent(slug)}&limit=1`,
      { headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}` }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as ArchivedFire[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function listRecentFires(limit = 60): Promise<ArchivedFire[]> {
  const sb = supabaseCreds();
  if (!sb) return [];
  try {
    const res = await fetch(
      `${sb.url}/rest/v1/fire_events?select=*&order=last_seen.desc&limit=${limit}`,
      { headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}` }, cache: "no-store" }
    );
    if (!res.ok) return [];
    return (await res.json()) as ArchivedFire[];
  } catch {
    return [];
  }
}

// Feux dont la PREMIÈRE détection tombe dans [fromIso, toIso) — base des
// bilans quotidiens et des statistiques.
export async function listFiresBetween(
  fromIso: string,
  toIso: string,
  limit = 2000
): Promise<ArchivedFire[]> {
  return fetchPaged<ArchivedFire>(
    `select=*&first_seen=gte.${encodeURIComponent(fromIso)}&first_seen=lt.${encodeURIComponent(toIso)}&order=max_frp.desc`,
    limit
  );
}

// Feux archivés d'un département français (pages /fr/feux/[dept]) — la
// mémoire locale qui rend chaque page départementale unique.
export async function listFiresByDept(deptSlug: string, limit = 30): Promise<ArchivedFire[]> {
  return fetchPaged<ArchivedFire>(
    `select=*&dept_slug=eq.${encodeURIComponent(deptSlug)}&order=last_seen.desc`,
    limit
  );
}

// Feux encore actifs d'un pays (page /fr/feux-en-cours) : liens vers les
// pages permanentes des foyers en cours de suivi.
export async function listActiveFires(cc: string, limit = 100): Promise<ArchivedFire[]> {
  return fetchPaged<ArchivedFire>(
    `select=*&country=eq.${encodeURIComponent(cc)}&status=eq.active&order=last_seen.desc`,
    limit
  );
}

// Feux d'un pays (pages /en/fires/[country]) — plus récents d'abord.
export async function listFiresByCountry(cc: string, limit = 30): Promise<ArchivedFire[]> {
  const sb = supabaseCreds();
  if (!sb) return [];
  try {
    const res = await fetch(
      `${sb.url}/rest/v1/fire_events?select=*&country=eq.${encodeURIComponent(cc)}&order=last_seen.desc&limit=${limit}`,
      { headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}` }, cache: "no-store" }
    );
    if (!res.ok) return [];
    return (await res.json()) as ArchivedFire[];
  } catch {
    return [];
  }
}

// Feux où un appareil donné a été observé (pages /fr/canadair/[immat]).
export async function listFiresByAircraft(hex: string, limit = 30): Promise<ArchivedFire[]> {
  const sb = supabaseCreds();
  if (!sb) return [];
  try {
    const filter = encodeURIComponent(JSON.stringify([{ id: hex }]));
    const res = await fetch(
      `${sb.url}/rest/v1/fire_events?select=*&aircraft=cs.${filter}&order=last_seen.desc&limit=${limit}`,
      { headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}` }, cache: "no-store" }
    );
    if (!res.ok) return [];
    return (await res.json()) as ArchivedFire[];
  } catch {
    return [];
  }
}

// Slugs des pages feu destinées à l'index (sitemap-events) : même règle que
// la balise robots de /fr/feu/[slug] — un feu « mince » (< 3 détections,
// sans moyen aérien, FRP < 20 MW) est noindex et ne doit donc pas être
// poussé aux moteurs : 5 000 URLs quasi identiques dans un sitemap, c'est
// la masse « découvertes, non indexées » qui a fait décrocher Bing et Google.
// Mesuré sur l'archive (10 000 feux, 22/08/2026) : 97 % des feux dépassent
// 20 MW et 80 % comptent 3 détections ou plus — la première règle (≥ 3 ou
// ≥ 20 MW) laissait donc tout passer. Celle-ci garde ~30 % : les feux
// français (pertinence locale, requêtes « incendie <lieu> »), ceux qui ont
// du contenu unique (témoins vérifiés, moyens aériens observés) et les gros
// feux (≥ 20 détections ou ≥ 200 MW). Le reste est noindex,follow : toujours
// maillé, dans le RSS et l'API, mais plus poussé aux moteurs.
export type IndexableFields = {
  detections: number;
  max_frp: number;
  aircraft: unknown[] | null;
  country: string | null;
  dept_code: string | null;
  post_count: number | null;
};

export function isFireIndexable(f: IndexableFields): boolean {
  return (
    f.country === "FR" ||
    !!f.dept_code ||
    (f.post_count ?? 0) > 0 ||
    (f.aircraft?.length ?? 0) > 0 ||
    f.detections >= 20 ||
    f.max_frp >= 200
  );
}

export async function listFireSlugs(limit = 5000): Promise<{ slug: string; updated_at: string }[]> {
  type Row = IndexableFields & { slug: string; updated_at: string };
  const rows = await fetchPaged<Row>(
    `select=slug,updated_at,detections,max_frp,aircraft,country,dept_code,post_count&order=last_seen.desc`,
    limit
  );
  return rows.filter(isFireIndexable).map(({ slug, updated_at }) => ({ slug, updated_at }));
}
