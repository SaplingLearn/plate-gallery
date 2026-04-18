import type { CSSProperties, ReactNode } from 'react'

export function Pill({
  children,
  bg,
  fg,
  border = true,
  size = 'md',
}: {
  children: ReactNode
  bg?: string
  fg?: string
  border?: boolean
  size?: 'sm' | 'md'
}) {
  const h = size === 'sm' ? 22 : 28
  const p = size === 'sm' ? '0 8px' : '0 12px'
  const fs = size === 'sm' ? 10 : 12
  const style: CSSProperties = {
    height: h,
    padding: p,
    fontSize: fs,
    background: bg ?? 'var(--color-paper)',
    color: fg ?? 'var(--color-ink)',
    border: border ? '1.5px solid var(--color-rule)' : 'none',
    letterSpacing: 0.3,
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full font-sans font-extrabold uppercase whitespace-nowrap"
      style={style}
    >
      {children}
    </span>
  )
}
