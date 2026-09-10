import { NextResponse } from "next/server";
import { getFireBySlug } from "@/lib/firearchive";
import { fetchStrategicPoints } from "@/lib/strategic";
import { fetchOfficialPerimeter } from "@/lib/perimeters";

export const maxDuration = 30;
// Optional enrichments are fetched after the core page has loaded.
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return new NextResponse("Invalid slug", { status: 400 });
  const fire = await getFireBySlug(slug);
  if (!fire) return new NextResponse("Not found", { status: 404 });
  const [strategic, perimeter] = fire.status === "active" ? await Promise.all([
    fetchStrategicPoints(fire.lat, fire.lon),
    fetchOfficialPerimeter(fire.lat, fire.lon, fire.country, fire.first_seen),
  ]) : [[], null];
  return NextResponse.json({ strategic, perimeter, fetchedAt: new Date().toISOString() }, {
    headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" },
  });
}
