import React from 'react';

const tones = {
  info: { bg: 'var(--canary-tint)', border: 'var(--canary)', title: 'var(--ink)' },
  alert: { bg: 'var(--ember-soft)', border: 'var(--ember)', title: '#9C3B12' },
  danger: { bg: 'var(--danger-soft)', border: 'var(--danger)', title: '#9C2B2B' },
  safe: { bg: 'var(--safe-soft)', border: 'var(--safe)', title: '#1F6644' },
};

export function Alert({ tone = 'info', title, meta, action, children, style }) {
  const t = tones[tone] || tones.info;
  return (
    <div role={tone === 'danger' || tone === 'alert' ? 'alert' : 'status'} style={{
      background: t.bg, border: `1.5px solid ${t.border}`, borderRadius: 'var(--radius-l)',
      padding: '18px 22px', fontFamily: 'var(--font-body)', display: 'flex', flexDirection: 'column', gap: 6, ...style,
    }}>
      {title && <strong style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, color: t.title }}>{title}</strong>}
      <div style={{ fontSize: 15, color: 'var(--ink)', lineHeight: 1.55 }}>{children}</div>
      {meta && <span style={{ fontSize: 13, color: 'var(--ink-2)' }}>{meta}</span>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}
