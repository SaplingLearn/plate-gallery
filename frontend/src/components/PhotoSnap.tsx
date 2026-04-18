import { useId } from 'react'
import { Plate } from './Plate'

type CarColor = 'red' | 'navy' | 'black' | 'silver' | 'white' | 'tan' | 'forest' | 'cream'
type Sky = 'daylight' | 'golden' | 'dusk' | 'overcast' | 'night'

const CAR_COLORS: Record<CarColor, [string, string]> = {
  red: ['#7c1d1d', '#b32d2d'],
  navy: ['#1a2a4a', '#2e4878'],
  black: ['#1a1a1a', '#2e2e2e'],
  silver: ['#8a8a8a', '#b5b5b5'],
  white: ['#d8d2c4', '#efe9dc'],
  tan: ['#8b7a5a', '#b8a782'],
  forest: ['#2a3e2a', '#3e5c3e'],
  cream: ['#d4c49a', '#e8d8ae'],
}

const SKY_COLORS: Record<Sky, [string, string]> = {
  daylight: ['#a9c6e8', '#e8ddc4'],
  golden: ['#e6b245', '#c24a20'],
  dusk: ['#8a7ca8', '#e6a878'],
  overcast: ['#c4c8cc', '#a4a8ac'],
  night: ['#1a1f35', '#3a3f5a'],
}

function hashStr(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

const CAR_ORDER: CarColor[] = ['red', 'navy', 'black', 'silver', 'white', 'tan', 'forest', 'cream']
const SKY_ORDER: Sky[] = ['daylight', 'golden', 'dusk', 'overcast', 'night']

export function PhotoSnap({
  plate,
  state,
  width = 320,
  height,
  tilt = 0,
  carColor,
  time,
  imageUrl,
  alt,
}: {
  plate: string
  state: string
  width?: number
  height?: number
  tilt?: number
  carColor?: CarColor
  time?: Sky
  imageUrl?: string | null
  alt?: string
}) {
  const uid = useId().replace(/[:#]/g, '')
  const h = height || width * 0.75

  // If a real image is available, show it with the plate overlaid at bottom.
  if (imageUrl) {
    return (
      <div
        style={{ width, height: h, transform: `rotate(${tilt}deg)`, position: 'relative', overflow: 'hidden', background: '#000' }}
      >
        <img
          src={imageUrl}
          alt={alt ?? `Vanity plate ${plate}`}
          loading="lazy"
          decoding="async"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>
    )
  }

  const seed = hashStr(`${plate}-${state}`)
  const car = carColor ?? CAR_ORDER[seed % CAR_ORDER.length]
  const sky = time ?? SKY_ORDER[(seed >> 3) % SKY_ORDER.length]
  const [c1, c2] = CAR_COLORS[car]
  const [sky1, sky2] = SKY_COLORS[sky]

  return (
    <div style={{ width, height: h, transform: `rotate(${tilt}deg)`, position: 'relative', overflow: 'hidden', background: '#000' }}>
      <svg viewBox="0 0 400 300" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style={{ display: 'block' }}>
        <defs>
          <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={sky1} />
            <stop offset="1" stopColor={sky2} />
          </linearGradient>
          <linearGradient id={`${uid}-car`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c2} />
            <stop offset="0.5" stopColor={c1} />
            <stop offset="1" stopColor={c2} />
          </linearGradient>
          <radialGradient id={`${uid}-vignette`} cx="50%" cy="50%" r="70%">
            <stop offset="0.55" stopColor="rgba(0,0,0,0)" />
            <stop offset="1" stopColor="rgba(0,0,0,0.55)" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width="400" height="180" fill={`url(#${uid}-sky)`} />
        <rect x="0" y="180" width="400" height="120" fill="#2a2520" />
        <rect x="0" y="130" width="400" height="170" fill={`url(#${uid}-car)`} />
        <rect x="0" y="126" width="400" height="2" fill="rgba(0,0,0,0.4)" />
        <rect x="0" y="135" width="400" height="1" fill="rgba(255,255,255,0.1)" />
        <ellipse cx="80" cy="155" rx="60" ry="15" fill="rgba(255,255,255,0.15)" />
        <rect x="110" y="150" width="180" height="100" rx="4" fill="rgba(0,0,0,0.25)" />
        <rect x="0" y="0" width="400" height="300" fill={`url(#${uid}-vignette)`} />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '58%',
          transform: `translate(-50%, -50%) rotate(${tilt * 0.3}deg)`,
          width: '48%',
        }}
      >
        <Plate text={plate} state={state} width={width * 0.48} />
      </div>
    </div>
  )
}
