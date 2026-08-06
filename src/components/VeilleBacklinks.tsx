"use client";

import { useCallback, useEffect, useState } from "react";
import { VeilleLogin } from "@/components/VeilleLogin";
import { Card, Kpi, emptyStyle, fmt, h3Style, timeAgo } from "@/components/VeilleDashboard";
import { ShareList } from "@/components/VeilleCharts";

// Onglet « Référencement » : qui fait des liens vers kanari (index Bing +
// domaines référents réellement observés dans le trafic) et où en est le
// plan de soumissions (annuaires, open data, wikis, presse).

type Data = {
  generated_at: string;
  referrers: { host: string; views_30d: number; views_7d: number; first_seen: string; last_seen: string }[];
  submissions: { id: number; site: string; url: string | null; category: string; status: string; submitted_at: string | null; notes: string | null }[];
  bing: {
    connected: boolean;
    data?: {
      targets: { url: string; count: number }[];
      sources: { target: string; url: string }[];
      total: number;
    };
  };
};

// Classification des référents : un « backlink vivant » est un domaine qui
// n'est ni un moteur, ni un réseau social, ni un moteur IA.
const ENGINES = new Set(["google.com", "www.google.com", "bing.com", "www.bing.com", "duckduckgo.com", "search.brave.com", "ecosia.org", "www.ecosia.org", "qwant.com", "www.qwant.com", "yandex.ru", "search.yahoo.com"]);
const SOCIAL = new Set(["linkedin.com", "www.linkedin.com", "lnkd.in", "t.co", "x.com", "twitter.com", "facebook.com", "www.facebook.com", "m.facebook.com", "l.facebook.com", "instagram.com", "l.instagram.com", "reddit.com", "www.reddit.com", "old.reddit.com", "news.ycombinator.com", "bsky.app", "t.me", "web.telegram.org", "youtube.com", "www.youtube.com"]);
const AI = new Set(["chatgpt.com", "chat.openai.com", "perplexity.ai", "www.perplexity.ai", "copilot.microsoft.com", "gemini.google.com", "claude.ai", "you.com", "phind.com", "poe.com"]);

function classify(host: string): { label: string; color: string } {
  const h = host.toLowerCase();
  if (ENGINES.has(h) || h.endsWith(".google.com")) return { label: "moteur", color: "var(--ink-3)" };
  if (AI.has(h)) return { label: "IA", color: "#7C5CBF" };
  if (SOCIAL.has(h)) return { label: "social", color: "#4A90C2" };
  if (h.endsWith("kanari.io")) return { label: "interne", color: "var(--ink-3)" };
  return { label: "backlink", color: "#3aa76d" };
}

const STATUS: Record<string, { label: string; bg: string; ink: string }> = {
  todo: { label: "à faire", bg: "var(--paper-2, #F2EFE8)", ink: "var(--ink-2)" },
  pending: { label: "en attente", bg: "#FAEEDA", ink: "#854F0B" },
  done: { label: "fait", bg: "#EAF3DE", ink: "#3B6D11" },
  rejected: { label: "refusé", bg: "#FCEBEB", ink: "#A32D2D" },
};

const CATEGORY_LABEL: Record<string, string> = {
  opendata: "Open data",
  entite: "Entités et graphes de connaissance",
  annuaire: "Annuaires produits",
  communaute: "Communautés et wikis",
  presse: "Presse et demandes journalistes",
  niche: "Sites de niche feux de forêt",
};

