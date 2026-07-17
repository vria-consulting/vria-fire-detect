import React from 'react';

export function Tabs({ items = [], value, onChange, style }) {
  return (
    <div role="tablist" style={{ display: 'inline-flex', gap: 4, background: 'var(--paper-2)', borderRadius: 'var(--radius-pill)', padding: 4, fontFamily: 'var(--font-body)', ...style }}>
      {items.map((it) => {
        const active = it === value;
        return (
          <button key={it} role="tab" aria-selected={active} onClick={() => onChange && onChange(it)} style={{
            height: 36, padding: '0 18px', fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer',
            borderRadius: 'var(--radius-pill)',
            background: active ? 'var(--white)' : 'transparent',
            color: active ? 'var(--ink)' : 'var(--ink-2)',
            boxShadow: active ? 'var(--shadow-s)' : 'none',
            transition: 'background var(--duration-fast) var(--ease-out)',
          }}>{it}</button>
        );
      })}
    </div>
  );
}
