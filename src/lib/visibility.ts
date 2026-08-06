// Visibilité SEO + IA : données de l'onglet « Visibilité » de /veille.
// - RPC Supabase veille_visibility (bots IA, referrals IA, citations)
// - Google Search Console (Search / Discover / News) via service account
// - Bing Webmaster via clé API
// - Panel de citations hebdomadaire (OpenAI + recherche web)
// Les connexions GSC/Bing sont optionnelles : sans variable d'environnement,
// le bloc s'affiche « non connecté » avec les instructions.

import { createSign } from "node:crypto";

function supabaseCreds(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

// ---- Agrégats Supabase ----------------------------------------------------
export async function fetchVisibilityRpc(): Promise<unknown | null> {
  const sb = supabaseCreds();
  if (!sb) return null;
  try {
    const res = await fetch(`${sb.url}/rest/v1/rpc/veille_visibility`, {
      method: "POST",
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
        "content-type": "application/json",
      },
      body: "{}",
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ---- Google Search Console ------------------------------------------------
// GSC_SERVICE_ACCOUNT = JSON du service account ({client_email, private_key}),
// ajouté comme utilisateur « accès complet » de la propriété https://kanari.io/.
const GSC_SITE = "https://kanari.io/";

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

async function gscAccessToken(email: string, privateKey: string): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: email,
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })
  );
  const signature = createSign("RSA-SHA256").update(`${header}.${claims}`).sign(privateKey);
  const assertion = `${header}.${claims}.${b64url(signature)}`;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return ((await res.json()) as { access_token?: string }).access_token ?? null;
}

type GscTotals = { clicks: number; impressions: number; ctr: number; position: number };
export type GscData = {
  window: { start: string; end: string };
  totals: Record<string, { current: GscTotals; previous: GscTotals }>;
  top_queries: { query: string; clicks: number; impressions: number }[];
  top_pages: { page: string; clicks: number; impressions: number; type: string }[];
};

function day(offset: number): string {
  return new Date(Date.now() - offset * 86400_000).toISOString().slice(0, 10);
}

async function gscQuery(
  token: string,
  body: Record<string, unknown>
): Promise<{ rows?: { keys?: string[]; clicks: number; impressions: number; ctr: number; position: number }[] } | null> {
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(GSC_SITE)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    }
  );
  if (!res.ok) return null;
  return await res.json();
}

const Z: GscTotals = { clicks: 0, impressions: 0, ctr: 0, position: 0 };
function firstRow(r: Awaited<ReturnType<typeof gscQuery>>): GscTotals {
  const row = r?.rows?.[0];
  return row
    ? { clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position }
    : Z;
}

export async function fetchGsc(): Promise<{ connected: boolean; data?: GscData }> {
  const raw = process.env.GSC_SERVICE_ACCOUNT;
  if (!raw) return { connected: false };
  try {
    const sa = JSON.parse(raw) as { client_email: string; private_key: string };
    const token = await gscAccessToken(sa.client_email, sa.private_key);
    if (!token) return { connected: false };

    // Fenêtre décalée de 2 jours : la Search Console publie avec ~2 j de latence.
    const cur = { startDate: day(8), endDate: day(2) };
    const prev = { startDate: day(15), endDate: day(9) };

    const [webC, webP, discC, discP, newsC, newsP, queries, pagesWeb, pagesDisc] =
      await Promise.all([
        gscQuery(token, { ...cur, type: "web" }),
        gscQuery(token, { ...prev, type: "web" }),
        gscQuery(token, { ...cur, type: "discover" }),
        gscQuery(token, { ...prev, type: "discover" }),
        gscQuery(token, { ...cur, type: "news" }),
        gscQuery(token, { ...prev, type: "news" }),
        gscQuery(token, { ...cur, type: "web", dimensions: ["query"], rowLimit: 10 }),
        gscQuery(token, { ...cur, type: "web", dimensions: ["page"], rowLimit: 10 }),
        gscQuery(token, { ...cur, type: "discover", dimensions: ["page"], rowLimit: 10 }),
      ]);

    const pages = [
      ...(pagesWeb?.rows ?? []).map((r) => ({ page: r.keys?.[0] ?? "", clicks: r.clicks, impressions: r.impressions, type: "search" })),
      ...(pagesDisc?.rows ?? []).map((r) => ({ page: r.keys?.[0] ?? "", clicks: r.clicks, impressions: r.impressions, type: "discover" })),
    ]
      .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
      .slice(0, 12);

    return {
      connected: true,
      data: {
        window: { start: cur.startDate, end: cur.endDate },
        totals: {
          web: { current: firstRow(webC), previous: firstRow(webP) },
          discover: { current: firstRow(discC), previous: firstRow(discP) },
          news: { current: firstRow(newsC), previous: firstRow(newsP) },
        },
        top_queries: (queries?.rows ?? []).map((r) => ({
          query: r.keys?.[0] ?? "",
          clicks: r.clicks,
          impressions: r.impressions,
        })),
        top_pages: pages,
      },
    };
  } catch {
    return { connected: false };
  }
}

