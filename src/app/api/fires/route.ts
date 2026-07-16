import { NextRequest, NextResponse } from "next/server";
import { fetchFires, FireCollection } from "@/lib/firms";

export const runtime = "nodejs";

// Cache en mémoire par instance serverless : FIRMS limite à 5000 requêtes / 10 min,
// et le CSV mondial pèse plusieurs Mo — on ne le re-télécharge que toutes les 10 min.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<number, { at: number; data: FireCollection }>();

export async function GET(req: NextRequest) {
  const daysParam = parseInt(req.nextUrl.searchParams.get("days") ?? "1", 10);
  const days = [1, 2, 3].includes(daysParam) ? daysParam : 1;

  const hit = cache.get(days);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.data, {
      headers: { "x-cache": "hit", "cache-control": "public, max-age=300" },
    });
  }

  try {
    const data = await fetchFires(days);
    cache.set(days, { at: Date.now(), data });
    return NextResponse.json(data, {
      headers: { "x-cache": "miss", "cache-control": "public, max-age=300" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "UNKNOWN";
    if (msg === "FIRMS_MAP_KEY_MISSING" || msg === "FIRMS_MAP_KEY_INVALID") {
      return NextResponse.json(
        { error: msg },
        { status: 503, headers: { "cache-control": "no-store" } }
      );
    }
    console.error("FIRMS fetch failed:", e);
    // En cas de panne FIRMS, on sert le cache périmé plutôt que rien.
    if (hit) {
      return NextResponse.json(hit.data, { headers: { "x-cache": "stale" } });
    }
    return NextResponse.json({ error: "FIRMS_UNAVAILABLE" }, { status: 502 });
  }
}
