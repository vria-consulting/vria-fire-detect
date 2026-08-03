import { NextResponse } from "next/server";
import { listFireSlugs } from "@/lib/firearchive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sitemap dédié aux pages événement (/fr/feu/…) : corpus qui grossit à chaque
// feu — séparé du sitemap principal pour que Google le digère efficacement.
export async function GET() {
  const slugs = await listFireSlugs(5000);
  const urls = slugs
    .map(
      (s) =>
        `<url><loc>https://kanari.io/fr/feu/${s.slug}</loc><lastmod>${new Date(s.updated_at).toISOString()}</lastmod></url>`
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://kanari.io/fr/feu</loc><lastmod>${new Date().toISOString()}</lastmod></url>${urls}</urlset>`;
  return new NextResponse(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=7200",
    },
  });
}
