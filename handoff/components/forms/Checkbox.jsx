import React from 'react';

export function Checkbox({ label, checked, onChange, style }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 15, ...style }}>
      <span style={{
        width: 22, height: 22, borderRadius: 7, flexShrink: 0,
        background: checked ? 'var(--canary)' : 'var(--white)',
        border: checked ? '1px solid var(--canary-strong)' : '1px solid var(--line)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background var(--duration-fast) var(--ease-out)',
      }}>
        {checked && <svg width="12" height="12" viewBox="0 0 12 12"><path d="M2,6.5 L4.8,9 L10,3" fill="none" stroke="var(--charcoal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange && onChange(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: 0 }} />
      {label}
    </label>
  );
}
