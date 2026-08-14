import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, setSession } from "@/lib/adminSession";
import { fetchDayRpc } from "@/lib/visibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Drill-down d'une journée cliquée dans un graphique de /veille :
// totaux, répartition horaire (Europe/Paris), pages, référents, pays,
// appareils et robots du jour. Mêmes règles de session que /stats.
export async function GET(req: NextRequest) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!verifySession(token).valid) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  await setSession();

  const d = req.nextUrl.searchParams.get("d") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return NextResponse.json({ error: "BAD_DAY" }, { status: 400 });
  }

  const rpc = await fetchDayRpc(d);
  if (rpc == null) return NextResponse.json({ error: "STATS_ERROR" }, { status: 502 });
  return NextResponse.json(rpc);
}
