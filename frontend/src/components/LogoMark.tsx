export function LogoMark({ size = 42 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.54} viewBox="0 0 80 44" aria-hidden="true">
      <rect x="1" y="1" width="78" height="42" rx="6" fill="#fffdf7" stroke="#1d1a14" strokeWidth="1.5" />
      <circle cx="7" cy="7" r="1.5" fill="#1d1a14" opacity="0.4" />
      <circle cx="73" cy="7" r="1.5" fill="#1d1a14" opacity="0.4" />
      <circle cx="7" cy="37" r="1.5" fill="#1d1a14" opacity="0.4" />
      <circle cx="73" cy="37" r="1.5" fill="#1d1a14" opacity="0.4" />
      <text
        x="40"
        y="30"
        textAnchor="middle"
        fontFamily="'Sofia Sans Extra Condensed', sans-serif"
        fontWeight="900"
        fontSize="22"
        fill="#c24a20"
      >
        PG
      </text>
    </svg>
  )
}
