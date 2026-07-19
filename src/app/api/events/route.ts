import { NextRequest, NextResponse } from "next/server";
import { getEvents, staleEvents, staleBlobEvents } from "@/lib/eventscache";

export const runtime = "nodejs";
// Démarrage à froid (juste après un déploiement) : fetch FIRMS mondial +
// clustering peuvent dépasser 60 s avant que le cron ne réchauffe les caches.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // ?hours=6|12|24|48|72 (l'ancien ?days=1|2|3 reste accepté)
  const daysParam = parseInt(req.nextUrl.searchParams.get("days") ?? "", 10);
  const hoursParam = parseInt(
    req.nextUrl.searchParams.get("hours") ?? String(daysParam * 24 || 24),
    10
  );
  const hours = [6, 12, 24, 48, 72].includes(hoursParam) ? hoursParam : 24;

  try {
    const data = await getEvents(hours);
    return NextResponse.json(data, {
      // s-maxage : le CDN Vercel absorbe le trafic (le pic LinkedIn du
      // 2026-07-19 multipliait les instances froides) ; SWR sert l'ancien
      // snapshot pendant la revalidation.
      headers: {
        "cache-control": "public, max-age=30, s-maxage=120, stale-while-revalidate=600",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "FIRMS_MAP_KEY_MISSING" || msg === "FIRMS_MAP_KEY_INVALID") {
      return NextResponse.json({ error: msg }, { status: 503 });
    }
    console.error("events failed:", e);
    // En cas de panne FIRMS : cache d'instance périmé, sinon snapshot Blob
    // périmé — une carte datée vaut toujours mieux qu'une carte vide.
    const stale = staleEvents(hours) ?? (await staleBlobEvents(hours));
    if (stale) return NextResponse.json(stale, { headers: { "x-cache": "stale" } });
    return NextResponse.json({ error: "FIRMS_UNAVAILABLE" }, { status: 502 });
  }
}
