"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

// Beacon d'audience : envoie une visite à /api/track à chaque page.
// Cookieless. Le referer et les UTM ne sont joints qu'au 1er chargement de la
// page (vraie provenance) ; les navigations internes ne les renvoient pas.
export function Tracker() {
  const pathname = usePathname();
  const firstLoad = useRef(true);

  useEffect(() => {
    const landing = firstLoad.current;
    firstLoad.current = false;

    const qs = new URLSearchParams(window.location.search);
    const payload: Record<string, unknown> = {
      path: window.location.pathname,
      lang: document.documentElement.lang || undefined,
      screen_w: window.screen?.width,
      screen_h: window.screen?.height,
    };
    if (landing) {
      payload.referrer = document.referrer || "";
      payload.utm_source = qs.get("utm_source") || "";
      payload.utm_medium = qs.get("utm_medium") || "";
      payload.utm_campaign = qs.get("utm_campaign") || "";
      // On mémorise la provenance « premier contact » de la session, pour
      // pouvoir l'attribuer à une contribution même après navigation interne.
      try {
        if (!sessionStorage.getItem("kanari_src")) {
          sessionStorage.setItem(
            "kanari_src",
            JSON.stringify({
              referrer: payload.referrer,
              utm_source: payload.utm_source,
              utm_medium: payload.utm_medium,
              utm_campaign: payload.utm_campaign,
            })
          );
        }
      } catch {
        /* sessionStorage indisponible : sans conséquence */
      }
    }

    try {
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", body);
      } else {
        fetch("/api/track", { method: "POST", body, keepalive: true });
      }
    } catch {
      /* une visite perdue n'a aucune importance */
    }
  }, [pathname]);

  return null;
}
