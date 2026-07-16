// Calcul des foyers (FIRMS -> clustering -> corroboration sociale) avec cache
// 5 min, partagé entre /api/events et le cron d'alertes.

import { fetchFires } from "./firms";
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

export async function getEvents(hours: number): Promise<EventsPayload> {
  const hit = cache.get(hours);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  // FIRMS (VIIRS + GOES) et Meteosat MTG (Europe/Afrique, 10 min) en parallèle ;
  // MTG renvoie [] en cas de problème, sans bloquer le reste.
  const days = Math.max(1, Math.ceil(hours / 24));
  const [fires, mtgFires] = await Promise.all([fetchFires(days), fetchMtgFires()]);
  // Fenêtre glissante exacte : FIRMS renvoie des jours calendaires entiers,
  // on filtre à l'heure d'acquisition près (indispensable pour 6 h / 12 h).
  const cutoff = Date.now() - hours * 3_600_000;
  const features = [...fires.features, ...mtgFires].filter(
    (f) => new Date(f.properties.acq).getTime() >= cutoff
  );
  const events = clusterFires(features);

  // Corroboration par la veille sociale — ne doit jamais faire échouer les foyers.
  try {
    const { signals } = await getSignals();
    for (const ev of events) {
      ev.confidence = baseConfidence(ev);
      for (const sig of signals) {
        if (
          haversineKm(ev.centroid[1], ev.centroid[0], sig.lat, sig.lon) <= CORROBORATION_KM
        ) {
          ev.confidence = "corrobore";
          ev.social = { place: sig.place, postCount: sig.postCount, posts: sig.posts };
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
      fetchedAt: fires.meta.fetchedAt,
      totalDetections: features.length,
    },
  };
  cache.set(hours, { at: Date.now(), data });
  return data;
}

export function staleEvents(hours: number): EventsPayload | null {
  return cache.get(hours)?.data ?? null;
}
