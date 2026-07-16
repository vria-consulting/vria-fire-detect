// Corroboration sociale d'un foyer : géocodage inverse du centroïde
// (Nominatim/OSM) puis recherche de témoignages sur Bluesky autour des noms
// de lieux, dans la langue locale + anglais. Coût : zéro (APIs publiques).

import { searchPosts, postUrl } from "./bsky";

export type SocialPost = {
  text: string;
  author: string;
  handle: string;
  createdAt: string;
  url: string;
};

export type SocialResult = {
  place: string | null;
  queries: string[];
  posts: SocialPost[];
  // Statut HTTP de chaque requête Bluesky — pour diagnostiquer un blocage
  // (200 = OK, 403 = bloqué, 0 = échec réseau).
  searchStatuses?: number[];
};

const NOMINATIM_UA = "VigiFire/0.1 (https://vria-fire-detect.vercel.app)";

const TERMS_BY_LANG: Record<string, string[]> = {
  fr: ["incendie", "feu", "fumée"],
  es: ["incendio", "fuego", "humo"],
  pt: ["incêndio", "fogo", "fumaça"],
  de: ["Waldbrand", "Feuer", "Rauch"],
  it: ["incendio", "fumo"],
  el: ["φωτιά", "πυρκαγιά"],
  tr: ["yangın", "duman"],
  en: ["fire", "wildfire", "smoke"],
};

const LANG_BY_COUNTRY: Record<string, string> = {
  fr: "fr", be: "fr", mc: "fr", lu: "fr", ma: "fr", dz: "fr", tn: "fr",
  es: "es", mx: "es", ar: "es", cl: "es", co: "es", pe: "es", bo: "es", ve: "es", ec: "es", uy: "es", py: "es", gt: "es", hn: "es", ni: "es", cr: "es", pa: "es", do: "es", cu: "es",
  pt: "pt", br: "pt", ao: "pt", mz: "pt",
  de: "de", at: "de",
  it: "it",
  gr: "el", cy: "el",
  tr: "tr",
};

type Geo = { place: string | null; county: string | null; countryCode: string | null };

const geoCache = new Map<string, Geo>();

async function reverseGeocode(lat: number, lon: number): Promise<Geo> {
  const key = `${lat.toFixed(1)}:${lon.toFixed(1)}`;
  const hit = geoCache.get(key);
  if (hit) return hit;
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&zoom=10`;
  const res = await fetch(url, { headers: { "User-Agent": NOMINATIM_UA } });
  if (!res.ok) return { place: null, county: null, countryCode: null };
  const j = await res.json();
  const a = j.address ?? {};
  const geo: Geo = {
    place: a.village ?? a.town ?? a.city ?? a.municipality ?? a.county ?? null,
    county: a.county ?? a.state_district ?? a.state ?? null,
    countryCode: a.country_code ?? null,
  };
  geoCache.set(key, geo);
  return geo;
}

export async function findWitnessPosts(
  lat: number,
  lon: number,
  sinceHours = 48
): Promise<SocialResult> {
  const geo = await reverseGeocode(lat, lon);
  const places = [geo.place, geo.county].filter(
    (p, i, arr): p is string => !!p && arr.indexOf(p) === i
  );
  if (places.length === 0) return { place: null, queries: [], posts: [] };

  const lang = geo.countryCode ? LANG_BY_COUNTRY[geo.countryCode] : undefined;
  const terms = [...new Set([...(lang ? TERMS_BY_LANG[lang] : []), ...TERMS_BY_LANG.en])];

  // Max 6 requêtes par foyer : 2 noms de lieux x 3 termes prioritaires.
  const queries: string[] = [];
  for (const place of places.slice(0, 2)) {
    for (const term of terms.slice(0, 3)) {
      queries.push(`"${place}" ${term}`);
    }
  }

  const since = Date.now() - sinceHours * 3_600_000;
  const results = await Promise.all(
    queries.map((q) => searchPosts(q).catch(() => ({ posts: [], status: 0 })))
  );
  const searchStatuses = results.map((r) => r.status);
  const seen = new Set<string>();
  const posts: SocialPost[] = [];
  for (const p of results.flatMap((r) => r.posts)) {
    if (seen.has(p.uri)) continue;
    seen.add(p.uri);
    const createdAt = p.record?.createdAt ?? "";
    if (!createdAt || new Date(createdAt).getTime() < since) continue;
    posts.push({
      text: p.record?.text ?? "",
      author: p.author.displayName || p.author.handle,
      handle: p.author.handle,
      createdAt,
      url: postUrl(p),
    });
  }
  posts.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return { place: places[0], queries, posts: posts.slice(0, 20), searchStatuses };
}
