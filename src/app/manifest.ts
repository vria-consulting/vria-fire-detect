import type { MetadataRoute } from "next";

// PWA : Kanari installable sur l'écran d'accueil (Android/desktop).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "kanari — l'alerte feu de forêt, avant tout le monde",
    short_name: "kanari",
    description:
      "Le canari chante avant la sirène : départs de feu détectés par satellite et témoignages citoyens, en temps quasi réel.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#FBF9F4",
    theme_color: "#FBF9F4",
    categories: ["weather", "news", "utilities"],
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // Icône « maskable » : Android la rogne en cercle/squircle — le logo
      // vit dans la zone sûre centrale sur fond de marque plein cadre.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
