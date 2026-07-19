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
import { clusterFires, FireEvent, Confidence } from "./cluster";
import { getSignals } from "./signalcache";
import { haversineKm } from "./socialscan";
import { readJson, writeJson, blobUpdatedAt } from "./store";

export type EventsPayload = {
  events: FireEvent[];
  meta: { hours: number; fetchedAt: string; totalDetections: number };
};

// Un témoignage corrobore un foyer s'il cite un lieu à moins de 50 km
// (les gens nomment la ville voisine, pas la parcelle qui brûle).
const CORROBORATION_KM = 50;

function baseConfidence(ev: FireEvent): Confidence {
  const sources =
    (ev.viirsCount > 0 ? 1 : 0) + (ev.goesCount > 0 ? 1 : 0) + (ev.mtgCount > 0 ? 1 : 0);
  if (ev.count >= 3 || sources >= 2 || ev.maxConf === "h") {
    return "probable";
  }
  return "possible";
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
  // FIRMS (VIIRS + GOES) et Meteosat MTG (Europe/Afrique, 10 min) en parallèle ;
  // MTG renvoie [] en cas de problème, sans bloquer le reste.
  const [fires, mtgFires] = await Promise.all([fetchFires(days), fetchMtgFires()]);
  rawCache = {
    days,
    at: Date.now(),
    features: [...fires.features, ...mtgFires],
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
    for (const ev of events) {
      ev.confidence = baseConfidence(ev);
      for (const sig of signals) {
        if (
          haversineKm(ev.centroid[1], ev.centroid[0], sig.lat, sig.lon) <= CORROBORATION_KM
        ) {
          ev.confidence = "corrobore";
          ev.social = {
            place: sig.place,
            postCount: sig.postCount,
            posts: sig.posts,
            firstPress: sig.firstPress,
          };
          break;
        }
      }
    }
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
