import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Retire le bouton de débogage Next.js (rond « N ») en développement.
  devIndicators: false,
  // Les visuels publics (og.png, images de partage) sont réutilisables par
  // des sites tiers (annuaires, portails open data) : CORS ouvert en lecture.
  async headers() {
    return [
      {
        source: "/(og\\.png|ogfire/.*|ogbilan/.*)",
        headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
      },
    ];
  },
};

export default nextConfig;
