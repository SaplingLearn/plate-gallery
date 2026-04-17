import { clsx } from 'clsx'

export function Divider({ className }: { className?: string }) {
  return <hr className={clsx('border-t border-border my-12', className)} />
}
