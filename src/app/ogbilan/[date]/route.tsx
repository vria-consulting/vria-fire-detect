import { ImageResponse } from "next/og";
import { listFiresBetween } from "@/lib/firearchive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Image de partage des bilans quotidiens : carte de chiffres aux couleurs de
// la charte (grande image unique par page, exigence Discover), régénérée en
// continu pour le jour en cours puis stable.

function nextDay(d: string): string {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date: raw } = await params;
  const date = raw.replace(/\.png$/, "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return new Response("bad date", { status: 400 });

  const fires = await listFiresBetween(`${date}T00:00:00Z`, `${nextDay(date)}T00:00:00Z`, 5000);
  const fr = fires.filter((f) => f.country === "FR");
  const aircraft = new Set<string>();
  for (const f of fires) for (const a of f.aircraft) aircraft.add(a.id);
  const top = fires[0]; // trié par max_frp décroissant
  const dateFr = new Date(`${date}T12:00:00Z`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const isToday = date === new Date().toISOString().slice(0, 10);

  const kpi = (value: string, label: string, color = "#1B1C1E") => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#FFFFFF",
        borderRadius: 26,
        padding: "26px 34px",
        boxShadow: "0 10px 26px rgba(27,28,30,0.10)",
        minWidth: 240,
      }}
    >
      <div style={{ display: "flex", fontSize: 76, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ display: "flex", marginTop: 8, fontSize: 26, color: "#5B5A54" }}>{label}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          flexDirection: "column",
          background: "#FBF9F4",
          padding: "44px 54px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              padding: "10px 26px",
              borderRadius: 999,
              background: "#FFC72E",
              color: "#1B1C1E",
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            kanari.io
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#8A8880" }}>
            {isToday ? "bilan en cours, mis à jour en continu" : "bilan de la journée"}
          </div>
        </div>
        <div style={{ display: "flex", marginTop: 30, fontSize: 52, fontWeight: 700, color: "#1B1C1E", lineHeight: 1.1 }}>
          Feux de forêt : le bilan du {dateFr}
        </div>
        <div style={{ display: "flex", gap: 26, marginTop: 38 }}>
          {kpi(String(fires.length), "départs significatifs détectés", "#D64545")}
          {kpi(String(fr.length), "en France", fr.length > 0 ? "#D64545" : "#22684A")}
          {aircraft.size > 0
            ? kpi(String(aircraft.size), "moyens aériens observés")
            : kpi(String(new Set(fires.map((f) => f.country ?? "?")).size), "pays touchés")}
        </div>
        <div style={{ display: "flex", marginTop: 36, fontSize: 27, color: "#5B5A54" }}>
          {top
            ? `Foyer le plus puissant : ${top.place ?? "détection satellite"} (${top.country ?? "?"}) · ${Math.round(top.max_frp)} MW`
            : "Aucun départ significatif archivé pour cette journée."}
        </div>
        <div style={{ display: "flex", marginTop: "auto", fontSize: 22, color: "#8A8880" }}>
          Satellites NASA FIRMS, GOES, Meteosat MTG + témoins vérifiés par IA · chiffres librement citables (CC BY 4.0)
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "cache-control": isToday
          ? "public, s-maxage=900, stale-while-revalidate=1800"
          : "public, s-maxage=86400, stale-while-revalidate=604800",
        "content-type": "image/png",
      },
    }
  );
}
