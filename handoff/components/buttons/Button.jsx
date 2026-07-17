import React from 'react';

const sizes = { s: { h: 36, px: 16, fs: 14 }, m: { h: 44, px: 22, fs: 15 }, l: { h: 52, px: 28, fs: 16 } };
const variants = {
  primary: { bg: 'var(--canary)', color: 'var(--charcoal)', hover: 'var(--canary-strong)', border: 'none' },
  dark: { bg: 'var(--charcoal)', color: 'var(--paper)', hover: 'var(--charcoal-2)', border: 'none' },
  ghost: { bg: 'transparent', color: 'var(--ink)', hover: 'var(--paper-2)', border: '1px solid var(--line)' },
  alert: { bg: 'var(--ember)', color: '#fff', hover: '#D5551F', border: 'none' },
};

export function Button({ variant = 'primary', size = 'm', disabled, children, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  const v = variants[variant] || variants.primary;
  const s = sizes[size] || sizes.m;
  return (
    <button
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: s.h, padding: `0 ${s.px}px`, fontSize: s.fs,
        fontFamily: 'var(--font-body)', fontWeight: 500,
        background: hover && !disabled ? v.hover : v.bg, color: v.color, border: v.border,
        borderRadius: 'var(--radius-pill)', cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1, display: 'inline-flex', alignItems: 'center', gap: 8,
        transition: 'background var(--duration-fast) var(--ease-out), transform var(--duration-fast) var(--ease-out)',
        ...style,
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.98)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      {...rest}
    >{children}</button>
  );
}
