import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, setSession } from "@/lib/adminSession";
import { fetchVisibilityRpc, fetchGsc, fetchBing } from "@/lib/visibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Données de l'onglet « Visibilité » : mêmes règles de session que /stats
// (cookie glissant, jamais de rafraîchissement automatique côté client).
export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!verifySession(token).valid) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  await setSession();

  const [rpc, gsc, bing] = await Promise.all([fetchVisibilityRpc(), fetchGsc(), fetchBing()]);
  if (rpc == null) return NextResponse.json({ error: "STATS_ERROR" }, { status: 502 });
  return NextResponse.json({ ...(rpc as object), gsc, bing });
}
