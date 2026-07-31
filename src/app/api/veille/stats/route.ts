import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  verifySession,
  setSession,
  fetchVeilleStats,
} from "@/lib/adminSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Données du dashboard. Protégé par le cookie de session ; chaque appel valide
// rafraîchit l'expiration (session glissante 20 min).
export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!verifySession(token).valid) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  await setSession(); // prolonge la session à chaque activité
  const stats = await fetchVeilleStats();
  if (stats == null) {
    return NextResponse.json({ error: "STATS_ERROR" }, { status: 502 });
  }
  return NextResponse.json(stats);
}
