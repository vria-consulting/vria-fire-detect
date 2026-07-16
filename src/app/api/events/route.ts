import { NextRequest, NextResponse } from "next/server";
import { getEvents, staleEvents } from "@/lib/eventscache";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const daysParam = parseInt(req.nextUrl.searchParams.get("days") ?? "1", 10);
  const days = [1, 2, 3].includes(daysParam) ? daysParam : 1;

  try {
    const data = await getEvents(days);
    return NextResponse.json(data, {
      headers: { "cache-control": "public, max-age=120" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "FIRMS_MAP_KEY_MISSING" || msg === "FIRMS_MAP_KEY_INVALID") {
      return NextResponse.json({ error: msg }, { status: 503 });
    }
    console.error("events failed:", e);
    // En cas de panne FIRMS, on sert le cache périmé plutôt que rien.
    const stale = staleEvents(days);
    if (stale) return NextResponse.json(stale, { headers: { "x-cache": "stale" } });
    return NextResponse.json({ error: "FIRMS_UNAVAILABLE" }, { status: 502 });
  }
}
