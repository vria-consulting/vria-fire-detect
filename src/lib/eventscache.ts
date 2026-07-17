// Calcul des foyers (FIRMS -> clustering -> corroboration sociale) avec cache
// 5 min, partagé entre /api/events et le cron d'alertes.

import { fetchFires, type FireFeature } from "./firms";
import { fetchMtgFires } from "./mtg";
import { clusterFires, FireEvent, Confidence } from "./cluster";
import { getSignals } from "./signalcache";
import { haversineKm } from "./socialscan";

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
  return data;
}

export function staleEvents(hours: number): EventsPayload | null {
  return cache.get(hours)?.data ?? null;
}
