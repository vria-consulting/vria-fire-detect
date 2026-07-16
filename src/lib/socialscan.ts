// Veille sociale proactive : recherche Bluesky des posts très récents
// mentionnant un feu de forêt (8 langues), géolocalisés par nom de lieu via
// un gazetteer GeoNames embarqué (villes de 5000+ habitants, licence CC-BY).
// Objectif précocité : un témoignage peut précéder de plusieurs heures le
// prochain passage satellite.

import cities from "@/data/cities.json";
import { searchPosts, postUrl } from "./bsky";
import { fetchPressArticles } from "./press";
import { triageCandidates } from "./triage";
import { TERMS_BY_LANG, LANG_BY_COUNTRY } from "./social";
import type { SocialPost } from "./social";

// [lat, lon, countryCode, displayName]
const GAZETTEER = cities as unknown as Record<string, [number, number, string, string]>;

// Expressions fortes uniquement (pas "fire"/"feu" seuls : trop de métaphores).
const SCAN_QUERIES = [
  '"wildfire"',
  '"forest fire"',
  '"brush fire"',
  '"bushfire"',
  '"grass fire"',
  '"feu de forêt"',
  '"départ de feu"',
  '"incendie"',
  '"incendio forestal"',
  '"incendio"',
  '"incêndio florestal"',
  '"queimada"',
  '"Waldbrand"',
  '"incendio boschivo"',
  '"πυρκαγιά"',
  '"orman yangını"',
];

export type SocialSignal = {
  place: string;
  countryCode: string;
  lat: number;
  lon: number;
  postCount: number;
  firstPost: string; // ISO — plus ancien post de la fenêtre pour ce lieu
  lastPost: string;
  posts: SocialPost[];
  // true = les toutes premières mentions de ce lieu datent de moins d'1 h
  // (vérifié contre l'historique Bluesky) -> candidat "départ de feu".
  // Un feu qui dure fait encore parler de lui : lastPost récent mais newFire=false.
  newFire?: boolean;
};

