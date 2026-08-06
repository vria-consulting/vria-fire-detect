"use client";

import { useCallback, useEffect, useState } from "react";
import { VeilleLogin } from "@/components/VeilleLogin";
import { BarList, Card, Kpi, emptyStyle, fmt, h3Style } from "@/components/VeilleDashboard";

// Onglet « Visibilité » : SEO (Google/Bing) + IA (bots, referrals, citations).
// Même contrat que l'onglet Audience : chargement à l'ouverture, bouton ↻
// géré par le parent, AUCUN rafraîchissement automatique.

type GscTotals = { clicks: number; impressions: number; ctr: number; position: number };
type Data = {
  generated_at: string;
  bots_daily: { day: string; bot: string; hits: number }[];
  bots_totals: { bot: string; hits_7d: number; hits_prev7: number }[];
  bot_top_paths: { path: string; hits: number }[];
  ai_referrals: { host: string; views_7d: number; views_prev7: number }[];
  citations: { week: string; engine: string; question: string; cited: boolean; position: number | null; ts: string }[];
  gsc: {
    connected: boolean;
    data?: {
      window: { start: string; end: string };
      totals: Record<string, { current: GscTotals; previous: GscTotals }>;
      top_queries: { query: string; clicks: number; impressions: number }[];
      top_pages: { page: string; clicks: number; impressions: number; type: string }[];
    };
  };
  bing: {
    connected: boolean;
    data?: { clicks_7d: number; impressions_7d: number; clicks_prev7: number; impressions_prev7: number };
  };
};

// Bots « IA » (vs crawlers de recherche classiques, affichés mais à part).
const AI_BOTS = new Set([
  "OAI-SearchBot", "ChatGPT-User", "GPTBot", "Claude-SearchBot", "Claude-User",
  "ClaudeBot", "Perplexity-User", "PerplexityBot", "Amazonbot", "Applebot",
  "Bytespider", "Meta", "Cohere", "MistralAI",
]);
// Fetchs déclenchés par une question d'utilisateur en direct.
const LIVE_BOTS = new Set(["ChatGPT-User", "Perplexity-User", "Claude-User", "OAI-SearchBot", "Claude-SearchBot"]);

function delta(cur: number, prev: number): string {
  if (prev === 0) return cur > 0 ? "nouveau" : "—";
  const d = Math.round(((cur - prev) / prev) * 100);
  return `${d >= 0 ? "+" : ""}${d}% vs 7 j préc.`;
}

function trendArrow(cur: number, prev: number): { glyph: string; color: string } {
  if (cur > prev) return { glyph: "↑", color: "#3aa76d" };
  if (cur < prev) return { glyph: "↓", color: "var(--danger, #D64545)" };
  return { glyph: "→", color: "var(--ink-3)" };
}

