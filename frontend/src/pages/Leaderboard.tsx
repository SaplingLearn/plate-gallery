import { useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { Container } from '@/components/Container'
import { Eyebrow } from '@/components/Eyebrow'
import { RevealOnScroll } from '@/components/RevealOnScroll'
import { useLeaderboard, useStateLeaderboard } from '@/hooks/useApi'
import type { Plate } from '@/lib/types'

const WINDOWS = [
  { value: 'all', label: 'All-time' },
  { value: 'month', label: 'This month' },
  { value: 'week', label: 'This week' },
  { value: 'day', label: 'Today' },
]

const US_STATES = [
  ['AL', 'Alabama'], ['AK', 'Alaska'], ['AZ', 'Arizona'], ['AR', 'Arkansas'],
  ['CA', 'California'], ['CO', 'Colorado'], ['CT', 'Connecticut'], ['DE', 'Delaware'],
  ['FL', 'Florida'], ['GA', 'Georgia'], ['HI', 'Hawaii'], ['ID', 'Idaho'],
  ['IL', 'Illinois'], ['IN', 'Indiana'], ['IA', 'Iowa'], ['KS', 'Kansas'],
  ['KY', 'Kentucky'], ['LA', 'Louisiana'], ['ME', 'Maine'], ['MD', 'Maryland'],
  ['MA', 'Massachusetts'], ['MI', 'Michigan'], ['MN', 'Minnesota'], ['MS', 'Mississippi'],
  ['MO', 'Missouri'], ['MT', 'Montana'], ['NE', 'Nebraska'], ['NV', 'Nevada'],
  ['NH', 'New Hampshire'], ['NJ', 'New Jersey'], ['NM', 'New Mexico'], ['NY', 'New York'],
  ['NC', 'North Carolina'], ['ND', 'North Dakota'], ['OH', 'Ohio'], ['OK', 'Oklahoma'],
  ['OR', 'Oregon'], ['PA', 'Pennsylvania'], ['RI', 'Rhode Island'], ['SC', 'South Carolina'],
  ['SD', 'South Dakota'], ['TN', 'Tennessee'], ['TX', 'Texas'], ['UT', 'Utah'],
  ['VT', 'Vermont'], ['VA', 'Virginia'], ['WA', 'Washington'], ['WV', 'West Virginia'],
  ['WI', 'Wisconsin'], ['WY', 'Wyoming'],
] as const

function PlateImg({ plate }: { plate: Plate }) {
  return (
    <img
      src={plate.image_thumb_url || plate.image_url}
      alt={`Vanity plate reading '${plate.plate_text}' from ${plate.state_name}`}
      onError={(e) => { e.currentTarget.src = plate.image_url }}
      className="aspect-[4/5] w-full object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
    />
  )
}

function OverallLeaderboard({ window }: { window: string }) {
  const { data, isLoading } = useLeaderboard(window, 50)
  const plates = data?.items ?? []
  const top3 = plates.slice(0, 3)
  const rest = plates.slice(3)

  if (isLoading) {
    return <div className="mt-16 text-center"><p className="font-sans text-sm text-stone">Loading...</p></div>
  }

  if (plates.length === 0) {
    return (
      <div className="mt-16 text-center">
        <h2 className="font-display text-2xl text-charcoal">No plates ranked yet.</h2>
        <p className="mt-2 text-sm text-stone">Upload and vote to fill the leaderboard.</p>
      </div>
    )
  }

  return (
    <>
      <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
        {top3.map((plate, i) => (
          <RevealOnScroll key={plate.id} delay={i * 0.1}>
            <Link to={`/plate/${plate.id}`} className="group block text-center">
              <div className="overflow-hidden rounded-sm">
                <PlateImg plate={plate} />
              </div>
              <p className="mt-4 font-display text-5xl text-charcoal">{plate.score}</p>
              <h3 className="mt-2 font-display text-xl text-charcoal">{plate.plate_text}</h3>
              <Eyebrow className="mt-1">{plate.state_name}</Eyebrow>
            </Link>
          </RevealOnScroll>
        ))}
      </div>

      {rest.length > 0 && (
        <div className="mt-16">
          {rest.map((plate, i) => (
            <RevealOnScroll key={plate.id} delay={(i % 5) * 0.03}>
              <Link
                to={`/plate/${plate.id}`}
                className="flex items-center gap-6 border-b border-border py-4 transition-colors hover:bg-cream/50"
              >
                <span className="w-8 text-right font-display text-lg text-stone/50">{i + 4}</span>
                <img
                  src={plate.image_thumb_url || plate.image_url}
                  alt=""
                  onError={(e) => { e.currentTarget.src = plate.image_url }}
                  className="h-12 w-12 shrink-0 rounded-sm object-cover"
                />
                <div className="flex-1">
                  <span className="font-display text-lg text-charcoal">{plate.plate_text}</span>
                  <span className="ml-3 text-xs text-stone">{plate.state_code}</span>
                </div>
                <span className="font-display text-lg tabular-nums text-charcoal">{plate.score}</span>
              </Link>
            </RevealOnScroll>
          ))}
        </div>
      )}
    </>
  )
}

function StateLeaderboard({ stateCode, window }: { stateCode: string; window: string }) {
  const { data, isLoading } = useStateLeaderboard(stateCode, window)
  const plates = data?.items ?? []

  if (isLoading) {
    return <div className="mt-16 text-center"><p className="font-sans text-sm text-stone">Loading...</p></div>
  }

  if (plates.length === 0) {
    return (
      <div className="mt-16 text-center">
        <h2 className="font-display text-2xl text-charcoal">No ranked plates for this state.</h2>
        <p className="mt-2 text-sm text-stone">Be the first to upload a plate from here.</p>
      </div>
    )
  }

  return (
    <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {plates.map((plate, i) => (
        <RevealOnScroll key={plate.id} delay={i * 0.05}>
          <Link to={`/plate/${plate.id}`} className="group block text-center">
            <div className="overflow-hidden rounded-sm">
              <img
                src={plate.image_thumb_url || plate.image_url}
                alt={`Vanity plate reading '${plate.plate_text}'`}
                onError={(e) => { e.currentTarget.src = plate.image_url }}
                className="aspect-[4/5] w-full object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
              />
            </div>
            <p className="mt-3 font-display text-2xl text-charcoal">{plate.score}</p>
            <h3 className="mt-1 font-display text-base text-charcoal">{plate.plate_text}</h3>
            <span className="mt-0.5 block font-sans text-xs text-stone">#{i + 1}</span>
          </Link>
        </RevealOnScroll>
      ))}
    </div>
  )
}

export default function Leaderboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const window = searchParams.get('window') || 'all'
  const view = searchParams.get('view') || 'overall'
  const stateCode = searchParams.get('state') || 'CA'

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams)
    next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.3 }}
      className="pt-24 pb-16"
    >
      <Container>
        <RevealOnScroll>
          <Eyebrow>Rankings</Eyebrow>
          <h1 className="mt-4 font-display text-4xl text-charcoal md:text-5xl">Leaderboard</h1>
        </RevealOnScroll>

        {/* View toggle */}
        <div className="mt-8 flex gap-2">
          {(['overall', 'state'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setParam('view', v)}
              className={clsx(
                'rounded-sm px-4 py-2 font-sans text-sm transition-colors',
                view === v
                  ? 'bg-charcoal text-bone'
                  : 'border border-border text-stone hover:text-charcoal',
              )}
            >
              {v === 'overall' ? 'Overall' : 'By State'}
            </button>
          ))}
        </div>

        {/* Controls row */}
        <div className="mt-4 flex flex-wrap items-center gap-4 border-b border-border pb-0">
          {/* Time window tabs */}
          <div className="flex gap-1">
            {WINDOWS.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setParam('window', value)}
                className={clsx(
                  'border-b-2 px-4 py-3 font-sans text-sm transition-colors',
                  window === value
                    ? 'border-charcoal text-charcoal'
                    : 'border-transparent text-stone hover:text-charcoal',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* State selector (only for state view) */}
          {view === 'state' && (
            <select
              value={stateCode}
              onChange={(e) => setParam('state', e.target.value)}
              className="ml-auto rounded-sm border border-border bg-transparent px-3 py-2 font-sans text-sm text-charcoal outline-none focus:border-charcoal"
            >
              {US_STATES.map(([code, name]) => (
                <option key={code} value={code}>{name}</option>
              ))}
            </select>
          )}
        </div>

        {view === 'overall' ? (
          <OverallLeaderboard window={window} />
        ) : (
          <StateLeaderboard stateCode={stateCode} window={window} />
        )}
      </Container>
    </motion.main>
  )
}
