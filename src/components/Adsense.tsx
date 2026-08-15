"use client";

import Script from "next/script";

// Chargeur AdSense (Auto ads) : inclus UNIQUEMENT sur les pages de contenu
// froid (guides, observatoire, comparatif, bilans). Jamais sur la carte, les
// alertes ou les pages consultées en situation d'urgence — principe du
// playbook : on ne monétise pas la sécurité.
const CLIENT = "ca-pub-9521453937448688";

export function Adsense() {
  return (
    <Script
      id="adsense-loader"
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
