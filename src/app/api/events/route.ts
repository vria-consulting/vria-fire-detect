import { NextRequest, NextResponse } from "next/server";
import { getEvents, staleEvents } from "@/lib/eventscache";

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
      headers: { "cache-control": "public, max-age=30" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "FIRMS_MAP_KEY_MISSING" || msg === "FIRMS_MAP_KEY_INVALID") {
      return NextResponse.json({ error: msg }, { status: 503 });
    }
    console.error("events failed:", e);
    // En cas de panne FIRMS, on sert le cache périmé plutôt que rien.
    const stale = staleEvents(hours);
    if (stale) return NextResponse.json(stale, { headers: { "x-cache": "stale" } });
    return NextResponse.json({ error: "FIRMS_UNAVAILABLE" }, { status: 502 });
  }
}
