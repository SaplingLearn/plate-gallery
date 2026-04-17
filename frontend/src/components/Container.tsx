import { clsx } from 'clsx'
import type { ReactNode } from 'react'

export function Container({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx('mx-auto w-full max-w-7xl px-6 md:px-12', className)}>
      {children}
    </div>
  )
}
