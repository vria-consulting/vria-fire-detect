import { ImageResponse } from "next/og";
import { getFireBySlug } from "@/lib/firearchive";
import { DEPT_BY_SLUG } from "@/lib/departements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Image de partage par feu : mosaïque satellite NASA GIBS (vraie couleur,
// jour de la première détection) centrée sur le foyer + bandeau kanari.
// Sert à la fois d'og:image et d'image d'article (exigence Google Discover :
// grande image unique par page). Hors /api et exempté du proxy i18n.

const W = 1200;
const H = 630;
const TILE = 420; // 256 px natifs upscalés — assez nets en fond de carte
const Z = 8;

function tileXY(lat: number, lon: number): { xf: number; yf: number } {
  const n = 2 ** Z;
  const xf = ((lon + 180) / 360) * n;
  const rad = (lat * Math.PI) / 180;
  const yf = ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n;
  return { xf, yf };
}

// L'imagerie VIIRS du jour même n'est souvent publiée qu'en fin de journée :
// on prend le jour de première détection, borné à hier.
function imageryDate(firstSeen: string): string {
  const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);
  const d = firstSeen.slice(0, 10);
  return d < yesterday ? d : yesterday;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const f = await getFireBySlug(slug.replace(/\.png$/, ""));
  if (!f) return new Response("not found", { status: 404 });

  const { xf, yf } = tileXY(f.lat, f.lon);
  const date = imageryDate(f.first_seen);
  const n = 2 ** Z;

  // Tuiles couvrant le cadre, le foyer exactement au centre (600, 315).
  const tiles: { left: number; top: number; url: string }[] = [];
  for (let tx = Math.floor(xf - W / 2 / TILE); tx <= Math.floor(xf + W / 2 / TILE); tx++) {
    for (let ty = Math.floor(yf - H / 2 / TILE); ty <= Math.floor(yf + H / 2 / TILE); ty++) {
      if (ty < 0 || ty >= n) continue;
      const wx = ((tx % n) + n) % n; // enroulement antiméridien
      tiles.push({
        left: Math.round(W / 2 - (xf - tx) * TILE),
        top: Math.round(H / 2 - (yf - ty) * TILE),
        url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${date}/GoogleMapsCompatible_Level9/${Z}/${ty}/${wx}.jpg`,
      });
    }
  }

  const deptName = f.dept_slug ? DEPT_BY_SLUG.get(f.dept_slug)?.name : null;
  const where = f.place
    ? `${f.place}${deptName ? ` (${deptName})` : f.admin ? ` (${f.admin})` : ""}`
    : deptName ?? f.admin ?? "zone inhabitée";
  const dateFr = new Date(f.first_seen).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", position: "relative", background: "#1B1C1E", overflow: "hidden" }}>
        {tiles.map((t) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={t.url}
            src={t.url}
            width={TILE}
            height={TILE}
            style={{ position: "absolute", left: t.left, top: t.top, width: TILE, height: TILE }}
            alt=""
          />
        ))}
        {/* Marqueur du foyer, au centre exact */}
        <div
          style={{
            position: "absolute",
            left: W / 2 - 34,
            top: H / 2 - 34,
            width: 68,
            height: 68,
            borderRadius: 68,
            border: "5px solid rgba(255,199,46,0.95)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ width: 22, height: 22, borderRadius: 22, background: "#D64545", border: "3px solid #FBF9F4" }} />
        </div>
        {/* Bandeau titre */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            flexDirection: "column",
            padding: "26px 44px 30px",
            background: "linear-gradient(to top, rgba(20,20,22,0.92), rgba(20,20,22,0.55) 70%, rgba(20,20,22,0))",
          }}
        >
          <div style={{ display: "flex", color: "#FBF9F4", fontSize: 52, fontWeight: 700, lineHeight: 1.12 }}>
            Feu de forêt à {where}
          </div>
          <div style={{ display: "flex", marginTop: 10, color: "#E8D9B0", fontSize: 30 }}>
            {dateFr} · {Math.round(f.max_frp)} MW · {f.detections} détection{f.detections > 1 ? "s" : ""} satellite
            {f.aircraft.length > 0 ? ` · ${f.aircraft.length} moyen(s) aérien(s)` : ""}
          </div>
        </div>
        {/* Marque */}
        <div
          style={{
            position: "absolute",
            top: 26,
            left: 44,
            display: "flex",
            alignItems: "center",
            padding: "10px 24px",
            borderRadius: 999,
            background: "#FFC72E",
            color: "#1B1C1E",
            fontSize: 30,
            fontWeight: 700,
          }}
        >
          kanari.io
        </div>
        <div
          style={{
            position: "absolute",
            top: 34,
            right: 44,
            display: "flex",
            color: "rgba(251,249,244,0.85)",
            fontSize: 21,
          }}
        >
          Image satellite NASA · {date}
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      headers: {
        // L'imagerie du jour J-1 ne change plus : cache long côté CDN.
        "cache-control": "public, s-maxage=43200, stale-while-revalidate=86400",
        "content-type": "image/png",
      },
    }
  );
}
