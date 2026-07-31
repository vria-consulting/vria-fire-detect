import { NextResponse } from "next/server";
import { getWaterBombers } from "@/lib/aircraft";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Position des Canadair en vol. Réponse mise en cache par le CDN Vercel
// (s-maxage) : quel que soit le nombre de visiteurs, l'API amont n'est
// sollicitée qu'environ une fois toutes les 15 s.
export async function GET() {
  const planes = await getWaterBombers();
  return NextResponse.json(
    { planes, at: Date.now() },
    {
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=45",
      },
    }
  );
}
