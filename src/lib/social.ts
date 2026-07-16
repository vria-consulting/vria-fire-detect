// Corroboration sociale d'un foyer : géocodage inverse du centroïde
// (Nominatim/OSM) puis recherche de témoignages sur Bluesky autour des noms
// de lieux, dans la langue locale + anglais. Coût : zéro (APIs publiques).

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

// --- Bluesky ---

const PUBLIC_SEARCH = "https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts";
const AUTH_BASE = "https://bsky.social/xrpc";

let session: { jwt: string; at: number } | null = null;

async function bskyAuth(): Promise<string | null> {
  const id = process.env.BSKY_IDENTIFIER;
  const pw = process.env.BSKY_APP_PASSWORD;
  if (!id || !pw) return null;
  if (session && Date.now() - session.at < 45 * 60 * 1000) return session.jwt;
  const res = await fetch(`${AUTH_BASE}/com.atproto.server.createSession`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: id, password: pw }),
  });
  if (!res.ok) {
    console.error("bsky auth failed", res.status);
    return null;
  }
  const j = await res.json();
  session = { jwt: j.accessJwt, at: Date.now() };
  return session.jwt;
}

type BskyPost = {
  uri: string;
  author: { handle: string; displayName?: string };
  record: { text?: string; createdAt?: string };
};

async function searchPosts(q: string): Promise<{ posts: BskyPost[]; status: number }> {
  const params = `?q=${encodeURIComponent(q)}&limit=20&sort=latest`;
  // 1. Endpoint public (sans authentification)
  let res = await fetch(PUBLIC_SEARCH + params, {
    headers: { "User-Agent": NOMINATIM_UA },
  });
  // 2. Repli authentifié si le public est bloqué et que des identifiants existent
  if (!res.ok) {
    const publicStatus = res.status;
    const jwt = await bskyAuth();
    if (!jwt) return { posts: [], status: publicStatus };
    res = await fetch(`${AUTH_BASE}/app.bsky.feed.searchPosts${params}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) return { posts: [], status: res.status };
  }
  const j = await res.json();
  return { posts: j.posts ?? [], status: res.status };
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
    const rkey = p.uri.split("/").pop();
    posts.push({
      text: p.record?.text ?? "",
      author: p.author.displayName || p.author.handle,
      handle: p.author.handle,
      createdAt,
      url: `https://bsky.app/profile/${p.author.handle}/post/${rkey}`,
    });
  }
  posts.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return { place: places[0], queries, posts: posts.slice(0, 20), searchStatuses };
}
