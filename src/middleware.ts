import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { FRANCOPHONE, HISPANOPHONE, LUSOPHONE, isValidLang, type Lang } from "@/lib/i18n";

// Crawlers SEO + IA qu'on veut compter (onglet Visibilité de /veille).
// ChatGPT-User / Perplexity-User / Claude-User = fetchs déclenchés par une
// question d'utilisateur en direct : kanari consulté pour bâtir une réponse.
// L'ordre compte (GoogleOther avant Googlebot).
const TRACKED_BOTS: [RegExp, string][] = [
  [/OAI-SearchBot/i, "OAI-SearchBot"],
  [/ChatGPT-User/i, "ChatGPT-User"],
  [/GPTBot/i, "GPTBot"],
  [/Claude-SearchBot/i, "Claude-SearchBot"],
  [/Claude-User/i, "Claude-User"],
  [/ClaudeBot|anthropic-ai/i, "ClaudeBot"],
  [/Perplexity-User/i, "Perplexity-User"],
  [/PerplexityBot/i, "PerplexityBot"],
  [/Amazonbot/i, "Amazonbot"],
  [/Applebot/i, "Applebot"],
  [/Bytespider/i, "Bytespider"],
  [/meta-externalagent|FacebookBot/i, "Meta"],
  [/cohere/i, "Cohere"],
  [/MistralAI/i, "MistralAI"],
  [/GoogleOther/i, "GoogleOther"],
  [/Googlebot/i, "Googlebot"],
  [/bingbot/i, "Bingbot"],
  [/DuckDuckBot/i, "DuckDuckBot"],
  [/YandexBot/i, "YandexBot"],
];

// Insertion fire-and-forget (waitUntil : ne retarde jamais la réponse au bot).
function logBotHit(req: NextRequest, event: NextFetchEvent): void {
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua) return;
  const hit = TRACKED_BOTS.find(([re]) => re.test(ua));
  if (!hit) return;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;
  event.waitUntil(
    fetch(`${url.replace(/\/$/, "")}/rest/v1/bot_hits`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "content-type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ bot: hit[1], path: req.nextUrl.pathname.slice(0, 300) }),
    }).catch(() => {})
  );
}

// Choix de langue : 1) préférence explicite (cookie posé par le sélecteur),
// 2) pays du visiteur (géo Vercel) — français, espagnol ou portugais selon la
// zone linguistique, anglais ailleurs, 3) Accept-Language, 4) anglais.
function detectLang(req: NextRequest): Lang {
  const cookie = req.cookies.get("kanari-lang")?.value;
  if (isValidLang(cookie)) return cookie;
  const country = req.headers.get("x-vercel-ip-country")?.toUpperCase();
  const region = req.headers.get("x-vercel-ip-country-region")?.toUpperCase();
  if (country) {
    if (FRANCOPHONE.has(country) || (country === "CA" && region === "QC")) return "fr";
    if (HISPANOPHONE.has(country)) return "es";
    if (LUSOPHONE.has(country)) return "pt";
    return "en";
  }
  const accept = req.headers.get("accept-language") ?? "";
  if (/(^|[,;])\s*fr/i.test(accept)) return "fr";
  if (/(^|[,;])\s*es/i.test(accept)) return "es";
  if (/(^|[,;])\s*pt/i.test(accept)) return "pt";
  return "en";
}

export function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname, search } = req.nextUrl;
  logBotHit(req, event);

  // Espace de veille : non localisé, jamais préfixé par la langue.
  if (pathname === "/veille" || pathname.startsWith("/veille/")) {
    return NextResponse.next();
  }

  // Déjà préfixé (/fr, /en) : on laisse passer. Le cookie géo n'est posé que
  // sur la home (seule page où il est critique : centrage initial de la
  // carte). Le poser partout rendait CHAQUE réponse porteuse d'un Set-Cookie,
  // donc non cacheable par le CDN : aucune page servie en HIT, TTFB de
  // fonction sur tout le site et budget de crawl gaspillé (constat du
  // 26/08/2026, en pleine reconquête bingbot). Dégradation assumée : un
  // visiteur qui atterrit directement sur une page interne n'a pas le cookie,
  // EmergencyButton retombe sur le numéro par défaut de la langue jusqu'à son
  // premier passage par la home.
  const seg = pathname.split("/")[1];
  if (isValidLang(seg)) {
    if (pathname === `/${seg}`) {
      const res = NextResponse.next();
      attachGeo(req, res);
      return res;
    }
    return NextResponse.next();
  }

  // Racine ou chemin non préfixé : redirection vers la langue détectée en
  // conservant la query (liens profonds des notifications : /?lat&lon&ev…).
  const lang = detectLang(req);
  const url = req.nextUrl.clone();
  url.pathname = `/${lang}${pathname === "/" ? "" : pathname}`;
  url.search = search;
  const res = NextResponse.redirect(url, 307);
  attachGeo(req, res);
  return res;
}

function attachGeo(req: NextRequest, res: NextResponse): void {
  const lat = req.headers.get("x-vercel-ip-latitude");
  const lon = req.headers.get("x-vercel-ip-longitude");
  const country = req.headers.get("x-vercel-ip-country") ?? "";
  if (!lat || !lon) return;
  const value = `${lat},${lon},${country}`;
  // Cookie déjà à jour : ne pas le reposer — une réponse sans Set-Cookie
  // reste cacheable par le CDN.
  if (req.cookies.get("kanari-geo")?.value === value) return;
  res.cookies.set("kanari-geo", value, {
    path: "/",
    maxAge: 3600,
    sameSite: "lax",
  });
}

export const config = {
  // Tout sauf les API, les assets Next, les fichiers statiques et les routes
  // de métadonnées (manifest, icônes, sitemap, robots…).
  matcher: [
    "/((?!api|veille|google|opendata|embed|fx|ogfire|ogbilan|ogobs|_next|sw\\.js|brand|icon|apple-icon|favicon|manifest|sitemap|robots|llms|og\\.png|.*\\.(?:png|svg|ico|txt|webmanifest|xml|json)).*)",
  ],
};
