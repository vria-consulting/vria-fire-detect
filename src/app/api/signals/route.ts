import { NextResponse } from "next/server";
import { getSignals } from "@/lib/signalcache";

export const runtime = "nodejs";
export const maxDuration = 60;

// Signalements citoyens géolocalisés (veille Bluesky multilingue).
export async function GET() {
  try {
    const data = await getSignals();
    return NextResponse.json(data, {
      headers: { "cache-control": "public, max-age=30" },
    });
  } catch (e) {
    console.error("signals failed:", e);
    return NextResponse.json({ error: "SIGNALS_UNAVAILABLE" }, { status: 502 });
  }
}
