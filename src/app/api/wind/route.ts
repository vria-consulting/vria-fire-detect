import { NextRequest, NextResponse } from "next/server";
import { computeFireRisk, type FireRisk } from "@/lib/firerisk";

export const runtime = "nodejs";

// Vent actuel au droit d'un foyer (Open-Meteo, gratuit, sans clé).
// La direction est météorologique : d'où VIENT le vent, en degrés.
// On récupère au passage température / humidité / pluie récente pour calculer
// un risque météo de feu ESTIMÉ (un seul appel Open-Meteo).
type Wind = { speed: number; gusts: number; direction: number; risk?: FireRisk };

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
      `&current=wind_speed_10m,wind_gusts_10m,wind_direction_10m,temperature_2m,relative_humidity_2m` +
      `&daily=precipitation_sum&past_days=3&forecast_days=1&wind_speed_unit=kmh&timezone=auto`;
    const res = await fetch(url);
    if (!res.ok) return NextResponse.json({ error: "UPSTREAM" }, { status: 502 });
    const j = await res.json();
    const c = j.current ?? {};
    const speed = Math.round(c.wind_speed_10m ?? 0);

    // Risque météo estimé : nécessite T + HR ; sinon on l'omet proprement.
    let risk: FireRisk | undefined;
    const temp = c.temperature_2m;
    const rh = c.relative_humidity_2m;
    if (typeof temp === "number" && typeof rh === "number") {
      const rain: number[] = j.daily?.precipitation_sum ?? [];
      // Cumul des jours passés (on exclut le dernier point = aujourd'hui en cours).
      const recentRainMm = rain.slice(0, Math.max(0, rain.length - 1)).reduce(
        (s, v) => s + (typeof v === "number" ? v : 0),
        0
      );
      risk = computeFireRisk({ tempC: temp, rh, windKmh: speed, recentRainMm });
    }

    const data: Wind = {
      speed,
      gusts: Math.round(c.wind_gusts_10m ?? 0),
      direction: Math.round(c.wind_direction_10m ?? 0),
      risk,
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
