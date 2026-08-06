"use client";

import { useCallback, useEffect, useState } from "react";
import { VeilleLogin } from "@/components/VeilleLogin";
import { VeilleVisibility } from "@/components/VeilleVisibility";

// ---- Types (miroir de public.veille_stats) --------------------------------
type Totals = {
  today_views: number; today_uniques: number;
  views_7d: number; uniques_7d: number;
  views_30d: number; uniques_30d: number;
  views_all: number; uniques_all: number;
};
type Stats = {
  generated_at: string;
  live: number;
  totals: Totals;
  daily: { day: string; views: number; uniques: number }[];
  hourly: { hour: string; views: number }[];
  top_paths: { path: string; views: number }[];
  top_referrers: { host: string; views: number }[];
  countries: { country: string; views: number }[];
  devices: { device: string; views: number }[];
  browsers: { browser: string; views: number }[];
  utm: { source: string; campaign: string; views: number; uniques: number }[];
  langs: { lang: string; views: number }[];
  contrib: {
    total: number; new: number; today: number; views_contrib_7d: number;
    recent: {
      id: string; created_at: string; name: string; email: string; role: string | null;
      message: string; files: number; status: string; source: string | null; country: string | null;
    }[];
  };
};

// ---- Helpers d'affichage --------------------------------------------------
const nf = new Intl.NumberFormat("fr-FR");
export const fmt = (n: number | undefined) => nf.format(n ?? 0);

function flag(cc: string): string {
  if (!cc || cc.length !== 2 || !/^[A-Z]{2}$/.test(cc)) return "🏳️";
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
export function timeAgo(iso: string): string {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "à l'instant";
  if (d < 3600) return `il y a ${Math.floor(d / 60)} min`;
  if (d < 86400) return `il y a ${Math.floor(d / 3600)} h`;
  return `il y a ${Math.floor(d / 86400)} j`;
}
function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// ---- Composants réutilisables ---------------------------------------------
export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-l)",
        padding: 18,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <div style={{ color: "var(--ink-3)", fontSize: 12, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-display)", fontSize: 30, fontWeight: 600, color: "var(--ink)", lineHeight: 1.1, marginTop: 6 }}>
        {value}
      </div>
      {sub && <div style={{ color: "var(--ink-3)", fontSize: 13, marginTop: 2 }}>{sub}</div>}
    </Card>
  );
}

