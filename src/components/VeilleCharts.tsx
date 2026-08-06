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
}: {
  data: ChartPoint[];
  mainLabel: string;
  secondaryLabel?: string;
  compareLabel?: string;
  height?: number;
  color?: string;
  lineColor?: string;
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

  function onMove(e: React.MouseEvent) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || n === 0) return;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.min(n - 1, Math.max(0, Math.floor((px - P) / bw)));
    setHover(i);
  }

  const h = hover !== null ? data[hover] : null;
  const tooltipLeft = hover !== null ? Math.min(78, Math.max(0, ((x(hover) + bw / 2) / W) * 100)) : 0;

  return (
    <div ref={ref} style={{ position: "relative" }} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
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