// Instructions de branchement affichées tant que la connexion n'existe pas.
function SetupSteps({ title, steps, env }: { title: string; steps: string[]; env: string }) {
  return (
    <div style={{ marginTop: 12, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.55 }}>
      <div style={{ display: "inline-block", background: "var(--canary-tint)", borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
        non connecté — {title}
      </div>
      <ol style={{ margin: 0, paddingLeft: 18 }}>
        {steps.map((s, i) => (<li key={i} style={{ marginBottom: 3 }}>{s}</li>))}
      </ol>
      <div style={{ marginTop: 6, color: "var(--ink-3)" }}>
        Variable Vercel : <code style={{ background: "var(--paper-2, #f2efe8)", padding: "1px 6px", borderRadius: 6 }}>{env}</code> — le bloc s&apos;allume tout seul au déploiement suivant.
      </div>
    </div>
  );
}

export function VeilleVisibility({ reloadKey }: { reloadKey: number }) {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState(false);
  const [expired, setExpired] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/veille/visibility", { cache: "no-store" });
      if (res.status === 401) { setExpired(true); return; }
      if (!res.ok) { setErr(true); return; }
      setData(await res.json());
      setErr(false);
    } catch {
      setErr(true);
    }
  }, []);

  useEffect(() => { load(); }, [load, reloadKey]);

  if (expired) return <VeilleLogin />;
  if (err) return <Card><div style={emptyStyle}>Erreur de chargement — réessaie avec ↻.</div></Card>;

  const bots = data?.bots_totals ?? [];
  const aiHits7 = bots.filter((b) => AI_BOTS.has(b.bot)).reduce((s, b) => s + b.hits_7d, 0);
  const aiHitsPrev = bots.filter((b) => AI_BOTS.has(b.bot)).reduce((s, b) => s + b.hits_prev7, 0);
  const liveHits7 = bots.filter((b) => LIVE_BOTS.has(b.bot)).reduce((s, b) => s + b.hits_7d, 0);
  const refs = data?.ai_referrals ?? [];
  const refs7 = refs.reduce((s, r) => s + r.views_7d, 0);
  const refsPrev = refs.reduce((s, r) => s + r.views_prev7, 0);

  const g = data?.gsc;
  const gT = g?.data?.totals;
  const gClicks = gT ? gT.web.current.clicks + gT.discover.current.clicks + gT.news.current.clicks : null;
  const gClicksPrev = gT ? gT.web.previous.clicks + gT.discover.previous.clicks + gT.news.previous.clicks : 0;
  const gImpr = gT ? gT.web.current.impressions + gT.discover.current.impressions + gT.news.current.impressions : null;

  const latestWeek = (data?.citations ?? [])[0]?.week;
  const panel = (data?.citations ?? []).filter((c) => c.week === latestWeek && c.engine === "chatgpt-search");
  const cited = panel.filter((c) => c.cited).length;

  return (
    <>
      {/* KPI */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 14 }}>
        <Kpi
          label="Clics Google (7 j)"
          value={gClicks === null ? "—" : fmt(gClicks)}
          sub={gClicks === null ? "Search Console non connectée" : `${delta(gClicks, gClicksPrev)} · dont ${fmt(gT!.discover.current.clicks)} Discover`}
        />
        <Kpi
          label="Impressions Google"
          value={gImpr === null ? "—" : fmt(gImpr)}
          sub={gImpr === null ? "Search Console non connectée" : `position moyenne ${gT!.web.current.position.toFixed(1)}`}
        />
        <Kpi label="Lectures par des IA (7 j)" value={fmt(aiHits7)} sub={delta(aiHits7, aiHitsPrev)} />
        <Kpi label="Consultations IA en direct" value={fmt(liveHits7)} sub="pages chargées pour répondre à un utilisateur" />
        <Kpi label="Visites venues des IA (7 j)" value={fmt(refs7)} sub={delta(refs7, refsPrev)} />
        <Kpi
          label="Citations IA (panel)"
          value={panel.length > 0 ? `${cited}/${panel.length}` : "—"}
          sub={panel.length > 0 ? `semaine ${latestWeek}` : "premier test au prochain cron hebdo"}
        />
      </section>

      {/* Google */}
      <section style={{ marginBottom: 14 }}>
        <Card>
          <h3 style={h3Style}>Google : Search · Discover · News</h3>
          {!g?.connected ? (
            <SetupSteps
              title="10 min, une seule fois"
              env="GSC_SERVICE_ACCOUNT"
              steps={[
                "console.cloud.google.com → crée un projet, active l'API « Google Search Console », crée un compte de service et télécharge sa clé JSON.",
                "search.google.com/search-console → propriété kanari.io → Paramètres → Utilisateurs → ajoute l'e-mail du compte de service (accès complet).",
                "Colle le contenu du JSON dans la variable Vercel (3 environnements).",
              ]}
            />
          ) : (
            <>
              <div style={{ overflowX: "auto", marginTop: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ color: "var(--ink-3)", textAlign: "left" }}>
                      <th style={thStyle}>Surface</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Clics</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Impressions</th>
                      <th style={{ ...thStyle, textAlign: "right" }}>Tendance clics</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["web", "discover", "news"] as const).map((k) => {
                      const t = gT![k];
                      const a = trendArrow(t.current.clicks, t.previous.clicks);
                      return (
                        <tr key={k} style={{ borderTop: "1px solid var(--line)" }}>
                          <td style={tdStyle}>{k === "web" ? "Recherche" : k === "discover" ? "Discover" : "News"}</td>
                          <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{fmt(t.current.clicks)}</td>
                          <td style={{ ...tdStyle, textAlign: "right" }}>{fmt(t.current.impressions)}</td>
                          <td style={{ ...tdStyle, textAlign: "right", color: a.color, fontWeight: 700 }}>{a.glyph} {fmt(t.previous.clicks)} → {fmt(t.current.clicks)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 8 }}>
                Fenêtre {g.data!.window.start} → {g.data!.window.end} (la Search Console publie avec ~2 jours de retard).
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginTop: 14 }}>
                <BarList title="Top requêtes (Recherche)" rows={g.data!.top_queries.map((q) => ({ key: q.query, label: q.query, value: q.clicks }))} />
                <BarList
                  title="Top pages (Recherche + Discover)"
                  rows={g.data!.top_pages.map((p) => ({
                    key: `${p.type}-${p.page}`,
                    label: (
                      <span>
                        {p.page.replace("https://kanari.io", "")}{" "}
                        {p.type === "discover" && <span style={{ fontSize: 11, color: "var(--ember)", fontWeight: 700 }}>Discover</span>}
                      </span>
                    ),
                    value: p.clicks,
                  }))}
                />
              </div>
            </>
          )}
        </Card>
      </section>

      {/* Robots IA + referrals */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginBottom: 14 }}>
        <Card>
          <h3 style={h3Style}>Robots IA et moteurs sur kanari (7 j)</h3>
          {bots.length === 0 ? (
            <div style={emptyStyle}>Aucun passage détecté pour l&apos;instant — le comptage vient d&apos;être activé.</div>
          ) : (
            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ color: "var(--ink-3)", textAlign: "left" }}>
                    <th style={thStyle}>Bot</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Visites 7 j</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Tendance</th>
                  </tr>
                </thead>
                <tbody>
                  {bots.map((b) => {
                    const a = trendArrow(b.hits_7d, b.hits_prev7);
                    return (
                      <tr key={b.bot} style={{ borderTop: "1px solid var(--line)" }}>
                        <td style={tdStyle}>
                          {b.bot}{" "}
                          {LIVE_BOTS.has(b.bot) && <span style={{ fontSize: 11, color: "var(--ember)", fontWeight: 700 }}>live</span>}
                          {!AI_BOTS.has(b.bot) && <span style={{ fontSize: 11, color: "var(--ink-3)" }}> · moteur</span>}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: 700 }}>{fmt(b.hits_7d)}</td>
                        <td style={{ ...tdStyle, textAlign: "right", color: a.color, fontWeight: 700 }}>{a.glyph}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <BarList title="Pages les plus lues par les bots (7 j)" rows={(data?.bot_top_paths ?? []).map((p) => ({ key: p.path, label: p.path, value: p.hits }))} />
          <BarList title="Visites venues des moteurs IA (7 j)" rows={refs.map((r) => ({ key: r.host, label: r.host, value: r.views_7d }))} />
        </div>
      </section>

      {/* Citations + Bing */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginBottom: 14 }}>
        <Card>
          <h3 style={h3Style}>Panel de citations : « kanari est-il cité ? »</h3>
          {panel.length === 0 ? (
            <div style={emptyStyle}>
              Premier passage au prochain cron (15 questions posées chaque semaine à ChatGPT avec recherche web).
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 12 }}>
              {panel.map((c) => (
                <div key={c.question} style={{ display: "flex", justifyContent: "space-between", gap: 10, borderTop: "1px solid var(--line)", paddingTop: 6 }}>
                  <span style={{ fontSize: 13, color: "var(--ink)", minWidth: 0 }}>{c.question}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", color: c.cited ? "#3aa76d" : "var(--ink-3)" }}>
                    {c.cited ? (c.position ? `cité #${c.position}` : "mentionné") : "absent"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <h3 style={h3Style}>Bing (index de ChatGPT et Copilot)</h3>
          {!data?.bing?.connected ? (
            <SetupSteps
              title="2 min"
              env="BING_WEBMASTER_API_KEY"
              steps={[
                "bing.com/webmasters → ⚙ Settings → API access → génère une API key.",
                "Colle la clé dans la variable Vercel (3 environnements).",
              ]}
            />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Clics (7 j)</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: "var(--ink)" }}>{fmt(data.bing.data!.clicks_7d)}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{delta(data.bing.data!.clicks_7d, data.bing.data!.clicks_prev7)}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Impressions (7 j)</div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, color: "var(--ink)" }}>{fmt(data.bing.data!.impressions_7d)}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{delta(data.bing.data!.impressions_7d, data.bing.data!.impressions_prev7)}</div>
              </div>
            </div>
          )}
        </Card>
      </section>
    </>
  );
}

const thStyle: React.CSSProperties = { padding: "0 10px 8px", fontWeight: 600, fontSize: 12 };
const tdStyle: React.CSSProperties = { padding: "8px 10px", color: "var(--ink)" };
