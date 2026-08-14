"use client";

import { useCallback, useEffect, useState } from "react";
import { VeilleLogin } from "@/components/VeilleLogin";
import { Card, emptyStyle, h3Style } from "@/components/VeilleDashboard";
import { fmtN, HoverChart, MultiLine, TrendCard, type ChartPoint } from "@/components/VeilleCharts";

// Onglet « Tendances » : l'évolution de TOUS les indicateurs d'un coup d'œil.
// Cartes KPI avec sparkline 30 j + deltas 7 j vs 7 j précédents, canaux
// d'acquisition, séries Google Search Console, mots-clés en progression,
// robots IA vs moteurs, citations IA, domaines référents cumulés.
// Même contrat que les autres onglets : chargement à l'ouverture, bouton ↻
// géré par le parent, aucun rafraîchissement automatique.

type ChannelDay = {
  day: string;
  search: number;
  social: number;
  direct: number;
  ai: number;
  referral: number;
  total: number;
  uniques: number;
};
type Trends = {
  generated_at: string;
  channels_daily: ChannelDay[];
  bots_daily: { day: string; ai: number; engines: number }[];
  citations_weekly: { week: string; total: number; cited: number }[];
  domains_cumul: { day: string; domains: number }[];
  gsc: {
    connected: boolean;
    daily?: { date: string; clicks: number; impressions: number; position: number }[];
    rising?: { query: string; clicks: number; impressions: number; prev_clicks: number; prev_impressions: number }[];
  };
};

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
const avg = (a: number[]) => (a.length > 0 ? sum(a) / a.length : 0);
const r1 = (n: number) => Math.round(n * 10) / 10;

