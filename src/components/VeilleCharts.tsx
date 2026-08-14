"use client";

import { useCallback, useMemo, useRef, useState } from "react";

// Briques de dashboard interactives partagées par les onglets de /veille :
// courbe avec tooltip au survol + comparaison période précédente (le combo
// signature de Plausible/Fathom), sélecteur de période, deltas colorés.

const nf = new Intl.NumberFormat("fr-FR");
export const fmtN = (n: number | undefined | null) => nf.format(n ?? 0);

// ---- Delta coloré ▲▼ ------------------------------------------------------
export function Delta({ cur, prev, invert = false }: { cur: number; prev: number; invert?: boolean }) {
  if (prev === 0 && cur === 0) return <span style={{ color: "var(--ink-3)", fontSize: 12 }}>—</span>;
  if (prev === 0) return <span style={{ color: "#3aa76d", fontSize: 12, fontWeight: 700 }}>nouveau</span>;
  const pct = Math.round(((cur - prev) / prev) * 100);
  const up = pct >= 0;
  const good = invert ? !up : up;
  return (
    <span style={{ color: pct === 0 ? "var(--ink-3)" : good ? "#3aa76d" : "#D64545", fontSize: 12, fontWeight: 700 }}>
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

// ---- Sélecteur de période -------------------------------------------------
export function PeriodChips<T extends number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: T[];
}) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          style={{
            background: value === o ? "var(--canary)" : "transparent",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius-pill)",
            padding: "3px 11px",
            fontSize: 12,
            fontWeight: 700,
            color: value === o ? "var(--charcoal, #1B1C1E)" : "var(--ink-3)",
            cursor: "pointer",
            fontFamily: "var(--font-body)",
          }}
        >
          {o} j
        </button>
      ))}
    </div>
  );
}

// ---- Courbe interactive ---------------------------------------------------
// Barres (série principale) + trait (série secondaire) + pointillés
// (période précédente) + crosshair et tooltip au survol.
export type ChartPoint = {
  label: string; // ex. "2026-08-06" ou "14 h"
  main: number;
  secondary?: number;
  compare?: number; // valeur équivalente de la période précédente
};

