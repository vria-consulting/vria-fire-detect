import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, setSession } from "@/lib/adminSession";
import { fetchTrendsRpc, fetchGscSeries } from "@/lib/visibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Données de l'onglet « Tendances » : séries d'évolution 30 j (canaux,
// bots, citations, domaines) + séries Google Search Console (clics,
// impressions, mots-clés en progression). Mêmes règles de session que /stats.
export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!verifySession(token).valid) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  await setSession();

  const [rpc, gsc] = await Promise.all([fetchTrendsRpc(), fetchGscSeries()]);
  if (rpc == null) return NextResponse.json({ error: "STATS_ERROR" }, { status: 502 });
  return NextResponse.json({ ...(rpc as object), gsc });
}
