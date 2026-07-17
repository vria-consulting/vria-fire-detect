import React from 'react';

export function Toast({ title, children, onClose, style }) {
  return (
    <div role="status" style={{
      background: 'var(--charcoal)', color: 'var(--paper)', borderRadius: 'var(--radius-m)',
      padding: '14px 18px', boxShadow: 'var(--shadow-l)', maxWidth: 380,
      fontFamily: 'var(--font-body)', display: 'flex', gap: 12, alignItems: 'flex-start', ...style,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--canary)', marginTop: 6, flexShrink: 0, animation: 'kanari-wave 1.8s ease-out infinite' }}></span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {title && <strong style={{ fontSize: 15 }}>{title}</strong>}
        <span style={{ fontSize: 14, opacity: 0.75 }}>{children}</span>
      </div>
      {onClose && <button onClick={onClose} aria-label="Fermer" style={{ background: 'none', border: 'none', color: 'var(--paper)', opacity: 0.6, cursor: 'pointer', fontSize: 16, padding: 0 }}>✕</button>}
    </div>
  );
}
