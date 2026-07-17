import React from 'react';

export function Input({ label, hint, error, style, inputStyle, ...rest }) {
  const [focus, setFocus] = React.useState(false);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-body)', ...style }}>
      {label && <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{label}</span>}
      <input
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{
          height: 48, padding: '0 16px', fontSize: 16, fontFamily: 'var(--font-body)',
          background: 'var(--white)', color: 'var(--ink)',
          border: `1px solid ${error ? 'var(--danger)' : focus ? 'var(--canary-strong)' : 'var(--line)'}`,
          borderRadius: 'var(--radius-m)', outline: 'none',
          boxShadow: focus ? 'var(--focus-ring)' : 'none',
          transition: 'box-shadow var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out)',
          ...inputStyle,
        }}
        {...rest}
      />
      {(error || hint) && <span style={{ fontSize: 12, color: error ? 'var(--danger)' : 'var(--ink-3)' }}>{error || hint}</span>}
    </label>
  );
}
