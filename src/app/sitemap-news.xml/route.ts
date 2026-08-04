import { NextResponse } from "next/server";
import { listFiresBetween, type ArchivedFire } from "@/lib/firearchive";
import { DEPT_BY_SLUG } from "@/lib/departements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sitemap Google News : les contenus « chauds » de moins de 48 h — pages
// événement + bilans quotidiens. Éligibilité Google News / Discover.
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function titleOf(f: ArchivedFire): string {
  const deptName = f.dept_slug ? DEPT_BY_SLUG.get(f.dept_slug)?.name : null;
  const where = f.place
    ? `${f.place}${deptName ? ` (${deptName})` : f.admin ? ` (${f.admin})` : ""}`
    : deptName ?? f.admin ?? "zone isolée";
  return `Feu de forêt à ${where} : chronologie en temps réel`;
}

export async function GET() {
  const now = new Date();
  const from = new Date(now.getTime() - 48 * 3600 * 1000);
  const fires = await listFiresBetween(from.toISOString(), now.toISOString(), 300);

  const entry = (loc: string, date: string, title: string) =>
    `<url><loc>${loc}</loc><news:news><news:publication><news:name>kanari</news:name><news:language>fr</news:language></news:publication><news:publication_date>${date}</news:publication_date><news:title>${esc(title)}</news:title></news:news></url>`;

  const items: string[] = [];
  // Bilans du jour et de la veille.
  for (const off of [0, 1]) {
    const d = new Date(now.getTime() - off * 86400_000).toISOString().slice(0, 10);
    items.push(
      entry(
        `https://kanari.io/fr/bilan/${d}`,
        `${d}T05:00:00Z`,
        `Bilan des feux de forêt du ${new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
      )
    );
  }
  for (const f of fires) {
    items.push(entry(`https://kanari.io/fr/feu/${f.slug}`, f.first_seen, titleOf(f)));
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${items.join("")}</urlset>`;
  return new NextResponse(xml, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, s-maxage=900, stale-while-revalidate=1800",
    },
  });
}
