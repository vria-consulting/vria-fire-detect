import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Dernier créneau GeoColor réellement publié sur GIBS, lu dans le champ
// <Default> des capabilities WMTS (la latence varie de ~1 h à ~12 h). Le XML
// fait ~2 Mo : on le lit CÔTÉ SERVEUR, en cache 15 min, et on ne renvoie que
// deux horodatages au client (mode replay de la carte).
const CAPS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml";

export async function GET() {
  try {
    const res = await fetch(CAPS, { next: { revalidate: 900 } });
    if (!res.ok) return NextResponse.json({ east: null, west: null }, { status: 502 });
    const xml = await res.text();
    const defaultOf = (layer: string): string | null => {
      const i = xml.indexOf(`<ows:Identifier>${layer}</ows:Identifier>`);
      if (i < 0) return null;
      const seg = xml.slice(i, i + 4000);
      return seg.match(/<Default>([^<]+)<\/Default>/)?.[1] ?? null;
    };
    return NextResponse.json(
      {
        east: defaultOf("GOES-East_ABI_GeoColor"),
        west: defaultOf("GOES-West_ABI_GeoColor"),
      },
      { headers: { "cache-control": "public, s-maxage=900, stale-while-revalidate=900" } }
    );
  } catch {
    return NextResponse.json({ east: null, west: null }, { status: 502 });
  }
}