export function BarList({
  title,
  rows,
  render,
}: {
  title: string;
  rows: { key: string; label: React.ReactNode; value: number }[];
  render?: (v: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Card>
      <h3 style={h3Style}>{title}</h3>
      {rows.length === 0 && <div style={emptyStyle}>Aucune donnée pour l&apos;instant</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
        {rows.map((r) => (
          <div key={r.key} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center" }}>
            <div style={{ position: "relative", minWidth: 0 }}>
              <div
                style={{
                  position: "absolute", inset: 0, width: `${(r.value / max) * 100}%`,
                  background: "var(--canary-tint)", borderRadius: 6,
                }}
              />
              <div style={{ position: "relative", padding: "5px 9px", fontSize: 13, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.label}
              </div>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>
              {render ? render(r.value) : fmt(r.value)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// Courbe des visites (30 j) : barres visites + trait visiteurs uniques.
function DailyChart({ data }: { data: { day: string; views: number; uniques: number }[] }) {
  const W = 720, H = 180, P = 8;
  const max = Math.max(1, ...data.map((d) => d.views));
  const n = data.length;
  const bw = n > 0 ? (W - P * 2) / n : 0;
  const x = (i: number) => P + i * bw;
  const y = (v: number) => H - P - (v / max) * (H - P * 2);
  const line = data.map((d, i) => `${x(i) + bw / 2},${y(d.uniques)}`).join(" ");
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 style={h3Style}>Visites — 30 jours</h3>
        <div style={{ fontSize: 12, color: "var(--ink-3)", display: "flex", gap: 14 }}>
          <span><span style={{ color: "var(--canary-strong)" }}>▊</span> vues</span>
          <span><span style={{ color: "var(--ember)" }}>—</span> visiteurs</span>
        </div>
      </div>
      {n === 0 ? (
        <div style={emptyStyle}>Aucune donnée pour l&apos;instant</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", marginTop: 10 }} preserveAspectRatio="none">
          {data.map((d, i) => (
            <rect key={i} x={x(i) + 1} y={y(d.views)} width={Math.max(1, bw - 2)} height={H - P - y(d.views)} rx={2} fill="var(--canary-soft)" />
          ))}
          <polyline points={line} fill="none" stroke="var(--ember)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>
        <span>{data[0] ? shortDate(data[0].day) : ""}</span>
        <span>{data[n - 1] ? shortDate(data[n - 1].day) : ""}</span>
      </div>
    </Card>
  );
}

export const h3Style: React.CSSProperties = {
  fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--ink)", margin: 0,
};
export const emptyStyle: React.CSSProperties = { color: "var(--ink-3)", fontSize: 13, marginTop: 12, fontStyle: "italic" };

const statusColor: Record<string, string> = {
  new: "var(--canary-strong)", reviewed: "var(--ink-3)", done: "#3aa76d",
};

// ---- Dashboard ------------------------------------------------------------
export function VeilleDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState(false);
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<number>(0);
  const [tab, setTab] = useState<"audience" | "visibilite">("audience");
  // Incrémenté par ↻ : l'onglet Visibilité recharge quand il change.
  const [reloadKey, setReloadKey] = useState(0);

  // Chargement à l'ouverture uniquement (pas de rafraîchissement automatique) —
  // le bouton « Rafraîchir » relance à la demande.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/veille/stats", { cache: "no-store" });
      if (res.status === 401) {
        // Session absente/expirée : on affiche l'écran de reconnexion,
        // JAMAIS de redirection automatique (sinon boucle de rechargement).
        setExpired(true);
        return;
      }
      if (!res.ok) {
        setErr(true);
        return;
      }
      setStats(await res.json());
      setErr(false);
      setUpdatedAt(Date.now());
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function logout() {
    await fetch("/api/veille/logout", { method: "POST" });
    window.location.href = "/veille";
  }

  // Session expirée : on réutilise l'écran de connexion (lien magique).
  if (expired) return <VeilleLogin />;

  const t = stats?.totals;
  const c = stats?.contrib;
  const convRate = c && c.views_contrib_7d > 0 ? Math.round((c.total / c.views_contrib_7d) * 100) : null;

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto", padding: "20px 16px 60px", fontFamily: "var(--font-body)" }}>
      {/* En-tête */}
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 26 }}>🐤</span>
          <div>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 21, fontWeight: 600, color: "var(--ink)", margin: 0, letterSpacing: "-0.3px" }}>
              Veille kanari
            </h1>
            <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
              {loading ? "Chargement…" : updatedAt ? `Mis à jour ${timeAgo(new Date(updatedAt).toISOString())}` : ""}
              {err && <span style={{ color: "var(--danger)" }}> · erreur de chargement</span>}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--surface-card)", border: "1px solid var(--line)", borderRadius: "var(--radius-pill)", padding: "6px 13px" }}>
            <span style={{ position: "relative", width: 9, height: 9 }}>
              <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#3aa76d" }} />
              <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "#3aa76d", animation: "veille-pulse 1.6s ease-out infinite" }} />
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{fmt(stats?.live)}</span>
            <span style={{ fontSize: 12, color: "var(--ink-3)" }}>en direct</span>
          </div>
          <button onClick={() => { load(); setReloadKey((k) => k + 1); }} disabled={loading} title="Rafraîchir les données" style={{ background: "none", border: "1px solid var(--line)", borderRadius: "var(--radius-pill)", padding: "6px 13px", fontSize: 13, color: "var(--ink-2)", cursor: loading ? "wait" : "pointer", fontFamily: "var(--font-body)", opacity: loading ? 0.6 : 1 }}>
            ↻ Rafraîchir
          </button>
          <button onClick={logout} style={{ background: "none", border: "1px solid var(--line)", borderRadius: "var(--radius-pill)", padding: "6px 13px", fontSize: 13, color: "var(--ink-2)", cursor: "pointer", fontFamily: "var(--font-body)" }}>
            Se déconnecter
          </button>
        </div>
      </header>

      {/* Onglets */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {([["audience", "Audience"], ["visibilite", "Visibilité"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              background: tab === key ? "var(--canary)" : "var(--surface-card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-pill)",
              padding: "7px 16px",
              fontSize: 13.5,
              fontWeight: 700,
              color: tab === key ? "var(--charcoal, #1B1C1E)" : "var(--ink-2)",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "visibilite" && <VeilleVisibility reloadKey={reloadKey} />}

      {tab === "audience" && (
      <>
      {/* KPIs */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 14 }}>
        <Kpi label="Aujourd'hui" value={fmt(t?.today_views)} sub={`${fmt(t?.today_uniques)} visiteurs`} />
        <Kpi label="7 jours" value={fmt(t?.views_7d)} sub={`${fmt(t?.uniques_7d)} visiteurs`} />
        <Kpi label="30 jours" value={fmt(t?.views_30d)} sub={`${fmt(t?.uniques_30d)} visiteurs`} />
        <Kpi label="Total" value={fmt(t?.views_all)} sub={`${fmt(t?.uniques_all)} visiteurs`} />
        <Kpi label="Contributions" value={fmt(c?.total)} sub={`${fmt(c?.new)} à traiter`} />
      </section>

      {/* Courbe */}
      <section style={{ marginBottom: 14 }}>
        <DailyChart data={stats?.daily ?? []} />
      </section>

      {/* Pages + Référents */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginBottom: 14 }}>
        <BarList title="Pages les plus vues (7 j)" rows={(stats?.top_paths ?? []).map((p) => ({ key: p.path, label: p.path, value: p.views }))} />
        <BarList title="D'où viennent les visiteurs (7 j)" rows={(stats?.top_referrers ?? []).map((r) => ({ key: r.host, label: r.host, value: r.views }))} />
      </section>

      {/* UTM — impact des campagnes (LinkedIn) */}
      <section style={{ marginBottom: 14 }}>
        <Card>
          <h3 style={h3Style}>Campagnes & sources UTM (30 j)</h3>
          {(stats?.utm ?? []).length === 0 ? (
            <div style={emptyStyle}>Aucune campagne trackée. Ajoute <code>?utm_source=linkedin&utm_campaign=lancement</code> à tes liens.</div>
          ) : (
            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: "var(--ink-3)", textAlign: "left" }}>
                    <th style={thStyle}>Source</th><th style={thStyle}>Campagne</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Visites</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Visiteurs</th>
                  </tr>
                </thead>
                <tbody>
                  {stats!.utm.map((u, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--line)" }}>
                      <td style={tdStyle}>{u.source}</td>
                      <td style={{ ...tdStyle, color: "var(--ink-3)" }}>{u.campaign || "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{fmt(u.views)}</td>
                      <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(u.uniques)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>

      {/* Pays + Appareils + Navigateurs */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14, marginBottom: 14 }}>
        <BarList title="Pays (30 j)" rows={(stats?.countries ?? []).map((c) => ({ key: c.country, label: <span>{flag(c.country)} {c.country}</span>, value: c.views }))} />
        <BarList title="Appareils (30 j)" rows={(stats?.devices ?? []).map((d) => ({ key: d.device, label: d.device, value: d.views }))} />
        <BarList title="Navigateurs (30 j)" rows={(stats?.browsers ?? []).map((b) => ({ key: b.browser, label: b.browser, value: b.views }))} />
      </section>

      {/* Entonnoir + contributions récentes */}
      <section style={{ display: "grid", gridTemplateColumns: "minmax(220px, 1fr) minmax(300px, 2fr)", gap: 14 }}>
        <Card>
          <h3 style={h3Style}>Entonnoir contribution</h3>
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Visites page « Contribuer » (7 j)</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: "var(--ink)" }}>{fmt(c?.views_contrib_7d)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Contributions reçues (total)</div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: "var(--ink)" }}>{fmt(c?.total)}</div>
            </div>
            {convRate !== null && (
              <div style={{ background: "var(--canary-tint)", borderRadius: "var(--radius-m)", padding: "10px 12px" }}>
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Taux de conversion (7 j)</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, color: "var(--ink)" }}>{convRate}%</div>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h3 style={h3Style}>Dernières contributions</h3>
          {(c?.recent ?? []).length === 0 ? (
            <div style={emptyStyle}>Aucune contribution pour l&apos;instant</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
              {c!.recent.map((r) => (
                <div key={r.id} style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: statusColor[r.status] || "var(--ink-3)", flexShrink: 0 }} />
                      <strong style={{ fontSize: 14, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</strong>
                      {r.role && <span style={{ fontSize: 12, color: "var(--ink-3)" }}>· {r.role}</span>}
                    </div>
                    <span style={{ fontSize: 12, color: "var(--ink-3)", whiteSpace: "nowrap" }}>{timeAgo(r.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 3, lineHeight: 1.45 }}>{r.message}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 4, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <span>{r.email}</span>
                    {r.files > 0 && <span>📎 {r.files}</span>}
                    {r.country && <span>{flag(r.country)}</span>}
                    {r.source && <span>· {r.source}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>
      </>
      )}

      <style>{`@keyframes veille-pulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.6);opacity:0}}`}</style>
    </div>
  );
}

const thStyle: React.CSSProperties = { padding: "0 10px 8px", fontWeight: 600, fontSize: 12 };
const tdStyle: React.CSSProperties = { padding: "8px 10px", color: "var(--ink)" };
