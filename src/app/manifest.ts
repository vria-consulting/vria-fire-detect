import type { MetadataRoute } from "next";

// PWA : Kanari installable sur l'écran d'accueil (Android/desktop).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kanari — détection précoce des feux de forêt",
    short_name: "Kanari",
    description:
      "Le canari qui chante avant tout le monde : départs de feu détectés par satellite et témoignages citoyens, en temps quasi réel.",
    start_url: "/",
    display: "standalone",
    background_color: "#1B1C1E",
    theme_color: "#1B1C1E",
    icons: [
      { src: "/icon.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
