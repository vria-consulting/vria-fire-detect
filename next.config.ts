import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Retire le bouton de débogage Next.js (rond « N ») en développement.
  devIndicators: false,
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
