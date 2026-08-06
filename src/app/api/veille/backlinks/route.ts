import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySession, setSession } from "@/lib/adminSession";
import { fetchBacklinksRpc, fetchBingLinks } from "@/lib/visibility";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Onglet « Référencement » : domaines référents observés, liens vus par
// Bing, suivi des soumissions annuaires. Session admin obligatoire.
export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!verifySession(token).valid) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  await setSession();

  const [rpc, bing] = await Promise.all([fetchBacklinksRpc(), fetchBingLinks()]);
  if (rpc == null) return NextResponse.json({ error: "STATS_ERROR" }, { status: 502 });
  return NextResponse.json({ ...(rpc as object), bing });
}
