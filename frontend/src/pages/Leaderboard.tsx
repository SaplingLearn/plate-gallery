import { useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { Container } from '@/components/Container'
import { Eyebrow } from '@/components/Eyebrow'
import { RevealOnScroll } from '@/components/RevealOnScroll'
import { useLeaderboard } from '@/hooks/useApi'

const WINDOWS = [
  { value: 'all', label: 'All-time' },
  { value: 'month', label: 'This month' },
  { value: 'week', label: 'This week' },
  { value: 'day', label: 'Today' },
]

export default function Leaderboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const window = searchParams.get('window') || 'all'
  const { data, isLoading } = useLeaderboard(window, 50)
  const plates = data?.items ?? []

  const top3 = plates.slice(0, 3)
  const rest = plates.slice(3)

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
          <h1 className="mt-4 font-display text-4xl text-charcoal md:text-5xl">
            Leaderboard
          </h1>
        </RevealOnScroll>

        {/* Time window tabs */}
        <div className="mt-8 flex gap-1 border-b border-border">
          {WINDOWS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => {
                const next = new URLSearchParams(searchParams)
                next.set('window', value)
                setSearchParams(next, { replace: true })
              }}
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

        {isLoading ? (
          <div className="mt-16 text-center">
            <p className="font-sans text-sm text-stone">Loading...</p>
          </div>
        ) : plates.length === 0 ? (
          <div className="mt-16 text-center">
            <h2 className="font-display text-2xl text-charcoal">No plates ranked yet.</h2>
            <p className="mt-2 text-sm text-stone">Upload and vote to fill the leaderboard.</p>
          </div>
        ) : (
          <>
            {/* Podium — top 3 */}
            <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
              {top3.map((plate, i) => (
                <RevealOnScroll key={plate.id} delay={i * 0.1}>
                  <Link to={`/plate/${plate.id}`} className="group block text-center">
                    <div className="overflow-hidden rounded-sm">
                      <img
                        src={plate.image_thumb_url || plate.image_url}
                        alt={`Vanity plate reading '${plate.plate_text}' from ${plate.state_name}`}
                        className="aspect-[4/5] w-full object-cover transition-transform duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
                      />
                    </div>
                    <p className="mt-4 font-display text-5xl text-charcoal">{plate.score}</p>
                    <h3 className="mt-2 font-display text-xl text-charcoal">
                      {plate.plate_text}
                    </h3>
                    <Eyebrow className="mt-1">{plate.state_name}</Eyebrow>
                  </Link>
                </RevealOnScroll>
              ))}
            </div>

            {/* Ranks 4-50 */}
            {rest.length > 0 && (
              <div className="mt-16">
                {rest.map((plate, i) => (
                  <RevealOnScroll key={plate.id} delay={(i % 5) * 0.03}>
                    <Link
                      to={`/plate/${plate.id}`}
                      className="flex items-center gap-6 border-b border-border py-4 transition-colors hover:bg-cream/50"
                    >
                      <span className="w-8 text-right font-display text-lg text-stone/50">
                        {i + 4}
                      </span>
                      <img
                        src={plate.image_thumb_url || plate.image_url}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-sm object-cover"
                      />
                      <div className="flex-1">
                        <span className="font-display text-lg text-charcoal">{plate.plate_text}</span>
                        <span className="ml-3 text-xs text-stone">{plate.state_code}</span>
                      </div>
                      <span className="font-display text-lg tabular-nums text-charcoal">
                        {plate.score}
                      </span>
                    </Link>
                  </RevealOnScroll>
                ))}
              </div>
            )}
          </>
        )}
      </Container>
    </motion.main>
  )
}
