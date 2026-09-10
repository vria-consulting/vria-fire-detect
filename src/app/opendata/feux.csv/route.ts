import { NextResponse } from "next/server";
import { readArchive, archiveConfigured } from "@/lib/archive-reader";
import type { ArchivedFire } from "@/lib/firearchive";
import { ARCHIVE_START, monthRange } from "@/lib/observatory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Open data : l'archive complète des feux en CSV (CC BY 4.0, mention
// « kanari.io »). Volontairement hors /api pour rester crawlable.
const COLS = [
  "slug", "url", "first_seen", "last_seen", "status", "lat", "lon", "place",
  "admin", "country", "dept_code", "detections", "viirs", "goes", "mtg",
  "max_frp_mw", "confidence", "witness_posts", "aircraft_observed",
] as const;

function esc(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const month = params.get("month");
  const country = params.get("country");
  const range = month ? monthRange(month) : null;
  if ((month && !range) || (country && !/^[A-Za-z]{2}$/.test(country))) {
    return new NextResponse("Invalid month or country", { status: 400 });
  }
  if (!archiveConfigured()) return new NextResponse("Archive unavailable", { status: 503 });
  const from = range?.fromIso ?? `${ARCHIVE_START}T00:00:00Z`;
  const to = range?.toIso ?? new Date().toISOString();
  let fires: ArchivedFire[];
  try {
    fires = await readArchive<ArchivedFire>(`select=*&first_seen=gte.${encodeURIComponent(from)}&first_seen=lt.${encodeURIComponent(to)}${country ? `&country=eq.${country.toUpperCase()}` : ""}`);
  } catch {
    return new NextResponse("Archive temporarily unavailable. Please retry.", { status: 503, headers: { "Retry-After": "60", "Cache-Control": "no-store" } });
  }
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
  // Stream a verified complete result to avoid the serverless buffered-body limit.
  // Read failures have already returned 503 before any CSV bytes are emitted.
  const encoder = new TextEncoder();
  let offset = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= lines.length) { controller.close(); return; }
      controller.enqueue(encoder.encode(lines.slice(offset, offset + 1000).join("\n") + "\n"));
      offset += 1000;
    },
  });
  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "X-Kanari-Record-Count": String(fires.length),
      "content-disposition": 'inline; filename="kanari-feux.csv"',
      "cache-control": "public, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
