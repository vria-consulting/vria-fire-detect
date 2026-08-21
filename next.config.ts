import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Retire le bouton de débogage Next.js (rond « N ») en développement.
  devIndicators: false,
  // h5wasm charge son .wasm depuis node_modules à l'exécution : il doit
  // rester un require Node natif, pas passer par le bundler, ET son .wasm
  // doit être explicitement embarqué dans les fonctions (le tracing ne suit
  // pas la résolution new URL(import.meta.url) du loader wasm).
  serverExternalPackages: ["h5wasm"],
  // Trois formes de clé pour couvrir les variantes de matching des routes
  // selon les versions (route exacte, wildcard simple, glob).
  outputFileTracingIncludes: {
    "*": ["./node_modules/h5wasm/dist/node/**"],
    "/**": ["./node_modules/h5wasm/dist/node/**"],
    "/api/events": ["./node_modules/h5wasm/dist/node/**"],
    "/api/cron/check": ["./node_modules/h5wasm/dist/node/**"],
    "/api/goes-debug": ["./node_modules/h5wasm/dist/node/**"],
  },
  // Un seul hôte canonique : kanari.io. Sans ces redirections, www.kanari.io et
  // le domaine technique Vercel servaient le site à l'identique (3 copies) ;
  // Bing avait indexé des pages sous www, absentes des sitemaps et d'IndexNow
  // (« important pages missing in sitemaps »), et diluait le ranking de l'apex.
  // 308 permanent : les moteurs consolident sur kanari.io.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.kanari.io" }],
        destination: "https://kanari.io/:path*",
        permanent: true,
      },
      {
        // Tout sauf /api : le cron GitHub Actions appelle /api/cron/check sur
        // ce domaine, et une API ne doit jamais répondre par une redirection.
        source: "/:path((?!api(?:/|$)).*)",
        has: [{ type: "host", value: "vria-fire-detect.vercel.app" }],
        destination: "https://kanari.io/:path",
        permanent: true,
      },
    ];
  },
  // Les visuels publics (og.png, images de partage) sont réutilisables par
  // des sites tiers (annuaires, portails open data) : CORS ouvert en lecture.
  // Idem pour l'API publique documentée sur /fr/api (events, signals, CSV, RSS).
  async headers() {
    const cors = [{ key: "Access-Control-Allow-Origin", value: "*" }];
    return [
      {
        source: "/(og\\.png|ogfire/.*|ogbilan/.*)",
        headers: cors,
      },
      {
        source: "/(api/events|api/signals|opendata/.*|feed\\.xml)",
        headers: cors,
      },
    ];
  },
};

export default nextConfig;