export function HoverChart({
  data,
  mainLabel,
  secondaryLabel,
  compareLabel,
  height = 190,
  color = "var(--canary-soft)",
  lineColor = "var(--ember)",
  onSelect,
}: {
  data: ChartPoint[];
  mainLabel: string;
  secondaryLabel?: string;
  compareLabel?: string;
  height?: number;
  color?: string;
  lineColor?: string;
  // Clic sur une barre : drill-down (l'index renvoyé est celui de `data`).
  onSelect?: (index: number) => void;
}) {
  const W = 720;
  const H = height;
  const P = 10;
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(1, ...data.map((d) => Math.max(d.main, d.secondary ?? 0, d.compare ?? 0)));
  const n = data.length;
  const bw = n > 0 ? (W - P * 2) / n : 0;
  const x = useCallback((i: number) => P + i * bw, [bw]);
  const y = useCallback((v: number) => H - P - (v / max) * (H - P * 2), [H, max]);

  const line = useMemo(
    () => data.map((d, i) => `${x(i) + bw / 2},${y(d.secondary ?? 0)}`).join(" "),
    [data, x, y, bw]
  );
  const compare = useMemo(
    () => data.map((d, i) => `${x(i) + bw / 2},${y(d.compare ?? 0)}`).join(" "),
    [data, x, y, bw]
  );
  const hasSecondary = data.some((d) => d.secondary !== undefined);
  const hasCompare = data.some((d) => d.compare !== undefined);

  // Index calculé depuis l'événement (pas depuis l'état hover) : un clic
  // direct sans survol préalable doit fonctionner du premier coup.
  function idxFromEvent(e: React.MouseEvent): number | null {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || n === 0) return null;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    return Math.min(n - 1, Math.max(0, Math.floor((px - P) / bw)));
  }
  function onMove(e: React.MouseEvent) {
    setHover(idxFromEvent(e));
  }

  const h = hover !== null ? data[hover] : null;
  const tooltipLeft = hover !== null ? Math.min(78, Math.max(0, ((x(hover) + bw / 2) / W) * 100)) : 0;

  return (
    <div
      ref={ref}
      style={{ position: "relative", cursor: onSelect ? "pointer" : "default" }}
      onMouseMove={onMove}
      onMouseLeave={() => setHover(null)}
      onClick={(e) => {
        const i = idxFromEvent(e);
        if (onSelect && i !== null) onSelect(i);
      }}
      title={onSelect ? "Cliquer pour voir le détail du jour" : undefined}
    >
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} preserveAspectRatio="none">
        {/* Lignes de niveau discrètes */}
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={P} x2={W - P} y1={y(max * f)} y2={y(max * f)} stroke="var(--line)" strokeWidth={1} strokeDasharray="2 5" />
        ))}
        {data.map((d, i) => (
          <rect
            key={i}
            x={x(i) + 1}
            y={y(d.main)}
            width={Math.max(1, bw - 2)}
            height={Math.max(0, H - P - y(d.main))}
            rx={2}
            fill={hover === i ? "var(--canary-strong)" : color}
          />
        ))}
        {hasCompare && <polyline points={compare} fill="none" stroke="var(--ink-3)" strokeWidth={1.6} strokeDasharray="4 4" strokeLinejoin="round" />}
        {hasSecondary && <polyline points={line} fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {hover !== null && (
          <line x1={x(hover) + bw / 2} x2={x(hover) + bw / 2} y1={P} y2={H - P} stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="3 3" />
        )}
      </svg>
      {h && (
        <div
          style={{
            position: "absolute",
            top: 4,
            left: `${tooltipLeft}%`,
            background: "var(--charcoal, #1B1C1E)",
            color: "#FBF9F4",
            borderRadius: 10,
            padding: "7px 11px",
            fontSize: 12,
            lineHeight: 1.5,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            boxShadow: "var(--shadow-m)",
            zIndex: 5,
          }}
        >
          <div style={{ fontWeight: 700 }}>{h.label}</div>
          <div>
            <span style={{ color: "var(--canary)" }}>▊</span> {mainLabel} : <strong>{fmtN(h.main)}</strong>
          </div>
          {h.secondary !== undefined && secondaryLabel && (
            <div>
              <span style={{ color: "#F0997B" }}>—</span> {secondaryLabel} : <strong>{fmtN(h.secondary)}</strong>
            </div>
          )}
          {h.compare !== undefined && compareLabel && (
            <div style={{ opacity: 0.75 }}>
              ┈ {compareLabel} : {fmtN(h.compare)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Sparkline ------------------------------------------------------------
// Mini-courbe d'évolution (aire + trait) pour les cartes KPI de l'onglet
// Tendances : lecture immédiate de la dynamique, pas d'axes ni de tooltip.
export function Sparkline({
  values,
  color = "var(--ember)",
  height = 36,
}: {
  values: number[];
  color?: string;
  height?: number;
}) {
  const W = 200;
  const H = height;
  const P = 3;
  const n = values.length;
  if (n < 2) return <div style={{ height: H }} />;
  const max = Math.max(1, ...values);
  const x = (i: number) => P + (i / (n - 1)) * (W - P * 2);
  const y = (v: number) => H - P - (v / max) * (H - P * 2);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const area = `${x(0)},${H - P} ${pts} ${x(n - 1)},${H - P}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }} preserveAspectRatio="none">
      <polygon points={area} fill={color} opacity={0.12} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(n - 1)} cy={y(values[n - 1])} r={2.6} fill={color} />
    </svg>
  );
}

// ---- Carte KPI de tendance ------------------------------------------------
// Valeur + delta vs période précédente + sparkline 30 j : le « coup d'œil »
// demandé pour chaque indicateur.
export function TrendCard({
  label,
  value,
  sub,
  cur,
  prev,
  invert = false,
  series,
  color = "var(--ember)",
}: {
  label: string;
  value: string;
  sub?: string;
  cur?: number;
  prev?: number;
  invert?: boolean;
  series: number[];
  color?: string;
}) {
  return (
    <div
      style={{
        background: "var(--surface-card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius-l)",
        padding: "16px 16px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div style={{ color: "var(--ink-3)", fontSize: 11.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".4px" }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 600, color: "var(--ink)", lineHeight: 1.1 }}>
          {value}
        </span>
        {cur !== undefined && prev !== undefined && <Delta cur={cur} prev={prev} invert={invert} />}
      </div>
      {sub && <div style={{ color: "var(--ink-3)", fontSize: 12 }}>{sub}</div>}
      <div style={{ marginTop: 6 }}>
        <Sparkline values={series} color={color} />
      </div>
    </div>
  );
}

// ---- Courbes multi-séries -------------------------------------------------
// Plusieurs traits sur le même graphe (canaux d'acquisition, bots IA vs
// moteurs…), avec légende, crosshair et tooltip trié par valeur.
export function MultiLine({
  labels,
  series,
  height = 220,
  onSelect,
}: {
  labels: string[];
  series: { name: string; color: string; values: number[]; dash?: boolean }[];
  height?: number;
  onSelect?: (index: number) => void;
}) {
  const W = 720;
  const H = height;
  const P = 12;
  const ref = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const n = labels.length;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const x = useCallback((i: number) => (n > 1 ? P + (i / (n - 1)) * (W - P * 2) : W / 2), [n]);
  const y = useCallback((v: number) => H - P - (v / max) * (H - P * 2), [H, max]);

  // Même logique que HoverChart : l'index vient de l'événement pour que le
  // clic fonctionne sans survol préalable.
  function idxFromEvent(e: React.MouseEvent): number | null {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || n === 0) return null;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    return Math.min(n - 1, Math.max(0, Math.round(((px - P) / (W - P * 2)) * (n - 1))));
  }
  function onMove(e: React.MouseEvent) {
    setHover(idxFromEvent(e));
  }

  const tooltipLeft = hover !== null ? Math.min(72, Math.max(0, (x(hover) / W) * 100)) : 0;
  const hovered = hover !== null
    ? series
        .map((s) => ({ name: s.name, color: s.color, v: s.values[hover] ?? 0 }))
        .sort((a, b) => b.v - a.v)
    : [];

  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        {series.map((s) => (
          <span key={s.name} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--ink-2)" }}>
            <span style={{ width: 14, height: 3, borderRadius: 2, background: s.color, display: "inline-block" }} />
            {s.name}
          </span>
        ))}
      </div>
      <div
        ref={ref}
        style={{ position: "relative", cursor: onSelect ? "pointer" : "default" }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const i = idxFromEvent(e);
          if (onSelect && i !== null) onSelect(i);
        }}
        title={onSelect ? "Cliquer pour voir le détail du jour" : undefined}
      >
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} preserveAspectRatio="none">
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={P} x2={W - P} y1={y(max * f)} y2={y(max * f)} stroke="var(--line)" strokeWidth={1} strokeDasharray="2 5" />
          ))}
          {series.map((s) => (
            <polyline
              key={s.name}
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeDasharray={s.dash ? "5 4" : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {hover !== null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={P} y2={H - P} stroke="var(--ink-3)" strokeWidth={1} strokeDasharray="3 3" />
              {series.map((s) => (
                <circle key={s.name} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={3.2} fill={s.color} />
              ))}
            </>
          )}
        </svg>
        {hover !== null && (
          <div
            style={{
              position: "absolute",
              top: 4,
              left: `${tooltipLeft}%`,
              background: "var(--charcoal, #1B1C1E)",
              color: "#FBF9F4",
              borderRadius: 10,
              padding: "7px 11px",
              fontSize: 12,
              lineHeight: 1.5,
              pointerEvents: "none",
              whiteSpace: "nowrap",
              boxShadow: "var(--shadow-m)",
              zIndex: 5,
            }}
          >
            <div style={{ fontWeight: 700 }}>{labels[hover]}</div>
            {hovered.map((s) => (
              <div key={s.name}>
                <span style={{ color: s.color }}>—</span> {s.name} : <strong>{fmtN(s.v)}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Liste à barres de proportion (avec % et survol) ----------------------
export function ShareList({
  title,
  rows,
  right,
  emptyText = "Aucune donnée pour l'instant",
  maxRows = 12,
}: {
  title: string;
  rows: { key: string; label: React.ReactNode; value: number; sub?: string }[];
  right?: React.ReactNode;
  emptyText?: string;
  maxRows?: number;
}) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  const max = Math.max(1, ...rows.map((r) => r.value));
  const [hovered, setHovered] = useState<string | null>(null);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--ink)", margin: 0 }}>{title}</h3>
        {right}
      </div>
      {rows.length === 0 && <div style={{ color: "var(--ink-3)", fontSize: 13, marginTop: 12, fontStyle: "italic" }}>{emptyText}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 12 }}>
        {rows.slice(0, maxRows).map((r) => (
          <div
            key={r.key}
            onMouseEnter={() => setHovered(r.key)}
            onMouseLeave={() => setHovered(null)}
            style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center", cursor: "default" }}
          >
            <div style={{ position: "relative", minWidth: 0 }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  width: `${(r.value / max) * 100}%`,
                  background: hovered === r.key ? "var(--canary-soft)" : "var(--canary-tint)",
                  borderRadius: 6,
                  transition: "background .12s",
                }}
              />
              <div style={{ position: "relative", padding: "5px 9px", fontSize: 13, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {r.label}
                {r.sub && <span style={{ color: "var(--ink-3)", fontSize: 11.5 }}> · {r.sub}</span>}
              </div>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums", minWidth: 34, textAlign: "right" }}>
              {total > 0 ? `${Math.round((r.value / total) * 100)}%` : ""}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-2)", fontVariantNumeric: "tabular-nums", minWidth: 40, textAlign: "right" }}>
              {fmtN(r.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
