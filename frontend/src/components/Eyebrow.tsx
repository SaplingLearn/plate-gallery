import { clsx } from 'clsx'

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={clsx(
      'font-sans text-xs uppercase tracking-[0.2em] text-stone',
      className
    )}>
      {children}
    </span>
  )
}
