// Calcul des foyers (FIRMS -> clustering -> corroboration sociale).
// Trois niveaux de cache :
//   L1 — mémoire d'instance (2 min), comme avant ;
//   L2 — snapshot Vercel Blob par période, écrit par le cron toutes les 5 min :
//        c'est lui qui absorbe le trafic. Une instance froide lit le snapshot
//        au lieu d'appeler FIRMS — le pic de visites du 2026-07-19 (post
//        LinkedIn) multipliait les instances froides et FIRMS finissait par
//        rejeter les téléchargements (CSV mondial de plusieurs Mo par source) ;
//   L3 — calcul complet (FIRMS + MTG + clustering), réservé au cron et au cas
//        où le snapshot manque ou date de plus de 15 min.

import { fetchFires, type FireFeature } from "./firms";
import { fetchMtgFires } from "./mtg";
import { fetchGoesDirectFires } from "./goesdirect";
import { clusterFires, FireEvent, Confidence } from "./cluster";
import { getSignals } from "./signalcache";
import { haversineKm, type SocialSignal } from "./socialscan";
import { readJson, writeJson, blobUpdatedAt } from "./store";

export type EventsPayload = {
  events: FireEvent[];
  meta: { hours: number; fetchedAt: string; totalDetections: number };
};

// Un témoignage corrobore un foyer s'il cite un lieu à moins de 30 km
// (les gens nomment la ville voisine, pas la parcelle qui brûle). Réduit de
// 50 à 30 km après le cas Montereau/Fontainebleau : au-delà, l'association
// prêtait plus à confusion qu'elle n'aidait.
const CORROBORATION_KM = 30;

function baseConfidence(ev: FireEvent): Confidence {
  const sources =
    (ev.viirsCount > 0 ? 1 : 0) + (ev.goesCount > 0 ? 1 : 0) + (ev.mtgCount > 0 ? 1 : 0);
  if (ev.count >= 3 || sources >= 2 || ev.maxConf === "h") {
    return "probable";
  }
  return "possible";
}

// Corroboration : chaque foyer reçoit le témoignage LE PLUS PROCHE dans le
// rayon — le premier trouvé attachait « près de Montereau » à un feu de
// Fontainebleau alors qu'un signal plus proche existait. La distance est
// conservée pour être affichée. Exportée (pure) pour le programme de QA.
export function attachSignals(events: FireEvent[], signals: SocialSignal[]): void {
  for (const ev of events) {
    ev.confidence = baseConfidence(ev);
    let best: (typeof signals)[number] | null = null;
    let bestKm = Infinity;
    for (const sig of signals) {
      const km = haversineKm(ev.centroid[1], ev.centroid[0], sig.lat, sig.lon);
      if (km <= CORROBORATION_KM && km < bestKm) {
        bestKm = km;
        best = sig;
      }
    }
    if (best) {
      ev.confidence = "corrobore";
      ev.social = {
        place: best.place,
        postCount: best.postCount,
        posts: best.posts,
        firstPress: best.firstPress,
        distanceKm: Math.round(bestKm),
      };
    }
  }
}

// 2 min : la précocité prime — le volume reste très en dessous du rate limit
// FIRMS (5000 transactions / 10 min) et les produits MTG sont cachés à l'unité.
const CACHE_TTL_MS = 2 * 60 * 1000;
const cache = new Map<number, { at: number; data: EventsPayload }>();

export const VALID_HOURS = [6, 12, 24, 48, 72] as const;

const EVENTS_PATH = (hours: number) => `events-${hours}h.json`;
// Le cron passe toutes les 5 min : un snapshot de moins de 15 min est sain,
// au-delà on considère le cron mort et on recalcule soi-même.
const BLOB_FRESH_MS = 15 * 60 * 1000;
// Les fenêtres longues bougent lentement : rafraîchies toutes les 30 min
// seulement, pour limiter les téléchargements FIRMS multi-jours.
const LONG_TIER_HOURS = [48, 72];
const LONG_TIER_MS = 30 * 60 * 1000;

// FIRMS renvoie des jours CALENDAIRES UTC entiers (days=1 = aujourd'hui seul).
// Une fenêtre glissante de N heures exige donc souvent le(s) jour(s)
// précédent(s) : à 8 h UTC, « 24 h » = 16 h d'hier + 8 h d'aujourd'hui.
// Le jour supplémentaire amortit aussi le retard de publication VIIRS au
// changement de jour UTC (observé le 2026-07-17 : aucune donnée du jour à 8 h,
// carte quasi vide hors GOES/MTG avec l'ancien calcul).
// Exportée (avec horloge injectable) pour être testée par le programme de QA :
// le bug « carte vide le matin » venait précisément de ce calcul.
export function daysNeeded(hours: number, now: number = Date.now()): number {
  const elapsedTodayH = (now % 86_400_000) / 3_600_000;
  return Math.min(10, Math.max(1, Math.ceil((hours - elapsedTodayH) / 24) + 1));
}

