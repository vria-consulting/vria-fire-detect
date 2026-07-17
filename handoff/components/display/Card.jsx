import React from 'react';

export function Card({ interactive, padding = 24, children, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--surface-card)', borderRadius: 'var(--radius-l)', padding,
        boxShadow: interactive && hover ? 'var(--shadow-l)' : 'var(--shadow-s)',
        transform: interactive && hover ? 'translateY(-2px)' : 'none',
        cursor: interactive ? 'pointer' : 'default',
        transition: 'box-shadow var(--duration-base) var(--ease-out), transform var(--duration-base) var(--ease-out)',
        fontFamily: 'var(--font-body)', ...style,
      }}
      {...rest}
    >{children}</div>
  );
}