export function VeilleBacklinks({ reloadKey }: { reloadKey: number }) {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState(false);
  const [expired, setExpired] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/veille/backlinks", { cache: "no-store" });
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

  const refs = data?.referrers ?? [];
  const backlinkRefs = refs.filter((r) => classify(r.host).label === "backlink");
  const subs = data?.submissions ?? [];
  const done = subs.filter((s) => s.status === "done").length;
  const bing = data?.bing;

  const byCategory = new Map<string, typeof subs>();
  for (const s of subs) {
    const arr = byCategory.get(s.category) ?? [];
    arr.push(s);
    byCategory.set(s.category, arr);
  }

  return (
    <>
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 14 }}>
        <Kpi
          label="Domaines qui nous envoient du trafic"
          value={fmt(backlinkRefs.length)}
          sub="hors moteurs, réseaux sociaux et IA (30 j)"
        />
        <Kpi
          label="Liens vus par Bing"
          value={bing?.connected ? fmt(bing.data?.total ?? 0) : "—"}
          sub={bing?.connected ? `${fmt(bing.data?.targets.length ?? 0)} pages liées` : "clé API absente"}
        />
        <Kpi label="Soumissions réalisées" value={`${done}/${subs.length}`} sub="plan de référencement ci-dessous" />
        <Kpi
          label="Visites via backlinks (7 j)"
          value={fmt(backlinkRefs.reduce((s, r) => s + r.views_7d, 0))}
          sub="preuve que les liens vivent"
        />
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, marginBottom: 14 }}>
        <Card>
          <ShareList
            title="Domaines référents observés (30 j)"
            emptyText="Aucun référent externe encore — normal à ce stade, le plan ci-dessous sert à ça."
            rows={refs.slice(0, 15).map((r) => {
              const c = classify(r.host);
              return {
                key: r.host,
                label: (
                  <span>
                    {r.host}{" "}
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: c.color, border: `1px solid ${c.color}`, borderRadius: 6, padding: "0 5px" }}>
                      {c.label}
                    </span>
                  </span>
                ),
                value: r.views_30d,
                sub: `1re visite ${timeAgo(r.first_seen)}`,
              };
            })}
          />
        </Card>
        <Card>
          <h3 style={h3Style}>Liens entrants dans l&apos;index Bing</h3>
          {!bing?.connected ? (
            <div style={emptyStyle}>Clé Bing absente.</div>
          ) : (bing.data?.targets.length ?? 0) === 0 ? (
            <div style={emptyStyle}>
              Rien encore : Bing met plusieurs semaines à peupler les données de liens d&apos;un site
              récent. Les domaines référents « vivants » (à gauche) sont l&apos;indicateur temps réel.
            </div>
          ) : (
            <>
              <div style={{ marginTop: 12 }}>
                <ShareList
                  title=""
                  rows={(bing.data?.targets ?? []).slice(0, 10).map((t) => ({
                    key: t.url,
                    label: t.url.replace(/^https?:\/\/(www\.)?kanari\.io/, ""),
                    value: t.count,
                  }))}
                />
              </div>
              {(bing.data?.sources.length ?? 0) > 0 && (
                <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--ink-2)" }}>
                  Sources : {(bing.data?.sources ?? []).slice(0, 8).map((s) => {
                    try { return new URL(s.url).hostname; } catch { return s.url; }
                  }).filter((v, i, a) => a.indexOf(v) === i).join(" · ")}
                </div>
              )}
            </>
          )}
        </Card>
      </section>

      <section style={{ marginBottom: 14 }}>
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
            <h3 style={h3Style}>Plan de référencement — {done}/{subs.length} fait{done > 1 ? "s" : ""}</h3>
            <span style={{ fontSize: 12, color: "var(--ink-3)" }}>mis à jour au fil des soumissions</span>
          </div>
          {subs.length === 0 ? (
            <div style={emptyStyle}>Le plan arrive.</div>
          ) : (
            [...byCategory.entries()].map(([cat, items]) => (
              <div key={cat} style={{ marginTop: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px", color: "var(--ink-3)", marginBottom: 6 }}>
                  {CATEGORY_LABEL[cat] ?? cat}
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {items.map((s) => {
                    const st = STATUS[s.status] ?? STATUS.todo;
                    return (
                      <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, borderTop: "1px solid var(--line)", padding: "8px 0" }}>
                        <span style={{ fontSize: 11.5, fontWeight: 700, background: st.bg, color: st.ink, borderRadius: 999, padding: "2px 10px", whiteSpace: "nowrap" }}>
                          {st.label}
                        </span>
                        <span style={{ fontSize: 13.5, color: "var(--ink)", minWidth: 0, flex: 1 }}>
                          {s.url ? (
                            <a href={s.url} target="_blank" rel="noreferrer" style={{ color: "var(--link)" }}>{s.site}</a>
                          ) : (
                            s.site
                          )}
                          {s.notes && <span style={{ color: "var(--ink-3)", fontSize: 12.5 }}> — {s.notes}</span>}
                        </span>
                        {s.submitted_at && (
                          <span style={{ fontSize: 12, color: "var(--ink-3)", whiteSpace: "nowrap" }}>{timeAgo(s.submitted_at)}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </Card>
      </section>
    </>
  );
}
