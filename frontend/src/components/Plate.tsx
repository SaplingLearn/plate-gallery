interface PlateStyle {
  bg: string
  txt: string
  top: string
  topC: string
  sub: string
  subC: string
  gradient?: boolean
  gradC?: string
}

const PLATE_STYLES: Record<string, PlateStyle> = {
  CA: { bg: '#fffdf5', txt: '#c2232c', top: 'California', topC: '#d08432', sub: 'dmv.ca.gov', subC: '#9a9181', gradient: true },
  NY: { bg: '#e9d7a3', txt: '#1a4a8a', top: 'New York', topC: '#1a4a8a', sub: 'empire state', subC: '#1a4a8a' },
  TX: { bg: '#fffdf5', txt: '#0f0d09', top: 'TEXAS', topC: '#0f0d09', sub: 'The Lone Star State', subC: '#0f0d09' },
  FL: { bg: '#fffdf5', txt: '#0f0d09', top: 'Sunshine State', topC: '#e6b245', sub: 'FLORIDA', subC: '#c24a20', gradient: true, gradC: '#ffe4a8' },
  MA: { bg: '#fbf6ea', txt: '#c24a20', top: 'Spirit of America', topC: '#5a5246', sub: 'MASSACHUSETTS', subC: '#c24a20' },
  IL: { bg: '#fffdf5', txt: '#1e3a8a', top: 'ILLINOIS', topC: '#c2232c', sub: 'Land of Lincoln', subC: '#1e3a8a' },
  WA: { bg: '#e9e4d4', txt: '#1e3a8a', top: 'WASHINGTON', topC: '#1e3a8a', sub: 'Evergreen State', subC: '#636b3a' },
  CO: { bg: '#1d5a3a', txt: '#fffdf5', top: 'COLORADO', topC: '#fffdf5', sub: 'mountains', subC: '#e6d7a3' },
  AZ: { bg: '#f2cf7b', txt: '#8f3414', top: 'ARIZONA', topC: '#8f3414', sub: 'Grand Canyon State', subC: '#8f3414', gradient: true, gradC: '#e6b245' },
  VT: { bg: '#2d5a3d', txt: '#fffdf5', top: 'Vermont', topC: '#fffdf5', sub: 'green mountains', subC: '#c5d4a8' },
  OR: { bg: '#fbf6ea', txt: '#1d5a3a', top: 'OREGON', topC: '#1d5a3a', sub: 'Pacific Wonderland', subC: '#1d5a3a' },
  HI: { bg: '#fffdf5', txt: '#b6233d', top: 'Aloha State', topC: '#b6233d', sub: 'HAWAII', subC: '#b6233d' },
  AK: { bg: '#fffdf5', txt: '#1e3a8a', top: 'ALASKA', topC: '#e6b245', sub: 'The Last Frontier', subC: '#1e3a8a' },
  NV: { bg: '#d4d9c8', txt: '#1e3a8a', top: 'NEVADA', topC: '#c24a20', sub: 'Silver State', subC: '#1e3a8a' },
  DC: { bg: '#fffdf5', txt: '#1e3a8a', top: 'Taxation Without', topC: '#c2232c', sub: 'Representation', subC: '#c2232c' },
  OH: { bg: '#fffdf5', txt: '#c2232c', top: 'OHIO', topC: '#1e3a8a', sub: 'Birthplace of Aviation', subC: '#1e3a8a' },
  MI: { bg: '#fffdf5', txt: '#1e3a8a', top: 'MICHIGAN', topC: '#1e3a8a', sub: 'Pure Michigan', subC: '#1e3a8a' },
  GA: { bg: '#fffdf5', txt: '#1d5a3a', top: 'GEORGIA', topC: '#e6b245', sub: 'on my mind', subC: '#1d5a3a' },
  NC: { bg: '#fffdf5', txt: '#1e3a8a', top: 'First in Flight', topC: '#c2232c', sub: 'NORTH CAROLINA', subC: '#1e3a8a' },
}

const DEFAULT_STYLE: PlateStyle = { bg: '#fffdf5', txt: '#0f0d09', top: 'U.S.A.', topC: '#0f0d09', sub: '', subC: '#0f0d09' }

export function Plate({ text, state = 'US', width = 320, tilt = 0 }: { text: string; state?: string; width?: number; tilt?: number }) {
  const s = PLATE_STYLES[state] || DEFAULT_STYLE
  const h = width * 0.54
  const display = (text || '').toUpperCase().slice(0, 8)
  const fontSize = display.length <= 5 ? 72 : display.length <= 7 ? 62 : 52
  const gradId = `pg-${state}-${display}`

  return (
    <svg
      viewBox="0 0 320 172"
      width={width}
      height={h}
      style={{ transform: `rotate(${tilt}deg)`, display: 'block', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))' }}
    >
      <defs>
        {s.gradient && (
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={s.gradC || s.bg} />
            <stop offset="1" stopColor={s.bg} />
          </linearGradient>
        )}
      </defs>
      <rect x="2" y="2" width="316" height="168" rx="14" fill={s.gradient ? `url(#${gradId})` : s.bg} stroke="#0f0d09" strokeWidth="1.5" />
      <circle cx="24" cy="18" r="3" fill="#1d1a14" opacity="0.25" />
      <circle cx="296" cy="18" r="3" fill="#1d1a14" opacity="0.25" />
      <circle cx="24" cy="154" r="3" fill="#1d1a14" opacity="0.25" />
      <circle cx="296" cy="154" r="3" fill="#1d1a14" opacity="0.25" />
      <text x="160" y="30" textAnchor="middle" fontFamily="'Sofia Sans Extra Condensed', sans-serif" fontWeight="800" fontSize="18" fill={s.topC} letterSpacing="2">
        {s.top.toUpperCase()}
      </text>
      <text x="160" y="112" textAnchor="middle" fontFamily="'Sofia Sans Extra Condensed', sans-serif" fontWeight="900" fontSize={fontSize} fill={s.txt} letterSpacing="1">
        {display}
      </text>
      {s.sub && (
        <text x="160" y="148" textAnchor="middle" fontFamily="'Nunito', sans-serif" fontWeight="700" fontSize="11" fill={s.subC} letterSpacing="1.5">
          {s.sub.toUpperCase()}
        </text>
      )}
    </svg>
  )
}
