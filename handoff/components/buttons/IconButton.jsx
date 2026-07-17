import React from 'react';

export function IconButton({ label, size = 44, dark, children, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      aria-label={label}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: dark ? (hover ? 'var(--charcoal-2)' : 'var(--charcoal)') : (hover ? 'var(--paper-2)' : 'transparent'),
        border: dark ? 'none' : '1px solid var(--line)',
        color: dark ? 'var(--paper)' : 'var(--ink)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        transition: 'background var(--duration-fast) var(--ease-out)', ...style,
      }}
      {...rest}
    >{children}</button>
  );
}
