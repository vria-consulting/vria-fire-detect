// Veille sociale proactive : recherche Bluesky des posts très récents
// mentionnant un feu de forêt (8 langues), géolocalisés par nom de lieu via
// un gazetteer GeoNames embarqué (villes de 5000+ habitants, licence CC-BY).
// Objectif précocité : un témoignage peut précéder de plusieurs heures le
// prochain passage satellite.

import { searchPosts, postUrl } from "./bsky";
import { extractPlaces, normalizePlace } from "./geoparse";
import { fetchPressArticles } from "./press";
import { fetchTelegramPosts } from "./telegram";
import { triageCandidates } from "./triage";
import { TERMS_BY_LANG, LANG_BY_COUNTRY } from "./social";
import type { SocialPost } from "./social";

// Expressions fortes uniquement (pas "fire"/"feu" seuls : trop de métaphores).
export const SCAN_QUERIES = [
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
  firstPress?: string; // ISO — plus ancien article de presse (mesure de précocité)
  posts: SocialPost[];
  // true = les toutes premières mentions de ce lieu datent de moins d'1 h
  // (vérifié contre l'historique Bluesky) -> candidat "départ de feu".
  // Un feu qui dure fait encore parler de lui : lastPost récent mais newFire=false.
  newFire?: boolean;
};

// Renvoie la date de la mention feu+lieu la plus récente AVANT la coupure
// (ou null). Parade au biais d'échantillonnage : un gros feu en cours génère
// tellement de posts récents que la fenêtre de scan ne voit plus les anciens.
export async function latestMentionBefore(
  place: string,
  countryCode: string,
  untilIso: string
): Promise<string | null> {
  const lang = LANG_BY_COUNTRY[countryCode.toLowerCase()];
  const terms = [
    ...(lang ? TERMS_BY_LANG[lang].slice(0, 1) : []),
    TERMS_BY_LANG.en[0], // "fire"
  ];
  let latest: string | null = null;
  for (const term of terms) {
    try {
      const { posts } = await searchPosts(`"${place}" ${term}`, 5, { until: untilIso });
      for (const p of posts) {
        const at = p.record?.createdAt;
        if (at && (!latest || at > latest)) latest = at;
      }
    } catch {
      // en cas d'échec réseau, on ne conclut pas
    }
  }
  return latest;
}

export async function scanSocial(sinceHours = 12): Promise<{
  signals: SocialSignal[];
  scannedPosts: number;
  statuses: number[];
}> {
  const [results, pressArticles, telegramPosts] = await Promise.all([
    Promise.all(
      SCAN_QUERIES.map((q) => searchPosts(q, 50).catch(() => ({ posts: [], status: 0 })))
    ),
    fetchPressArticles(3),
    fetchTelegramPosts(),
  ]);
  const statuses = results.map((r) => r.status);
  const since = Date.now() - sinceHours * 3_600_000;

  const byPlace = new Map<string, SocialSignal>();
  const seen = new Set<string>();
  let scannedPosts = 0;

  const addToPlace = (key: string, entry: [number, number, string, string], post: SocialPost) => {
    const sig = byPlace.get(key);
    if (sig) {
      // Jamais deux fois le même post dans un signal (reposts de bots,
      // candidats répétés) : l'URL est l'identité du post.
      if (sig.posts.some((p) => p.url === post.url)) return;
      sig.postCount++;
      sig.posts.push(post);
      if (post.createdAt < sig.firstPost) sig.firstPost = post.createdAt;
      if (post.createdAt > sig.lastPost) sig.lastPost = post.createdAt;
      if (
        post.source === "presse" &&
        (!sig.firstPress || post.createdAt < sig.firstPress)
      ) {
        sig.firstPress = post.createdAt;
      }
    } else {
      byPlace.set(key, {
        place: entry[3],
        countryCode: entry[2],
        lat: entry[0],
        lon: entry[1],
        postCount: 1,
        firstPost: post.createdAt,
        lastPost: post.createdAt,
        firstPress: post.source === "presse" ? post.createdAt : undefined,
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
    const placeNames = new Set(places.map((x) => x.key)).size;
    if (places.length === 0 || placeNames > 3) continue; // 4+ noms de lieux = revue de presse
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

  // Messages Telegram (canaux publics, via le worker GitHub Actions).
  for (const t of telegramPosts) {
    if (new Date(t.createdAt).getTime() < since) continue;
    const places = extractPlaces(t.text);
    const placeNames = new Set(places.map((x) => x.key)).size;
    if (places.length === 0 || placeNames > 3) continue; // 4+ noms de lieux = revue de presse
    candidates.push({
      post: {
        text: t.text,
        author: t.channel,
        handle: t.handle,
        createdAt: t.createdAt,
        url: t.url,
        source: "telegram",
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
    const placeNames = new Set(places.map((x) => x.key)).size;
    if (places.length === 0 || placeNames > 3) continue; // 4+ noms de lieux = revue de presse
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
  // Le pays de chaque candidat est fourni au juge : il peut ainsi rejeter les
  // homonymes incohérents (« Boston Bar » au Canada ≠ Boston (US)).
  const verdicts = await triageCandidates(
    candidates.map((c) => ({
      url: c.post.url,
      text: c.post.text,
      places: c.places.map((p) => `${p.entry[3]} (${p.entry[2].toUpperCase()})`),
      createdAt: c.post.createdAt,
    }))
  );

  // Précision d'abord : sans juge IA (clé OpenAI absente de l'environnement),
  // on n'affiche RIEN plutôt que du non-trié. Le repli mots-clés historique
  // ajoutait chaque post une fois PAR HOMONYME et sans aucun jugement — c'est
  // lui qui a montré en prod un feu d'appartement parisien dupliqué 4 fois.
  if (!verdicts) {
    console.error(
      "triage IA indisponible (OPENAI_API_KEY absente) : aucun signalement affiché"
    );
    return { signals: [], scannedPosts, statuses };
  }

  for (const c of candidates) {
    // AUCUN post non jugé ne s'affiche. Un post au-delà du plafond de
    // jugements attend simplement le scan suivant (3 min).
    const v = verdicts.get(c.post.url);
    if (!v || !v.fire || v.place == null) continue;
    const chosen = c.places[v.place];
    if (!chosen) continue;
    // Invariant de sûreté : le nom de lieu retenu doit apparaître dans le
    // texte du post. Toujours vrai quand l'indice du juge est aligné sur
    // extractPlaces(texte) — bloque structurellement tout post ancré sur un
    // lieu étranger (cache désaligné, régression future).
    const txt = normalizePlace(c.post.text).replace(/\s+/g, " ");
    if (!txt.includes(chosen.key)) continue;
    addToPlace(chosen.key, chosen.entry, c.post);
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
