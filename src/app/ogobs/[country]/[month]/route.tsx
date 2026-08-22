import { ImageResponse } from "next/og";
import { isValidLang, type Lang } from "@/lib/i18n";
import { MONTH_RE, monthRange, periodStats } from "@/lib/observatory";
import { monthLabel, resolveScope } from "@/lib/observatory-i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Image de partage des pages observatoire pays × mois (bilans mensuels) :
// même carte de chiffres que les bilans quotidiens, aux couleurs de la charte.
// ?lang=fr|en|es|pt pour les libellés (défaut : anglais).

const L = {
  fr: {
    title: (name: string, month: string) => `${name} : feux de forêt en ${month}`,
    fires: "feux significatifs détectés",
    active: "encore actifs",
    peak: "puissance max (MW)",
    top: (place: string, frp: number) => `Feu le plus puissant : ${place} · ${Math.round(frp)} MW`,
    none: "Aucun feu significatif archivé pour ce mois.",
    live: "bilan du mois en cours, mis à jour en continu",
    past: "bilan mensuel",
    footer: "Satellites NASA FIRMS, GOES, Meteosat MTG + témoins vérifiés par IA · chiffres librement citables (CC BY 4.0)",
  },
  en: {
    title: (name: string, month: string) => `${name}: wildfires in ${month}`,
    fires: "significant fires detected",
    active: "still active",
    peak: "peak power (MW)",
    top: (place: string, frp: number) => `Most powerful fire: ${place} · ${Math.round(frp)} MW`,
    none: "No significant fire archived for this month.",
    live: "current month, updated continuously",
    past: "monthly report",
    footer: "NASA FIRMS, GOES, Meteosat MTG satellites + AI-verified witnesses · figures freely citable (CC BY 4.0)",
  },
  es: {
    title: (name: string, month: string) => `${name}: incendios forestales en ${month}`,
    fires: "incendios significativos detectados",
    active: "todavía activos",
    peak: "potencia máx. (MW)",
    top: (place: string, frp: number) => `Incendio más potente: ${place} · ${Math.round(frp)} MW`,
    none: "Ningún incendio significativo archivado este mes.",
    live: "mes en curso, actualizado continuamente",
    past: "balance mensual",
    footer: "Satélites NASA FIRMS, GOES, Meteosat MTG + testigos verificados por IA · cifras libremente citables (CC BY 4.0)",
  },
  pt: {
    title: (name: string, month: string) => `${name}: incêndios florestais em ${month}`,
    fires: "incêndios significativos detectados",
    active: "ainda ativos",
    peak: "potência máx. (MW)",
    top: (place: string, frp: number) => `Incêndio mais potente: ${place} · ${Math.round(frp)} MW`,
    none: "Nenhum incêndio significativo arquivado neste mês.",
    live: "mês atual, atualizado continuamente",
    past: "balanço mensal",
    footer: "Satélites NASA FIRMS, GOES, Meteosat MTG + testemunhas verificadas por IA · números livremente citáveis (CC BY 4.0)",
  },
} as const;

export async function GET(req: Request, { params }: { params: Promise<{ country: string; month: string }> }) {
  const { country, month: raw } = await params;
  const month = raw.replace(/\.png$/, "");
  const l = new URL(req.url).searchParams.get("lang") ?? "en";
  const lang: Lang = isValidLang(l) ? l : "en";
  if (!MONTH_RE.test(month)) return new Response("bad month", { status: 400 });
  const scope = resolveScope(country, lang);
  if (!scope) return new Response("unknown scope", { status: 404 });
  const range = monthRange(month)!;
  const t = L[lang];
  const s = await periodStats(range.fromIso, range.toIso, scope.cc);
  const isCurrent = month === new Date().toISOString().slice(0, 7);
  const top = s.biggest[0];

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
      <div style={{ width: 1200, height: 630, display: "flex", flexDirection: "column", background: "#FBF9F4", padding: "44px 54px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", padding: "10px 26px", borderRadius: 999, background: "#FFC72E", color: "#1B1C1E", fontSize: 30, fontWeight: 700 }}>
            kanari.io
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#8A8880" }}>{isCurrent ? t.live : t.past}</div>
        </div>
        <div style={{ display: "flex", marginTop: 30, fontSize: 50, fontWeight: 700, color: "#1B1C1E", lineHeight: 1.1 }}>
          {scope.flag} {t.title(scope.name, monthLabel(month, lang))}
        </div>
        <div style={{ display: "flex", gap: 26, marginTop: 38 }}>
          {kpi(String(s.total), t.fires, "#D64545")}
          {kpi(String(s.active), t.active)}
          {kpi(String(Math.round(s.maxFrp)), t.peak)}
        </div>
        <div style={{ display: "flex", marginTop: 36, fontSize: 27, color: "#5B5A54" }}>
          {top ? t.top(top.place ?? top.slug, top.max_frp) : t.none}
        </div>
        <div style={{ display: "flex", marginTop: "auto", fontSize: 22, color: "#8A8880" }}>{t.footer}</div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        "cache-control": isCurrent ? "public, s-maxage=1800, stale-while-revalidate=3600" : "public, s-maxage=86400, stale-while-revalidate=604800",
        "content-type": "image/png",
      },
    }
  );
}
