import React from 'react';

export function Switch({ label, checked, onChange, style }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 12, cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 15, ...style }}>
      <span
        role="switch" aria-checked={!!checked}
        onClick={() => onChange && onChange(!checked)}
        style={{
          width: 48, height: 28, borderRadius: 999, position: 'relative', flexShrink: 0,
          background: checked ? 'var(--canary)' : 'var(--line)',
          transition: 'background var(--duration-base) var(--ease-out)',
        }}>
        <span style={{
          position: 'absolute', top: 3, left: checked ? 23 : 3, width: 22, height: 22, borderRadius: '50%',
          background: checked ? 'var(--charcoal)' : 'var(--white)', boxShadow: 'var(--shadow-s)',
          transition: 'left var(--duration-base) var(--ease-out), background var(--duration-base) var(--ease-out)',
        }}></span>
      </span>
      {label}
    </label>
  );
}
