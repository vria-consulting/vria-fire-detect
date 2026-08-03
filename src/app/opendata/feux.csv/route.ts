import { NextResponse } from "next/server";
import { listFiresBetween } from "@/lib/firearchive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Open data : l'archive complète des feux en CSV (CC BY 4.0, mention
// « kanari.io »). Volontairement hors /api pour rester crawlable.
const COLS = [
  "slug", "url", "first_seen", "last_seen", "status", "lat", "lon", "place",
  "admin", "country", "dept_code", "detections", "viirs", "goes", "mtg",
  "max_frp_mw", "confidence", "witness_posts", "aircraft_observed",
] as const;

function esc(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const fires = await listFiresBetween("2026-08-03T00:00:00Z", new Date().toISOString(), 10000);
  const lines = [COLS.join(",")];
  for (const f of fires) {
    lines.push(
      [
        f.slug,
        `https://kanari.io/fr/feu/${f.slug}`,
        f.first_seen,
        f.last_seen,
        f.status,
        f.lat.toFixed(4),
        f.lon.toFixed(4),
        f.place,
        f.admin,
        f.country,
        f.dept_code,
        f.detections,
        f.viirs,
        f.goes,
        f.mtg,
        Math.round(f.max_frp),
        f.confidence,
        f.post_count,
        f.aircraft.length,
      ]
        .map(esc)
        .join(",")
    );
  }
  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'inline; filename="kanari-feux.csv"',
      "cache-control": "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
