import { NextRequest, NextResponse } from "next/server";
import { fetchFires } from "@/lib/firms";
import { clusterFires, FireEvent, Confidence } from "@/lib/cluster";
import { getSignals } from "@/lib/signalcache";
import { haversineKm } from "@/lib/socialscan";

export const runtime = "nodejs";
export const maxDuration = 60;

type EventsPayload = {
  events: FireEvent[];
  meta: { days: number; fetchedAt: string; totalDetections: number };
};

// Un témoignage corrobore un foyer s'il cite un lieu à moins de 50 km
// (les gens nomment la ville voisine, pas la parcelle qui brûle).
const CORROBORATION_KM = 50;

function baseConfidence(ev: FireEvent): Confidence {
  if (ev.count >= 3 || (ev.viirsCount > 0 && ev.goesCount > 0) || ev.maxConf === "h") {
    return "probable";
  }
  return "possible";
}

// Cache 5 min : la précocité prime, et 3 sources x 12 req/h restent très
// en dessous du rate limit FIRMS (5000 / 10 min).
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<number, { at: number; data: EventsPayload }>();

export async function GET(req: NextRequest) {
  const daysParam = parseInt(req.nextUrl.searchParams.get("days") ?? "1", 10);
  const days = [1, 2, 3].includes(daysParam) ? daysParam : 1;

  const hit = cache.get(days);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.data, {
      headers: { "x-cache": "hit", "cache-control": "public, max-age=120" },
    });
  }

  try {
    const fires = await fetchFires(days);
    const events = clusterFires(fires.features);

    // Corroboration par la veille sociale — ne doit jamais faire échouer les foyers.
    try {
      const { signals } = await getSignals();
      for (const ev of events) {
        ev.confidence = baseConfidence(ev);
        for (const sig of signals) {
          if (
            haversineKm(ev.centroid[1], ev.centroid[0], sig.lat, sig.lon) <=
            CORROBORATION_KM
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
        days,
        fetchedAt: fires.meta.fetchedAt,
        totalDetections: fires.meta.count,
      },
    };
    cache.set(days, { at: Date.now(), data });
    return NextResponse.json(data, {
      headers: { "x-cache": "miss", "cache-control": "public, max-age=120" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "FIRMS_MAP_KEY_MISSING" || msg === "FIRMS_MAP_KEY_INVALID") {
      return NextResponse.json({ error: msg }, { status: 503 });
    }
    console.error("events failed:", e);
    if (hit) return NextResponse.json(hit.data, { headers: { "x-cache": "stale" } });
    return NextResponse.json({ error: "FIRMS_UNAVAILABLE" }, { status: 502 });
  }
}
