import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Vent actuel au droit d'un foyer (Open-Meteo, gratuit, sans clé).
// La direction est météorologique : d'où VIENT le vent, en degrés.
type Wind = { speed: number; gusts: number; direction: number };

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; data: Wind }>();

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
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=wind_speed_10m,wind_gusts_10m,wind_direction_10m&wind_speed_unit=kmh`;
    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: "UPSTREAM" }, { status: 502 });
    const j = await res.json();
    const c = j.current ?? {};
    const data: Wind = {
      speed: Math.round(c.wind_speed_10m ?? 0),
      gusts: Math.round(c.wind_gusts_10m ?? 0),
      direction: Math.round(c.wind_direction_10m ?? 0),
    };
    cache.set(key, { at: Date.now(), data });
    return NextResponse.json(data, {
      headers: { "cache-control": "public, max-age=600" },
    });
  } catch (e) {
    console.error("wind failed:", e);
    return NextResponse.json({ error: "WIND_UNAVAILABLE" }, { status: 502 });
  }
}
