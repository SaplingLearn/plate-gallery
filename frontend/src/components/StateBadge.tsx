export function StateBadge({ code, size = 'md' }: { code: string; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 20 : 26
  const fs = size === 'sm' ? 10 : 13
  return (
    <span
      className="inline-flex items-center justify-center rounded bg-ink text-cream font-mono font-bold"
      style={{ height: h, minWidth: h * 1.4, padding: '0 7px', fontSize: fs, letterSpacing: 0.5 }}
    >
      {code}
    </span>
  )
}
