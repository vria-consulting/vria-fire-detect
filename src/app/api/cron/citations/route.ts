import { NextRequest, NextResponse } from "next/server";
import { runCitationsPanel } from "@/lib/visibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Déclenchement manuel du panel de citations IA (le cron principal le lance
// automatiquement chaque semaine ; ici on peut forcer un run, ex. 1er run).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const result = await runCitationsPanel();
  return NextResponse.json({ ok: true, ...result });
}
