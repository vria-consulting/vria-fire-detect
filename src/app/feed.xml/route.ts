import { NextResponse } from "next/server";
import { listFiresBetween, type ArchivedFire } from "@/lib/firearchive";
import { DEPT_BY_SLUG } from "@/lib/departements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Flux RSS des feux : agrégateurs, veilles presse/SDIS, crawlers IA — un
// canal de plus qui distribue chaque événement en quasi temps réel.
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function titleOf(f: ArchivedFire): string {
  const deptName = f.dept_slug ? DEPT_BY_SLUG.get(f.dept_slug)?.name : null;
  const where = f.place
    ? `${f.place}${deptName ? ` (${deptName})` : f.admin ? ` (${f.admin})` : ""}`
    : deptName ?? f.admin ?? "zone isolée";
  return `Feu de forêt à ${where}`;
}

export async function GET() {
  const now = new Date();
  const from = new Date(now.getTime() - 48 * 3600 * 1000);
  const fires = await listFiresBetween(from.toISOString(), now.toISOString(), 60);

  const items = fires
    .map((f) => {
      const desc = `${f.detections} détection${f.detections > 1 ? "s" : ""} satellite · puissance max ${Math.round(f.max_frp)} MW${f.aircraft.length > 0 ? ` · ${f.aircraft.length} moyen(s) aérien(s) observé(s)` : ""}${f.confidence === "corrobore" ? " · corroboré par témoins" : ""} · statut : ${f.status === "active" ? "actif" : "plus détecté"}.`;
      return `<item><title>${esc(titleOf(f))}</title><link>https://kanari.io/fr/feu/${f.slug}</link><guid isPermaLink="true">https://kanari.io/fr/feu/${f.slug}</guid><pubDate>${new Date(f.first_seen).toUTCString()}</pubDate><description>${esc(desc)}</description></item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>kanari — départs de feu détectés</title><link>https://kanari.io/fr</link><atom:link href="https://kanari.io/feed.xml" rel="self" type="application/rss+xml"/><description>Les feux de forêt significatifs détectés en temps réel par kanari (satellites NASA FIRMS, GOES, Meteosat MTG + témoins vérifiés).</description><language>fr</language><lastBuildDate>${now.toUTCString()}</lastBuildDate>${items}</channel></rss>`;
  return new NextResponse(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, s-maxage=900, stale-while-revalidate=1800",
    },
  });
}
