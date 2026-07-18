import { NextRequest, NextResponse } from "next/server";
import { FRANCOPHONE, isValidLang, type Lang } from "@/lib/i18n";

// Choix de langue : 1) préférence explicite (cookie posé par le sélecteur),
// 2) pays du visiteur (géo Vercel) — français en France/pays francophones et
// au Québec, anglais ailleurs, 3) Accept-Language, 4) anglais.
function detectLang(req: NextRequest): Lang {
  const cookie = req.cookies.get("kanari-lang")?.value;
  if (isValidLang(cookie)) return cookie;
  const country = req.headers.get("x-vercel-ip-country")?.toUpperCase();
  const region = req.headers.get("x-vercel-ip-country-region")?.toUpperCase();
  if (country) {
    if (FRANCOPHONE.has(country) || (country === "CA" && region === "QC")) return "fr";
    return "en";
  }
  const accept = req.headers.get("accept-language") ?? "";
  return /(^|[,;])\s*fr/i.test(accept) ? "fr" : "en";
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Déjà préfixé (/fr, /en) : on laisse passer, en mémorisant la position du
  // visiteur pour centrer la carte (cookie lisible côté client).
  const seg = pathname.split("/")[1];
  if (isValidLang(seg)) {
    const res = NextResponse.next();
    attachGeo(req, res);
    return res;
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
  if (lat && lon) {
    res.cookies.set("kanari-geo", `${lat},${lon},${country}`, {
      path: "/",
      maxAge: 3600,
      sameSite: "lax",
    });
  }
}

export const config = {
  // Tout sauf les API, les assets Next, les fichiers statiques et les routes
  // de métadonnées (manifest, icônes, sitemap, robots…).
  matcher: [
    "/((?!api|_next|sw\\.js|brand|icon|apple-icon|favicon|manifest|sitemap|robots|llms|og\\.png|.*\\.(?:png|svg|ico|txt|webmanifest|xml)).*)",
  ],
};
