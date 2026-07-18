"use client";

import { useEffect, useState } from "react";
import { DICT, emergencyNumber, type Lang } from "@/lib/i18n";

// Bouton d'urgence géolocalisé : 911 aux États-Unis/Canada, 999 au
// Royaume-Uni, 000 en Australie, 112 en Europe… Le pays vient du cookie
// kanari-geo (géo Vercel, posé par le middleware). Rendu SSR = repli par
// langue, corrigé après montage pour éviter tout mismatch d'hydratation.
export function EmergencyButton({ lang }: { lang: Lang }) {
  const t = DICT[lang];
  const [number, setNumber] = useState(() => emergencyNumber(null, lang));

  useEffect(() => {
    try {
      const raw = document.cookie.match(/(?:^|;\s*)kanari-geo=([^;]+)/)?.[1];
      const country = raw ? decodeURIComponent(raw).split(",")[2] || null : null;
      setNumber(emergencyNumber(country, lang));
    } catch {
      /* cookie illisible : repli par langue déjà en place */
    }
  }, [lang]);

  return (
    <a
      href={`tel:${number}`}
      className="flex h-[38px] items-center gap-2 rounded-full px-[18px] text-sm font-medium text-white transition-colors"
      style={{ background: "var(--ember)" }}
    >
      {/* Combiné téléphonique (trait rond, charte Lucide). */}
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
      {t.emergency(number)}
    </a>
  );
}
