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
