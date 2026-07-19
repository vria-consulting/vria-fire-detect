import { NextRequest, NextResponse } from "next/server";
import { readJson, writeJson } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 15;

// Signalements citoyens directs (« Je vois un feu », GPS du téléphone).
// Affichés sur la carte comme signaux « à vérifier » — jamais comme foyers
// confirmés. Anti-abus : 1 signalement / 5 min / IP, 12 h de rétention,
// plafond global. La corroboration se fait naturellement : un vrai feu finit
// par être vu par satellite ou par d'autres témoins.

export type CitizenReport = {
  id: string;
  lat: number;
  lon: number;
  note?: string;
  at: string; // ISO
};

const REPORTS_PATH = "citizen-reports.json";
const RETENTION_MS = 12 * 60 * 60 * 1000;
const MAX_REPORTS = 200;
const PER_IP_MS = 5 * 60 * 1000;

// Rate limit par instance : suffisant contre la boucle involontaire et le
// spam naïf ; le plafond global + la rétention bornent le pire cas.
const lastByIp = new Map<string, number>();

function prune(reports: CitizenReport[]): CitizenReport[] {
  const cutoff = Date.now() - RETENTION_MS;
  return reports.filter((r) => Date.parse(r.at) >= cutoff).slice(-MAX_REPORTS);
}

export async function GET() {
  const reports = prune(await readJson<CitizenReport[]>(REPORTS_PATH, []));
  return NextResponse.json(
    { reports },
    { headers: { "cache-control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" } }
  );
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
  const last = lastByIp.get(ip);
  if (last && Date.now() - last < PER_IP_MS) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  let body: { lat?: number; lon?: number; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "BAD_JSON" }, { status: 400 });
  }
  const lat = Number(body.lat);
  const lon = Number(body.lon);
  if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    return NextResponse.json({ error: "BAD_COORDS" }, { status: 400 });
  }
  const note =
    typeof body.note === "string" ? body.note.slice(0, 200).replace(/[<>]/g, "") : undefined;

  const report: CitizenReport = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    lat: Math.round(lat * 1e4) / 1e4,
    lon: Math.round(lon * 1e4) / 1e4,
    note: note || undefined,
    at: new Date().toISOString(),
  };

  const reports = prune(await readJson<CitizenReport[]>(REPORTS_PATH, []));
  reports.push(report);
  await writeJson(REPORTS_PATH, reports);
  lastByIp.set(ip, Date.now());

  return NextResponse.json({ ok: true, id: report.id });
}