// ---- Bing Webmaster -------------------------------------------------------
// BING_WEBMASTER_API_KEY : Bing WMT → Settings → API access → API key.
export type BingData = {
  clicks_7d: number;
  impressions_7d: number;
  clicks_prev7: number;
  impressions_prev7: number;
};

export async function fetchBing(): Promise<{ connected: boolean; data?: BingData }> {
  const key = process.env.BING_WEBMASTER_API_KEY;
  if (!key) return { connected: false };
  try {
    const res = await fetch(
      `https://ssl.bing.com/webmaster/api.svc/json/GetRankAndTrafficStats?siteUrl=${encodeURIComponent(
        "https://kanari.io/"
      )}&apikey=${encodeURIComponent(key)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return { connected: false };
    const j = (await res.json()) as { d?: { Date: string; Impressions: number; Clicks: number }[] };
    const rows = (j.d ?? [])
      .map((r) => ({
        t: parseInt(r.Date.replace(/\D/g, ""), 10),
        impressions: r.Impressions,
        clicks: r.Clicks,
      }))
      .sort((a, b) => a.t - b.t);
    const last7 = rows.slice(-7);
    const prev7 = rows.slice(-14, -7);
    const sum = (arr: typeof rows, k: "clicks" | "impressions") =>
      arr.reduce((s, r) => s + (r[k] || 0), 0);
    return {
      connected: true,
      data: {
        clicks_7d: sum(last7, "clicks"),
        impressions_7d: sum(last7, "impressions"),
        clicks_prev7: sum(prev7, "clicks"),
        impressions_prev7: sum(prev7, "impressions"),
      },
    };
  } catch {
    return { connected: false };
  }
}

// ---- Backlinks ------------------------------------------------------------
export async function fetchBacklinksRpc(): Promise<unknown | null> {
  const sb = supabaseCreds();
  if (!sb) return null;
  try {
    const res = await fetch(`${sb.url}/rest/v1/rpc/veille_backlinks`, {
      method: "POST",
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
        "content-type": "application/json",
      },
      body: "{}",
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Liens entrants vus par l'index Bing : GetLinkCounts (pages cibles) puis
// GetUrlLinks (sources) sur les premières cibles. Données lentes à se
// peupler sur un site récent — l'UI l'explique.
export type BingLinks = {
  targets: { url: string; count: number }[];
  sources: { target: string; url: string }[];
  total: number;
};

export async function fetchBingLinks(): Promise<{ connected: boolean; data?: BingLinks }> {
  const key = process.env.BING_WEBMASTER_API_KEY;
  if (!key) return { connected: false };
  const base = "https://ssl.bing.com/webmaster/api.svc/json";
  const site = encodeURIComponent("https://kanari.io/");
  try {
    const targets: { url: string; count: number }[] = [];
    for (let page = 0; page < 3; page++) {
      const res = await fetch(`${base}/GetLinkCounts?siteUrl=${site}&page=${page}&apikey=${encodeURIComponent(key)}`, {
        cache: "no-store",
      });
      if (!res.ok) break;
      const j = (await res.json()) as { d?: { Links?: { Count: number; Url: string }[]; TotalPages?: number } };
      for (const l of j.d?.Links ?? []) targets.push({ url: l.Url, count: l.Count });
      if (page + 1 >= (j.d?.TotalPages ?? 1)) break;
    }
    targets.sort((a, b) => b.count - a.count);

    const sources: { target: string; url: string }[] = [];
    for (const t of targets.slice(0, 5)) {
      try {
        const res = await fetch(
          `${base}/GetUrlLinks?siteUrl=${site}&link=${encodeURIComponent(t.url)}&page=0&apikey=${encodeURIComponent(key)}`,
          { cache: "no-store" }
        );
        if (!res.ok) continue;
        const j = (await res.json()) as { d?: { Links?: { Url: string }[] } };
        for (const l of (j.d?.Links ?? []).slice(0, 10)) sources.push({ target: t.url, url: l.Url });
      } catch {
        /* source suivante */
      }
    }
    return {
      connected: true,
      data: { targets: targets.slice(0, 20), sources, total: targets.reduce((s, t) => s + t.count, 0) },
    };
  } catch {
    return { connected: false };
  }
}

// ---- Panel de citations IA ------------------------------------------------
// Chaque semaine, on pose les mêmes questions à un moteur IA avec recherche
// web et on note si kanari est cité dans les sources (« share of voice »).
export const CITATION_QUESTIONS: string[] = [
  "Combien de feux de forêt sont en cours dans le monde aujourd'hui ?",
  "Combien de départs de feu ont été détectés aujourd'hui en France ?",
  "Quelle est la meilleure carte des feux de forêt en temps réel ?",
  "Comment suivre les Canadair en direct ?",
  "Où voir la position des bombardiers d'eau en ce moment ?",
  "Y a-t-il un feu de forêt en Gironde en ce moment ?",
  "Quel site permet de repérer les départs de feu avant les médias ?",
  "Où trouver des données ouvertes sur les départs de feux de forêt ?",
  "Comment savoir s'il y a un incendie près de chez moi ?",
  "Quel a été le bilan des feux de forêt hier dans le monde ?",
  "What is the best live wildfire map right now?",
  "How many wildfires are burning in the world today?",
  "How can I track firefighting aircraft live?",
  "Is there a wildfire in Greece right now?",
  "Where can I download open data on wildfire ignitions?",
];

export function isoWeek(d = new Date()): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

type CitationRow = {
  week: string;
  engine: string;
  question: string;
  cited: boolean;
  position: number | null;
  sources: string[];
};

async function askWithSearch(question: string): Promise<CitationRow | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.CITATIONS_MODEL || "gpt-5.4-mini",
        input: question,
        tools: [{ type: "web_search" }],
        max_output_tokens: 1200,
      }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      output?: {
        type: string;
        content?: { type: string; text?: string; annotations?: { type: string; url?: string }[] }[];
      }[];
    };
    let text = "";
    const urls: string[] = [];
    for (const item of j.output ?? []) {
      if (item.type !== "message") continue;
      for (const c of item.content ?? []) {
        if (c.text) text += c.text;
        for (const a of c.annotations ?? []) {
          if (a.type === "url_citation" && a.url) urls.push(a.url);
        }
      }
    }
    const hosts: string[] = [];
    for (const u of urls) {
      try {
        const h = new URL(u).hostname.replace(/^www\./, "");
        if (!hosts.includes(h)) hosts.push(h);
      } catch {
        /* url invalide */
      }
    }
    const idx = hosts.indexOf("kanari.io");
    const citedByLink = idx >= 0;
    const citedByText = /\bkanari\b/i.test(text);
    return {
      week: isoWeek(),
      engine: "chatgpt-search",
      question,
      cited: citedByLink || citedByText,
      position: citedByLink ? idx + 1 : null,
      sources: hosts.slice(0, 10),
    };
  } catch {
    return null;
  }
}

// Lance le panel complet et stocke les résultats. Appelé par le cron (garde
// hebdomadaire) ou à la main via /api/cron/citations.
export async function runCitationsPanel(): Promise<{ asked: number; stored: number; cited: number }> {
  const sb = supabaseCreds();
  if (!sb) return { asked: 0, stored: 0, cited: 0 };
  const results = await Promise.all(CITATION_QUESTIONS.map((q) => askWithSearch(q)));
  const rows = results.filter((r): r is CitationRow => r !== null);
  if (rows.length > 0) {
    try {
      await fetch(`${sb.url}/rest/v1/ai_citations`, {
        method: "POST",
        headers: {
          apikey: sb.key,
          Authorization: `Bearer ${sb.key}`,
          "content-type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify(rows),
      });
    } catch {
      /* stockage raté : le prochain run reprendra */
    }
  }
  return {
    asked: CITATION_QUESTIONS.length,
    stored: rows.length,
    cited: rows.filter((r) => r.cited).length,
  };
}

// Le panel est-il dû ? (aucun run depuis 6,5 jours)
export async function citationsDue(): Promise<boolean> {
  const sb = supabaseCreds();
  if (!sb) return false;
  try {
    const res = await fetch(`${sb.url}/rest/v1/ai_citations?select=ts&order=ts.desc&limit=1`, {
      headers: { apikey: sb.key, Authorization: `Bearer ${sb.key}` },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const rows = (await res.json()) as { ts: string }[];
    if (rows.length === 0) return true;
    return Date.now() - new Date(rows[0].ts).getTime() > 6.5 * 86400_000;
  } catch {
    return false;
  }
}
