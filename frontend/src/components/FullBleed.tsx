import { clsx } from 'clsx'
import type { ReactNode } from 'react'

export function FullBleed({
  children,
  className,
  backgroundImage,
  overlay = false,
}: {
  children: ReactNode
  className?: string
  backgroundImage?: string
  overlay?: boolean
}) {
  return (
    <section
      className={clsx('relative w-full', className)}
      style={backgroundImage ? {
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : undefined}
    >
      {overlay && (
        <div className="absolute inset-0 bg-charcoal/40" />
      )}
      <div className="relative z-10">{children}</div>
    </section>
  )
}
