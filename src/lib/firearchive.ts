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

function nearestDept(lat: number, lon: number): { code: string; slug: string } | null {
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

function nearestCity(lat: number, lon: number): { place: string | null; country: string | null } {
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

export async function archiveEvents(events: FireEvent[], planes: Plane[]): Promise<number> {
  const sb = supabaseCreds();
  if (!sb) return 0;
  const H = {
    apikey: sb.key,
    Authorization: `Bearer ${sb.key}`,
    "content-type": "application/json",
  };

  const candidates = events.filter(isSignificant).slice(0, 120);
  if (candidates.length === 0) return 0;

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

  return rows.length;
}

// ---- Lecture (pages) ------------------------------------------------------
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
  const sb = supabaseCreds();
  if (!sb) return [];
  try {
    const res = await fetch(
      `${sb.url}/rest/v1/fire_events?select=*&first_seen=gte.${encodeURIComponent(fromIso)}&first_seen=lt.${encodeURIComponent(toIso)}&order=max_frp.desc&limit=${limit}`,
      { headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}` }, cache: "no-store" }
    );
    if (!res.ok) return [];
    return (await res.json()) as ArchivedFire[];
  } catch {
    return [];
  }
}

export async function listFireSlugs(limit = 5000): Promise<{ slug: string; updated_at: string }[]> {
  const sb = supabaseCreds();
  if (!sb) return [];
  try {
    const res = await fetch(
      `${sb.url}/rest/v1/fire_events?select=slug,updated_at&order=last_seen.desc&limit=${limit}`,
      { headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}` }, cache: "no-store" }
    );
    if (!res.ok) return [];
    return (await res.json()) as { slug: string; updated_at: string }[];
  } catch {
    return [];
  }
}