export function VeilleTrends({ reloadKey, onDay }: { reloadKey: number; onDay: (d: string) => void }) {
  const [data, setData] = useState<Trends | null>(null);
  const [err, setErr] = useState(false);
  const [expired, setExpired] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/veille/trends", { cache: "no-store" });
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
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  if (expired) return <VeilleLogin />;
  if (err) return <Card><div style={emptyStyle}>Erreur de chargement — réessaie avec ↻</div></Card>;
  if (!data) return <Card><div style={emptyStyle}>Chargement…</div></Card>;

  const days = data.channels_daily;
  // Fenêtres de comparaison : 7 derniers jours COMPLETS vs les 7 d'avant
  // (la journée en cours fausserait les moyennes).
  const cur7 = days.slice(-8, -1);
  const prev7 = days.slice(-15, -8);
  const kTotal = { cur: sum(cur7.map((d) => d.total)), prev: sum(prev7.map((d) => d.total)) };
  const kUniques = { cur: sum(cur7.map((d) => d.uniques)), prev: sum(prev7.map((d) => d.uniques)) };
  const kSearch = { cur: sum(cur7.map((d) => d.search + d.ai)), prev: sum(prev7.map((d) => d.search + d.ai)) };
  const searchShare = kTotal.cur > 0 ? Math.round((kSearch.cur / kTotal.cur) * 100) : 0;
  const searchSharePrev = kTotal.prev > 0 ? Math.round((kSearch.prev / kTotal.prev) * 100) : 0;

  const bots = data.bots_daily;
  const kBotsAi = { cur: sum(bots.slice(-8, -1).map((b) => b.ai)), prev: sum(bots.slice(-15, -8).map((b) => b.ai)) };

  const domains = data.domains_cumul;
  const domNow = domains.at(-1)?.domains ?? 0;
  const domWeekAgo = domains.at(-8)?.domains ?? 0;

  const gscDaily = data.gsc.daily ?? [];
  const gCur = gscDaily.slice(-7);
  const gPrev = gscDaily.slice(-14, -7);
  const kClicks = { cur: sum(gCur.map((g) => g.clicks)), prev: sum(gPrev.map((g) => g.clicks)) };
  const kImpr = { cur: sum(gCur.map((g) => g.impressions)), prev: sum(gPrev.map((g) => g.impressions)) };
  const posCur = r1(avg(gCur.filter((g) => g.position > 0).map((g) => g.position)));
  const posPrev = r1(avg(gPrev.filter((g) => g.position > 0).map((g) => g.position)));

  const cit = data.citations_weekly;
  const citLast = cit.at(-1);

  const gscData: ChartPoint[] = gscDaily.map((g) => ({
    label: fmtDay(g.date),
    main: g.impressions,
    secondary: g.clicks,
  }));

  const rising = data.gsc.rising ?? [];
  const maxRise = Math.max(1, ...rising.map((q) => q.impressions));

  return (
    <>
      {/* Cartes KPI : la dynamique de chaque indicateur, sparkline 30 j */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 14 }}>
        <TrendCard
          label="Visites / 7 j"
          value={fmtN(kTotal.cur)}
          sub={`${fmtN(kUniques.cur)} visiteurs`}
          cur={kTotal.cur}
          prev={kTotal.prev}
          series={days.map((d) => d.total)}
          color="var(--ember)"
        />
        <TrendCard
          label="Part recherche + IA"
          value={`${searchShare}%`}
          sub="des visites (7 j)"
          cur={searchShare}
          prev={searchSharePrev}
          series={days.map((d) => (d.total > 0 ? Math.round(((d.search + d.ai) / d.total) * 100) : 0))}
          color="#3aa76d"
        />
        {data.gsc.connected && (
          <TrendCard
            label="Clics Google / 7 j"
            value={fmtN(kClicks.cur)}
            sub={`${fmtN(kImpr.cur)} impressions`}
            cur={kClicks.cur}
            prev={kClicks.prev}
            series={gscDaily.map((g) => g.clicks)}
            color="#4a90d9"
          />
        )}
        {data.gsc.connected && (
          <TrendCard
            label="Impressions Google / 7 j"
            value={fmtN(kImpr.cur)}
            sub="résultats de recherche"
            cur={kImpr.cur}
            prev={kImpr.prev}
            series={gscDaily.map((g) => g.impressions)}
            color="#4a90d9"
          />
        )}
        {data.gsc.connected && posCur > 0 && (
          <TrendCard
            label="Position moyenne"
            value={String(posCur)}
            sub="plus bas = mieux"
            cur={posCur}
            prev={posPrev}
            invert
            series={gscDaily.map((g) => g.position)}
            color="#8b5cf6"
          />
        )}
        <TrendCard
          label="Domaines référents"
          value={fmtN(domNow)}
          sub="cumul des sites qui envoient du trafic"
          cur={domNow}
          prev={domWeekAgo}
          series={domains.map((d) => d.domains)}
          color="#b8860b"
        />
        <TrendCard
          label="Passages robots IA / 7 j"
          value={fmtN(kBotsAi.cur)}
          sub="GPTBot, ClaudeBot, Perplexity…"
          cur={kBotsAi.cur}
          prev={kBotsAi.prev}
          series={bots.map((b) => b.ai)}
          color="#8b5cf6"
        />
        {citLast && (
          <TrendCard
            label="Citations IA"
            value={`${citLast.cited}/${citLast.total}`}
            sub={`questions citées · ${citLast.week}`}
            cur={citLast.cited}
            prev={cit.at(-2)?.cited ?? 0}
            series={cit.map((c) => c.cited)}
            color="#d64545"
          />
        )}
      </section>

      {/* Canaux d'acquisition : d'où vient le trafic, jour par jour */}
      <section style={{ marginBottom: 14 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
            <h3 style={h3Style}>Canaux d&apos;acquisition (30 j)</h3>
            <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>clic sur un jour = détail · dernier point incomplet</span>
          </div>
          <div style={{ marginTop: 12 }}>
            <MultiLine
              labels={days.map((d) => fmtDay(d.day))}
              series={[
                { name: "Recherche", color: "#3aa76d", values: days.map((d) => d.search) },
                { name: "Social", color: "#4a90d9", values: days.map((d) => d.social) },
                { name: "Direct", color: "var(--ink-3)", values: days.map((d) => d.direct), dash: true },
                { name: "IA (ChatGPT…)", color: "#8b5cf6", values: days.map((d) => d.ai) },
                { name: "Référents", color: "var(--ember)", values: days.map((d) => d.referral) },
              ]}
              onSelect={(i) => days[i] && onDay(days[i].day)}
            />
          </div>
        </Card>
      </section>

      {/* Google Search Console : impressions + clics + mots-clés montants */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14, marginBottom: 14 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
            <h3 style={h3Style}>Google Search : impressions & clics</h3>
            <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>28 j · données J-2</span>
          </div>
          {!data.gsc.connected ? (
            <div style={emptyStyle}>Search Console non connectée — voir l&apos;onglet Visibilité pour le branchement.</div>
          ) : gscData.length === 0 ? (
            <div style={emptyStyle}>Pas encore de données côté Google (site récent, ça arrive vite).</div>
          ) : (
            <div style={{ marginTop: 12 }}>
              <HoverChart
                data={gscData}
                mainLabel="impressions"
                secondaryLabel="clics"
                color="#cfe0f2"
                lineColor="#4a90d9"
                onSelect={(i) => gscDaily[i] && onDay(gscDaily[i].date)}
              />
            </div>
          )}
        </Card>

        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
            <h3 style={h3Style}>Mots-clés en progression</h3>
            <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>14 j vs 14 j précédents</span>
          </div>
          {!data.gsc.connected ? (
            <div style={emptyStyle}>Search Console non connectée.</div>
          ) : rising.length === 0 ? (
            <div style={emptyStyle}>Pas encore assez d&apos;historique pour repérer des requêtes montantes.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 12 }}>
              {rising.map((q) => (
                <div key={q.query} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center" }}>
                  <div style={{ position: "relative", minWidth: 0 }}>
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: `${(q.impressions / maxRise) * 100}%`,
                        background: "var(--canary-tint)",
                        borderRadius: 6,
                      }}
                    />
                    <div style={{ position: "relative", padding: "5px 9px", fontSize: 13, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {q.query}
                      {q.clicks > 0 && <span style={{ color: "var(--ink-3)", fontSize: 11.5 }}> · {q.clicks} clic{q.clicks > 1 ? "s" : ""}</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#3aa76d", whiteSpace: "nowrap" }}>
                    {q.prev_impressions === 0 ? "nouveau" : `▲ +${fmtN(q.impressions - q.prev_impressions)}`}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)", fontVariantNumeric: "tabular-nums", minWidth: 40, textAlign: "right" }}>
                    {fmtN(q.impressions)}
                  </span>
                </div>
              ))}
              <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>Volume = impressions Google sur 14 j.</div>
            </div>
          )}
        </Card>
      </section>

      {/* Robots + citations + domaines : la visibilité machine */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
        <Card>
          <h3 style={h3Style}>Robots : IA vs moteurs (30 j)</h3>
          <div style={{ marginTop: 12 }}>
            <MultiLine
              height={170}
              labels={bots.map((b) => fmtDay(b.day))}
              series={[
                { name: "Robots IA", color: "#8b5cf6", values: bots.map((b) => b.ai) },
                { name: "Moteurs (Google, Bing…)", color: "#3aa76d", values: bots.map((b) => b.engines) },
              ]}
              onSelect={(i) => bots[i] && onDay(bots[i].day)}
            />
          </div>
        </Card>

        <Card>
          <h3 style={h3Style}>Citations IA par semaine</h3>
          {cit.length === 0 ? (
            <div style={emptyStyle}>Le panel hebdomadaire n&apos;a pas encore tourné.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginTop: 12 }}>
              {cit.slice(-8).map((c) => (
                <div key={c.week} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 10, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>{c.week}</span>
                  <div style={{ background: "var(--paper-2, #f2efe8)", borderRadius: 6, height: 10, overflow: "hidden" }}>
                    <div style={{ width: `${c.total > 0 ? (c.cited / c.total) * 100 : 0}%`, height: "100%", background: "#8b5cf6", borderRadius: 6 }} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>
                    {c.cited}/{c.total}
                  </span>
                </div>
              ))}
              <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>
                Part des questions du panel où kanari est cité par ChatGPT.
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h3 style={h3Style}>Domaines référents cumulés</h3>
          <div style={{ marginTop: 12 }}>
            <MultiLine
              height={170}
              labels={domains.map((d) => fmtDay(d.day))}
              series={[{ name: "Domaines distincts ayant déjà envoyé du trafic", color: "#b8860b", values: domains.map((d) => d.domains) }]}
            />
          </div>
        </Card>
      </section>
    </>
  );
}