// Vérifie s'il existait déjà des mentions feu+lieu AVANT la date de coupure.
// C'est la parade au biais d'échantillonnage : un gros feu en cours génère
// tellement de posts récents que la fenêtre de scan ne voit plus les anciens.
export async function hasMentionsBefore(
  place: string,
  countryCode: string,
  untilIso: string
): Promise<boolean> {
  const lang = LANG_BY_COUNTRY[countryCode.toLowerCase()];
  const terms = [
    ...(lang ? TERMS_BY_LANG[lang].slice(0, 1) : []),
    TERMS_BY_LANG.en[0], // "fire"
  ];
  for (const term of terms) {
    try {
      const { posts } = await searchPosts(`"${place}" ${term}`, 5, { until: untilIso });
      if (posts.length > 0) return true;
    } catch {
      // en cas d'échec réseau, on ne conclut pas
    }
  }
  return false;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Extrait les lieux mentionnés : n-grammes (1 à 3 mots) commençant par une
// majuscule dans le texte original, cherchés dans le gazetteer.
function extractPlaces(text: string): { key: string; entry: [number, number, string, string] }[] {
  const tokens = text.split(/[^\p{L}''-]+/u).filter(Boolean);
  const found = new Map<string, [number, number, string, string]>();
  for (let i = 0; i < tokens.length; i++) {
    // Un nom de lieu commence par une majuscule.
    if (!/\p{Lu}/u.test(tokens[i][0])) continue;
    for (let n = 3; n >= 1; n--) {
      if (i + n > tokens.length) break;
      const gram = tokens.slice(i, i + n).join(" ");
      const key = normalize(gram);
      const entry = GAZETTEER[key];
      if (entry) {
        found.set(key, entry);
        break; // le n-gramme le plus long gagne
      }
    }
  }
  return [...found.entries()].map(([key, entry]) => ({ key, entry }));
}

export async function scanSocial(sinceHours = 12): Promise<{
  signals: SocialSignal[];
  scannedPosts: number;
  statuses: number[];
}> {
  const [results, pressArticles] = await Promise.all([
    Promise.all(
      SCAN_QUERIES.map((q) => searchPosts(q, 50).catch(() => ({ posts: [], status: 0 })))
    ),
    fetchPressArticles(3),
  ]);
  const statuses = results.map((r) => r.status);
  const since = Date.now() - sinceHours * 3_600_000;

  const byPlace = new Map<string, SocialSignal>();
  const seen = new Set<string>();
  let scannedPosts = 0;

  const addToPlace = (key: string, entry: [number, number, string, string], post: SocialPost) => {
    const sig = byPlace.get(key);
    if (sig) {
      sig.postCount++;
      sig.posts.push(post);
      if (post.createdAt < sig.firstPost) sig.firstPost = post.createdAt;
      if (post.createdAt > sig.lastPost) sig.lastPost = post.createdAt;
    } else {
      byPlace.set(key, {
        place: entry[3],
        countryCode: entry[2],
        lat: entry[0],
        lon: entry[1],
        postCount: 1,
        firstPost: post.createdAt,
        lastPost: post.createdAt,
        posts: [post],
      });
    }
  };

  // 1. Collecte des candidats (posts + articles avec au moins un lieu).
  type Candidate = {
    post: SocialPost;
    places: { key: string; entry: [number, number, string, string] }[];
  };
  const candidates: Candidate[] = [];

  // Articles de presse (GDELT) : le titre est géoparsé comme un post.
  for (const art of pressArticles) {
    if (new Date(art.createdAt).getTime() < since) continue;
    const places = extractPlaces(art.title);
    if (places.length === 0 || places.length > 3) continue;
    candidates.push({
      post: {
        text: art.title,
        author: art.domain,
        handle: art.domain,
        createdAt: art.createdAt,
        url: art.url,
        source: "presse",
      },
      places,
    });
  }

  for (const p of results.flatMap((r) => r.posts)) {
    if (seen.has(p.uri)) continue;
    seen.add(p.uri);
    scannedPosts++;
    const createdAt = p.record?.createdAt ?? "";
    if (!createdAt || new Date(createdAt).getTime() < since) continue;
    const text = p.record?.text ?? "";
    const places = extractPlaces(text);
    if (places.length === 0 || places.length > 3) continue; // 4+ lieux = revue de presse
    candidates.push({
      post: {
        text,
        author: p.author.displayName || p.author.handle,
        handle: p.author.handle,
        createdAt,
        url: postUrl(p),
        source: "bluesky",
      },
      places,
    });
  }

  // 2. Tri de pertinence par IA : feu en cours ? quel lieu est celui du feu ?
  // Sans clé API (verdicts === null), on garde le comportement mots-clés seul.
  const verdicts = await triageCandidates(
    candidates.map((c) => ({
      url: c.post.url,
      text: c.post.text,
      places: c.places.map((p) => p.entry[3]),
    }))
  );

  for (const c of candidates) {
    if (verdicts) {
      const v = verdicts.get(c.post.url);
      if (v) {
        // Jugé : on n'ancre le post QUE sur le lieu du feu identifié.
        if (!v.fire || v.place == null) continue;
        const chosen = c.places[v.place];
        if (chosen) addToPlace(chosen.key, chosen.entry, c.post);
        continue;
      }
      // Non jugé (quota ou échec API) : repli mots-clés pour ne rien perdre.
    }
    for (const { key, entry } of c.places) addToPlace(key, entry, c.post);
  }

  const signals = [...byPlace.values()].map((s) => ({
    ...s,
    posts: s.posts
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 5),
  }));
  signals.sort((a, b) => (a.lastPost < b.lastPost ? 1 : -1));
  return { signals, scannedPosts, statuses };
}

export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
