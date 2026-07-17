import React from 'react';

const tones = {
  canary: { bg: 'var(--canary-soft)', color: '#7A5A00', dot: 'var(--canary-strong)' },
  ember: { bg: 'var(--ember-soft)', color: '#9C3B12', dot: 'var(--ember)' },
  danger: { bg: 'var(--danger-soft)', color: '#9C2B2B', dot: 'var(--danger)' },
  safe: { bg: 'var(--safe-soft)', color: '#1F6644', dot: 'var(--safe)' },
  neutral: { bg: 'var(--paper-2)', color: 'var(--ink-2)', dot: 'var(--ink-3)' },
};

export function Badge({ tone = 'neutral', dot, pulse, children, style }) {
  const t = tones[tone] || tones.neutral;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, height: 26, padding: '0 12px',
      borderRadius: 'var(--radius-pill)', background: t.bg, color: t.color,
      fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500, ...style,
    }}>
      {dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.dot, animation: pulse ? 'kanari-wave 1.8s ease-out infinite' : 'none' }}></span>}
      {children}
    </span>
  );
}