// Détections brutes (FIRMS + MTG) partagées entre toutes les périodes : une
// couverture de N jours sert toute fenêtre plus courte — le cron réchauffe
// 24 h et la vue 6 h par défaut est servie sans nouvel appel FIRMS.
let rawCache: {
  days: number;
  at: number;
  features: FireFeature[];
  fetchedAt: string;
} | null = null;

async function getRawFeatures(days: number) {
  if (rawCache && rawCache.days >= days && Date.now() - rawCache.at < CACHE_TTL_MS) {
    return rawCache;
  }
  // FIRMS (VIIRS + GOES), Meteosat MTG (Europe/Afrique, 10 min) et GOES lu en
  // direct sur S3 (Amériques, ~10 min contre ~40 via FIRMS) en parallèle ;
  // chaque source annexe renvoie [] en cas de problème, sans bloquer le reste.
  const [fires, mtgFires, goesDirect] = await Promise.all([
    fetchFires(days),
    fetchMtgFires(),
    fetchGoesDirectFires(),
  ]);
  // Anti-doublon : le direct S3 n'apporte QUE la fenêtre plus fraîche que le
  // dernier point GOES déjà publié par FIRMS (mêmes pixels, ~30 min plus tard).
  let maxFirmsGoes = 0;
  for (const f of fires.features) {
    if (f.properties.src === "goes") {
      const t = Date.parse(f.properties.acq);
      if (t > maxFirmsGoes) maxFirmsGoes = t;
    }
  }
  const freshDirect = goesDirect.filter((f) => Date.parse(f.properties.acq) > maxFirmsGoes);
  if (goesDirect.length > 0) {
    console.log(`goes-direct: ${freshDirect.length} détections fraîches gardées / ${goesDirect.length} lues`);
  }
  rawCache = {
    days,
    at: Date.now(),
    features: [...fires.features, ...mtgFires, ...freshDirect],
    fetchedAt: fires.meta.fetchedAt,
  };
  return rawCache;
}

export async function getEvents(hours: number): Promise<EventsPayload> {
  const hit = cache.get(hours);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  // L2 : snapshot écrit par le cron — le chemin visiteur ne touche jamais
  // FIRMS tant que le cron est vivant.
  const blob = await readJson<EventsPayload | null>(EVENTS_PATH(hours), null);
  if (blob && Date.now() - new Date(blob.meta.fetchedAt).getTime() < BLOB_FRESH_MS) {
    cache.set(hours, { at: Date.now(), data: blob });
    return blob;
  }

  try {
    return await computeEvents(hours);
  } catch (e) {
    // FIRMS en panne : un snapshot périmé vaut mieux qu'une carte vide.
    if (blob) return blob;
    throw e;
  }
}

// Un seul calcul complet à la fois par période et par instance : sous forte
// charge, N requêtes simultanées ne doivent pas déclencher N scans FIRMS.
const inflight = new Map<number, Promise<EventsPayload>>();

function computeEvents(hours: number): Promise<EventsPayload> {
  const running = inflight.get(hours);
  if (running) return running;
  const p = doComputeEvents(hours).finally(() => inflight.delete(hours));
  inflight.set(hours, p);
  return p;
}

async function doComputeEvents(hours: number): Promise<EventsPayload> {
  const raw = await getRawFeatures(daysNeeded(hours));
  // Fenêtre glissante exacte : FIRMS renvoie des jours calendaires entiers,
  // on filtre à l'heure d'acquisition près (indispensable pour 6 h / 12 h).
  const cutoff = Date.now() - hours * 3_600_000;
  const features = raw.features.filter(
    (f) => new Date(f.properties.acq).getTime() >= cutoff
  );
  const events = clusterFires(features);

  // Corroboration par la veille sociale — ne doit jamais faire échouer NI
  // retarder les foyers : à froid, un scan social complet (Bluesky + triage
  // IA) peut prendre > 30 s. Au-delà de 10 s on sert les foyers sans
  // corroboration ; le rafraîchissement suivant (2 min) l'ajoutera.
  try {
    const { signals } = await Promise.race([
      getSignals(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("SIGNALS_SLOW_COLD_START")), 10_000)
      ),
    ]);
    attachSignals(events, signals);
  } catch (e) {
    console.error("corroboration skipped:", e);
    for (const ev of events) ev.confidence = baseConfidence(ev);
  }

  const data: EventsPayload = {
    events,
    meta: {
      hours,
      fetchedAt: raw.fetchedAt,
      totalDetections: features.length,
    },
  };
  cache.set(hours, { at: Date.now(), data });
  // Persistance du snapshot pour toutes les instances (et pour survivre à une
  // panne FIRMS) — l'échec d'écriture ne doit jamais faire échouer la requête.
  try {
    await writeJson(EVENTS_PATH(hours), data);
  } catch (e) {
    console.error("events snapshot write failed:", e);
  }
  return data;
}

