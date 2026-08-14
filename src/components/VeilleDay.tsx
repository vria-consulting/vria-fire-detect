"use client";

import { useCallback, useEffect, useState } from "react";
import { VeilleLogin } from "@/components/VeilleLogin";
import { Card, Kpi, emptyStyle, fmt, h3Style } from "@/components/VeilleDashboard";
import { HoverChart, ShareList, type ChartPoint } from "@/components/VeilleCharts";

// Vue « détail d'une journée » : ouverte en cliquant sur un jour dans les
// graphiques (Audience ou Tendances). Totaux, répartition horaire
// (Europe/Paris), pages, référents, pays, appareils et robots du jour,
// avec navigation jour précédent / suivant.

type DayData = {
  generated_at: string;
  day: string;
  totals: { views: number; uniques: number };
  hourly: { hour: number; views: number }[];
  top_paths: { path: string; views: number }[];
  referrers: { host: string; views: number }[];
  countries: { country: string; views: number }[];
  devices: { device: string; views: number }[];
  bots: { bot: string; hits: number }[];
};

// Même classement que l'onglet Visibilité : bots IA vs crawlers classiques.
const AI_BOTS = new Set([
  "OAI-SearchBot", "ChatGPT-User", "GPTBot", "Claude-SearchBot", "Claude-User",
  "ClaudeBot", "Perplexity-User", "PerplexityBot", "Amazonbot", "Applebot",
  "Bytespider", "Meta", "Cohere", "MistralAI", "CCBot", "Google-Extended",
]);

function flag(cc: string): string {
  if (!cc || cc.length !== 2 || !/^[A-Z]{2}$/.test(cc)) return "🏳️";
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

function shiftDay(d: string, delta: number): string {
  const t = new Date(d + "T12:00:00Z");
  t.setUTCDate(t.getUTCDate() + delta);
  return t.toISOString().slice(0, 10);
}

const navBtn: React.CSSProperties = {
  background: "var(--surface-card)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-pill)",
  padding: "6px 13px",
  fontSize: 13,
  color: "var(--ink-2)",
  cursor: "pointer",
  fontFamily: "var(--font-body)",
};

export function VeilleDay({
  day,
  onBack,
  onNav,
}: {
  day: string;
  onBack: () => void;
  onNav: (d: string) => void;
}) {
  const [data, setData] = useState<DayData | null>(null);
  const [err, setErr] = useState(false);
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/veille/day?d=${encodeURIComponent(day)}`, { cache: "no-store" });
      if (res.status === 401) {
        setExpired(true);
        return;
      }
      if (!res.ok) {
        setErr(true);
        return;
      }
      setData(await res.json());
      setErr(false);
    } catch {
      setErr(true);
    } finally {
      setLoading(false);
    }
  }, [day]);

  useEffect(() => {
    load();
  }, [load]);

  if (expired) return <VeilleLogin />;

  const today = new Date().toISOString().slice(0, 10);
  const isToday = day >= today;
  const title = new Date(day + "T12:00:00").toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const hourly: ChartPoint[] = (data?.hourly ?? []).map((h) => ({
    label: `${h.hour} h`,
    main: h.views,
  }));
  const peak = (data?.hourly ?? []).reduce((m, h) => (h.views > m.views ? h : m), { hour: 0, views: 0 });

  const botsAi = (data?.bots ?? []).filter((b) => AI_BOTS.has(b.bot)).reduce((s, b) => s + b.hits, 0);
  const botsAll = (data?.bots ?? []).reduce((s, b) => s + b.hits, 0);

  return (
    <>
      {/* Barre de navigation du jour */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <button onClick={onBack} style={navBtn}>← Retour</button>
        <h2 style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, color: "var(--ink)", margin: 0, textTransform: "capitalize" }}>
          {title}
        </h2>
        {isToday && <span style={{ fontSize: 12, color: "var(--ink-3)", fontStyle: "italic" }}>journée en cours</span>}
        {loading && <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Chargement…</span>}
        {err && <span style={{ fontSize: 12, color: "var(--danger, #D64545)" }}>erreur de chargement</span>}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button onClick={() => onNav(shiftDay(day, -1))} style={navBtn}>← jour précéd.</button>
          <button
            onClick={() => onNav(shiftDay(day, 1))}
            disabled={isToday}
            style={{ ...navBtn, opacity: isToday ? 0.4 : 1, cursor: isToday ? "default" : "pointer" }}
          >
            jour suivant →
          </button>
        </div>
      </div>

      {/* KPIs du jour */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 14 }}>
        <Kpi label="Vues" value={fmt(data?.totals.views)} />
        <Kpi label="Visiteurs" value={fmt(data?.totals.uniques)} />
        <Kpi label="Heure de pointe" value={peak.views > 0 ? `${peak.hour} h` : "—"} sub={peak.views > 0 ? `${fmt(peak.views)} vues` : undefined} />
        <Kpi label="Passages robots IA" value={fmt(botsAi)} sub={`${fmt(botsAll)} robots au total`} />
      </section>

      {/* Répartition horaire */}
      <section style={{ marginBottom: 14 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
            <h3 style={h3Style}>Répartition horaire</h3>
            <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>heure de Paris</span>
          </div>
          {hourly.every((h) => h.main === 0) ? (
            <div style={emptyStyle}>Aucune visite ce jour-là</div>
          ) : (
            <div style={{ marginTop: 10 }}>
              <HoverChart data={hourly} mainLabel="vues" height={160} />
            </div>
          )}
        </Card>
      </section>

      {/* Pages + référents */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginBottom: 14 }}>
        <Card>
          <ShareList
            title="Pages vues ce jour"
            rows={(data?.top_paths ?? []).map((p) => ({ key: p.path, label: p.path, value: p.views }))}
            emptyText="Aucune page vue ce jour-là"
            maxRows={14}
          />
        </Card>
        <Card>
          <ShareList
            title="D'où venaient les visiteurs"
            rows={(data?.referrers ?? []).map((r) => ({ key: r.host, label: r.host, value: r.views }))}
            emptyText="Aucun référent ce jour-là"
          />
        </Card>
      </section>

      {/* Pays + appareils + robots */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
        <Card>
          <ShareList
            title="Pays"
            rows={(data?.countries ?? []).map((c) => ({ key: c.country, label: <span>{flag(c.country)} {c.country}</span>, value: c.views }))}
            emptyText="Aucune visite ce jour-là"
          />
        </Card>
        <Card>
          <ShareList
            title="Appareils"
            rows={(data?.devices ?? []).map((d) => ({ key: d.device, label: d.device, value: d.views }))}
            emptyText="Aucune visite ce jour-là"
          />
        </Card>
        <Card>
          <ShareList
            title="Robots passés ce jour"
            rows={(data?.bots ?? []).map((b) => ({
              key: b.bot,
              label: b.bot,
              value: b.hits,
              sub: AI_BOTS.has(b.bot) ? "IA" : undefined,
            }))}
            emptyText="Aucun robot enregistré ce jour-là"
            maxRows={14}
          />
        </Card>
      </section>
    </>
  );
}
