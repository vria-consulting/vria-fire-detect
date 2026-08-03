import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Vent pour PLUSIEURS foyers en un appel (plumes de propagation de la carte).
// Open-Meteo accepte des listes de coordonnées : 1 requête amont pour ~30
// foyers. Cache 15 min par cellule de 0,25° — le vent varie lentement.
const TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; d: { deg: number; kmh: number } }>();

const cellKey = (la: number, lo: number) =>
  `${(Math.round(la * 4) / 4).toFixed(2)}:${(Math.round(lo * 4) / 4).toFixed(2)}`;

export async function GET(req: NextRequest) {
  const pts = (req.nextUrl.searchParams.get("pts") ?? "")
    .split(";")
    .filter(Boolean)
    .slice(0, 40)
    .map((s) => s.split(",").map(parseFloat) as [number, number])
    .filter(([la, lo]) => isFinite(la) && isFinite(lo) && Math.abs(la) <= 90 && Math.abs(lo) <= 180);
  if (pts.length === 0) return NextResponse.json({ winds: [] });

  const keys = pts.map(([la, lo]) => cellKey(la, lo));
  const missing = [...new Set(keys)].filter((k) => {
    const h = cache.get(k);
    return !h || Date.now() - h.at > TTL_MS;
  });

  if (missing.length > 0) {
    try {
      const las = missing.map((k) => k.split(":")[0]).join(",");
      const los = missing.map((k) => k.split(":")[1]).join(",");
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${las}&longitude=${los}` +
          `&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=kmh`
      );
      if (res.ok) {
        const j = await res.json();
        const arr: { current?: { wind_speed_10m?: number; wind_direction_10m?: number } }[] =
          Array.isArray(j) ? j : [j];
        arr.forEach((r, i) => {
          const c = r.current ?? {};
          if (typeof c.wind_direction_10m === "number") {
            cache.set(missing[i], {
              at: Date.now(),
              d: { deg: Math.round(c.wind_direction_10m), kmh: Math.round(c.wind_speed_10m ?? 0) },
            });
          }
        });
      }
    } catch {
      /* vent indisponible : les plumes concernées attendront le prochain appel */
    }
  }

  return NextResponse.json(
    { winds: keys.map((k) => cache.get(k)?.d ?? null) },
    { headers: { "cache-control": "public, max-age=300" } }
  );
}