export function staleEvents(hours: number): EventsPayload | null {
  return cache.get(hours)?.data ?? null;
}

// Snapshot périmé accepté en dernier recours (panne FIRMS + instance froide).
export function staleBlobEvents(hours: number): Promise<EventsPayload | null> {
  return readJson<EventsPayload | null>(EVENTS_PATH(hours), null);
}

// Reconstruction par le cron : fenêtres courtes à chaque passage (5 min),
// fenêtres longues toutes les 30 min. Ordre décroissant pour que le premier
// calcul télécharge la couverture FIRMS la plus large et que les suivants la
// réutilisent (getRawFeatures sert toute fenêtre plus courte) : un seul
// passage FIRMS par reconstruction.
export async function rebuildAll(): Promise<{ rebuilt: number[]; totalDetections: number }> {
  const shortTier = VALID_HOURS.filter((h) => !LONG_TIER_HOURS.includes(h));
  // L'âge se mesure sur 48 h : la vue 72 h est dans l'interface et une
  // instance visiteur peut donc réécrire son blob à tout moment — se baser
  // dessus laisserait le tiers long éternellement « frais ».
  const longAge = await blobUpdatedAt(EVENTS_PATH(48));
  const withLong = longAge === null || Date.now() - longAge > LONG_TIER_MS;
  const hoursList = [...(withLong ? LONG_TIER_HOURS : []), ...shortTier].sort(
    (a, b) => b - a
  );
  // Invalide les caches d'instance : le cron doit produire du frais.
  cache.clear();
  rawCache = null;
  let total = 0;
  for (const h of hoursList) {
    const data = await computeEvents(h);
    total = Math.max(total, data.meta.totalDetections);
  }
  return { rebuilt: hoursList, totalDetections: total };
}

// Allègement pour la carte : fin août, la saison mondiale + GOES direct + MTG
// produisent 7 000+ foyers / 6 h (2 Mo, 6,7 Mo sur 24 h) — le navigateur gèle
// (carte blanche, Core Web Vitals en chute, trafic search divisé par 10 du
// 18 au 20/08). On ne sert à la carte que les foyers les plus pertinents :
// départs récents d'abord (la précocité est la mission : un count=1 de moins
// de 3 h passe AVANT un gros feu ancien), puis corroborés, probables,
// possibles. Le bruit géostationnaire unitaire (1 pixel GOES/MTG « possible »
// sans VIIRS) est écarté. L'API complète reste disponible avec ?full=1.
export const LIGHT_CAP = 2000;
export const NEW_FIRE_HOURS = 3;

export function lightenEvents(
  events: FireEvent[],
  cap = LIGHT_CAP,
  nowMs = Date.now()
): { events: FireEvent[]; totalEvents: number; truncated: boolean } {
  const kept = events.filter(
    (e) => !(e.confidence === "possible" && e.count === 1 && e.viirsCount === 0)
  );
  const rank = (e: FireEvent): number => {
    if (e.confidence === "corrobore") return 0;
    const ageH = (nowMs - new Date(e.firstSeen).getTime()) / 3_600_000;
    if (ageH < NEW_FIRE_HOURS) return 1;
    if (e.confidence === "probable") return 2;
    return 3;
  };
  kept.sort((a, b) => rank(a) - rank(b) || b.count - a.count || b.maxFrp - a.maxFrp);
  const truncated = kept.length > cap;
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  const out = kept.slice(0, cap).map((e) => ({
    ...e,
    centroid: [r3(e.centroid[0]), r3(e.centroid[1])] as [number, number],
    bbox: [r3(e.bbox[0]), r3(e.bbox[1]), r3(e.bbox[2]), r3(e.bbox[3])] as [number, number, number, number],
    maxFrp: Math.round(e.maxFrp * 10) / 10,
  }));
  return { events: out, totalEvents: events.length, truncated };
}
