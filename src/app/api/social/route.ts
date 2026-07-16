import { NextRequest, NextResponse } from "next/server";
import { findWitnessPosts, SocialResult } from "@/lib/social";

export const runtime = "nodejs";
export const maxDuration = 30;

// Cache par zone (0,1° ≈ 10 km) : un même foyer cliqué plusieurs fois ne
// redéclenche pas Nominatim ni Bluesky pendant 10 min.
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; data: SocialResult }>();

export async function GET(req: NextRequest) {
  const lat = parseFloat(req.nextUrl.searchParams.get("lat") ?? "");
  const lon = parseFloat(req.nextUrl.searchParams.get("lon") ?? "");
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "BAD_COORDS" }, { status: 400 });
  }

  const key = `${lat.toFixed(1)}:${lon.toFixed(1)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return NextResponse.json(hit.data, { headers: { "x-cache": "hit" } });
  }

  try {
    const data = await findWitnessPosts(lat, lon);
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data, { headers: { "x-cache": "miss" } });
  } catch (e) {
    console.error("social failed:", e);
    return NextResponse.json({ error: "SOCIAL_UNAVAILABLE" }, { status: 502 });
  }
}
