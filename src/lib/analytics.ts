// Veille d'audience kanari — helpers partagés (serveur uniquement).
// Cookieless / RGPD : on ne stocke jamais l'IP, seulement un hash quotidien salé
// (visiteurs uniques sans cookie, méthode Plausible). Toutes les écritures
// passent par la clé service_role, jamais exposée au navigateur.

import { createHash } from "crypto";

// L'unique adresse autorisée à accéder au dashboard de veille. Codée en dur :
// le lien magique ne part JAMAIS ailleurs, même si l'URL secrète est découverte.
export const ADMIN_EMAIL = "vryckbosch@gmail.com";

export function supabaseCreds(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

// ---- Détection de robots (on ne pollue pas les stats) --------------------
const BOT_RE =
  /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora|pinterest|vkshare|whatsapp|telegrambot|discordbot|preview|monitor|lighthouse|headless|pingdom|uptime|curl|wget|python-requests|axios|node-fetch|go-http|dataprovider|semrush|ahrefs|mj12|dotbot/i;

export function isBot(ua: string): boolean {
  return !ua || BOT_RE.test(ua);
}

// ---- Analyse (légère, sans dépendance) du User-Agent ---------------------
export function parseUA(ua: string): { device: string; browser: string; os: string } {
  const u = ua || "";
  // Appareil
  let device = "desktop";
  if (/\b(iPad|Tablet)\b|Android(?!.*Mobile)/i.test(u)) device = "tablet";
  else if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/i.test(u)) device = "mobile";
  // Navigateur (ordre important : Edge/Opera avant Chrome, Chrome avant Safari)
  let browser = "Autre";
  if (/Edg[eA]?\//i.test(u)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(u)) browser = "Opera";
  else if (/SamsungBrowser/i.test(u)) browser = "Samsung";
  else if (/Firefox\/|FxiOS/i.test(u)) browser = "Firefox";
  else if (/Chrome\/|CriOS/i.test(u)) browser = "Chrome";
  else if (/Safari\//i.test(u)) browser = "Safari";
  // OS
  let os = "Autre";
  if (/iPhone|iPad|iPod|iOS|CriOS|FxiOS/i.test(u)) os = "iOS";
  else if (/Android/i.test(u)) os = "Android";
  else if (/Windows/i.test(u)) os = "Windows";
  else if (/Mac OS X|Macintosh/i.test(u)) os = "macOS";
  else if (/Linux|X11/i.test(u)) os = "Linux";
  return { device, browser, os };
}

// ---- Géolocalisation via les en-têtes Vercel (aucune requête externe) -----
export function geoFromHeaders(h: Headers): { country: string; region: string; city: string } {
  const dec = (v: string | null) => {
    if (!v) return "";
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  return {
    country: (h.get("x-vercel-ip-country") || "").toUpperCase().slice(0, 2),
    region: dec(h.get("x-vercel-ip-country-region")).slice(0, 60),
    city: dec(h.get("x-vercel-ip-city")).slice(0, 80),
  };
}

export function clientIp(h: Headers): string {
  return (h.get("x-forwarded-for")?.split(",")[0] || h.get("x-real-ip") || "").trim() || "?";
}

// ---- Empreinte visiteur anonyme (sans cookie) ----------------------------
// hash = sha256(IP + UA + sel-du-jour). Le sel change chaque jour : impossible
// de relier un visiteur d'un jour à l'autre, ni de retrouver l'IP.
function dailySalt(): string {
  const secret = process.env.SESSION_SECRET || "kanari-fallback-salt";
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
  return createHash("sha256").update(`${secret}::${day}`).digest("hex");
}

export function visitorHash(ip: string, ua: string): string {
  return createHash("sha256").update(`${ip}|${ua}|${dailySalt()}`).digest("hex").slice(0, 24);
}

// ---- Divers --------------------------------------------------------------
export function referrerHost(ref: string | undefined | null): string {
  if (!ref) return "";
  try {
    const h = new URL(ref).hostname.replace(/^www\./, "");
    // On ignore l'auto-référencement (navigation interne).
    if (/kanari\.io$/i.test(h) || /vria-fire-detect.*\.vercel\.app$/i.test(h)) return "";
    return h.slice(0, 120);
  } catch {
    return "";
  }
}

export type PageViewInsert = {
  path: string;
  referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  device: string;
  browser: string;
  os: string;
  lang: string | null;
  screen_w: number | null;
  screen_h: number | null;
  visitor_hash: string;
  is_bot: boolean;
};

// Insert d'une visite dans Supabase (service_role). Silencieux en cas d'échec :
// une visite perdue ne doit jamais casser le rendu du site.
export async function insertPageView(row: PageViewInsert): Promise<boolean> {
  const sb = supabaseCreds();
  if (!sb) return false;
  try {
    const res = await fetch(`${sb.url}/rest/v1/page_views`, {
      method: "POST",
      headers: {
        apikey: sb.key,
        Authorization: `Bearer ${sb.key}`,
        "content-type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify(row),
    });
    return res.ok;
  } catch {
    return false;
  }
}
