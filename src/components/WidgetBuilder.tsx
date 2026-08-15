"use client";

import { useMemo, useState } from "react";
import { DEPARTEMENTS } from "@/lib/departements";
import { COUNTRIES } from "@/lib/countries";
import { localize, type Lang } from "@/lib/i18n";

// Générateur de widget : une rédaction girondine repart avec une carte
// centrée sur la Gironde en 20 secondes — et kanari repart avec un backlink
// d'ancre riche. Tout est côté client, le snippet est du HTML pur.

const T = {
  fr: {
    zone: "Zone affichée",
    world: "Monde entier",
    france: "France entière",
    deptGroup: "Départements français",
    countryGroup: "Pays",
    lang: "Langue du widget",
    height: "Hauteur",
    preview: "Aperçu",
    code: "Le code à copier",
    copy: "Copier le code",
    copied: "Copié ✓",
    attribution:
      "Le lien d'attribution sous la carte fait partie des conditions d'utilisation : merci de le conserver tel quel.",
    anchorText: "carte des feux de forêt en temps réel",
    caption: "Carte :",
  },
  en: {
    zone: "Displayed area",
    world: "Whole world",
    france: "France",
    deptGroup: "French departments",
    countryGroup: "Countries",
    lang: "Widget language",
    height: "Height",
    preview: "Preview",
    code: "Code to copy",
    copy: "Copy the code",
    copied: "Copied ✓",
    attribution:
      "The attribution link below the map is part of the terms of use: please keep it as is.",
    anchorText: "live wildfire map",
    caption: "Map:",
  },
} as const;

const WIDGET_LANGS: { value: Lang; label: string }[] = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "pt", label: "Português" },
];

type Zone = { id: string; label: string; lat?: number; lon?: number; z?: number };

export function WidgetBuilder({ lang }: { lang: Lang }) {
  const t = localize(T, lang);
  const [zoneId, setZoneId] = useState(lang === "fr" ? "france" : "world");
  const [wlang, setWlang] = useState<Lang>(lang);
  const [height, setHeight] = useState(480);
  const [copied, setCopied] = useState(false);

  const zones: { group: string; items: Zone[] }[] = useMemo(
    () => [
      {
        group: "",
        items: [
          { id: "world", label: t.world },
          { id: "france", label: t.france, lat: 46.6, lon: 2.4, z: 5.2 },
        ],
      },
      {
        group: t.countryGroup,
        items: COUNTRIES.map((c) => ({
          id: `c-${c.slug}`,
          label: c.name.replace(/^the /, ""),
          lat: c.lat,
          lon: c.lon,
          z: c.zoom,
        })),
      },
      {
        group: t.deptGroup,
        items: DEPARTEMENTS.map((d) => ({
          id: `d-${d.slug}`,
          label: `${d.name} (${d.code})`,
          lat: d.lat,
          lon: d.lon,
          z: 8.3,
        })),
      },
    ],
    [t]
  );

  const zone = zones.flatMap((g) => g.items).find((z) => z.id === zoneId) ?? zones[0].items[0];

  const src = useMemo(() => {
    const p = new URLSearchParams();
    if (wlang !== "fr") p.set("lang", wlang);
    if (zone.lat !== undefined && zone.lon !== undefined) {
      p.set("lat", String(zone.lat));
      p.set("lon", String(zone.lon));
      p.set("z", String(zone.z ?? 6));
    }
    const qs = p.toString();
    return `https://kanari.io/embed${qs ? `?${qs}` : ""}`;
  }, [wlang, zone]);

  const snippet = useMemo(() => {
    const anchor = localize(T, wlang);
    return `<iframe
  src="${src}"
  width="100%" height="${height}" frameborder="0"
  title="kanari.io"
  loading="lazy" allow="geolocation"></iframe>
<p>${anchor.caption} <a href="https://kanari.io/${wlang}">kanari.io — ${anchor.anchorText}</a></p>`;
  }, [src, height, wlang]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponible : la sélection manuelle reste possible */
    }
  };

  const selectStyle: React.CSSProperties = {
    background: "var(--white)",
    border: "1px solid var(--line)",
    borderRadius: 10,
    padding: "8px 10px",
    fontSize: 13.5,
    color: "var(--ink)",
    fontFamily: "var(--font-body)",
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[12px] font-semibold" style={{ color: "var(--ink-3)" }}>
          {t.zone}
          <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} style={selectStyle}>
            {zones.map((g) =>
              g.group === "" ? (
                g.items.map((z) => (
                  <option key={z.id} value={z.id}>{z.label}</option>
                ))
              ) : (
                <optgroup key={g.group} label={g.group}>
                  {g.items.map((z) => (
                    <option key={z.id} value={z.id}>{z.label}</option>
                  ))}
                </optgroup>
              )
            )}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold" style={{ color: "var(--ink-3)" }}>
          {t.lang}
          <select value={wlang} onChange={(e) => setWlang(e.target.value as Lang)} style={selectStyle}>
            {WIDGET_LANGS.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-semibold" style={{ color: "var(--ink-3)" }}>
          {t.height}
          <select value={height} onChange={(e) => setHeight(Number(e.target.value))} style={selectStyle}>
            {[380, 480, 600].map((h) => (
              <option key={h} value={h}>{h} px</option>
            ))}
          </select>
        </label>
      </div>

      <h2 className="mb-2 text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
        {t.preview}
      </h2>
      <div className="mb-6 overflow-hidden rounded-[18px]" style={{ boxShadow: "var(--shadow-m)" }}>
        <iframe key={src} src={src} width="100%" height={Math.min(height, 420)} title="kanari widget" style={{ border: 0, display: "block" }} />
      </div>

      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-[19px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
          {t.code}
        </h2>
        <button
          onClick={copy}
          className="rounded-full px-4 py-1.5 text-[13px] font-semibold"
          style={{ background: copied ? "#3aa76d" : "var(--canary)", color: copied ? "#fff" : "var(--charcoal)" }}
        >
          {copied ? t.copied : t.copy}
        </button>
      </div>
      <pre
        className="mb-3 overflow-x-auto rounded-[14px] p-4 text-[12.5px] leading-relaxed"
        style={{ background: "var(--charcoal, #1B1C1E)", color: "#FBF9F4" }}
      >
        {snippet}
      </pre>
      <p className="text-[12.5px]" style={{ color: "var(--ink-3)" }}>{t.attribution}</p>
    </div>
  );
}
