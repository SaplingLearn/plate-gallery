import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { useFeed, useMapSummary, useLeaderboard } from '@/hooks/useApi'
import { Plate } from '@/components/Plate'
import { StateBadge } from '@/components/StateBadge'
import { PlateCard } from '@/components/PlateCard'
import { US_STATES } from '@/lib/states'
import { useAuth } from '@/hooks/AuthContext'
import { useEffect, useRef, useCallback } from 'react'

const SORTS = [
  { k: 'top_week', label: 'Hot 🔥' },
  { k: 'recent', label: 'New' },
  { k: 'top_day', label: 'Top today' },
  { k: 'top_all', label: 'Top all-time' },
]

function FeedSideNav({
  currentState,
  onStateChange,
}: {
  currentState: string | null
  onStateChange: (code: string | null) => void
}) {
  const { user } = useAuth()
  const { data: mapSummary } = useMapSummary()
  const { data: weekBoard } = useLeaderboard('week')
  const topStates = [...(mapSummary?.states ?? [])]
    .filter((s) => s.plate_count > 0)
    .sort((a, b) => b.plate_count - a.plate_count)
    .slice(0, 6)
  const weekTop = (weekBoard?.items ?? []).slice(0, 3)

  return (
    <aside className="flex flex-col gap-5 border-r-[1.5px] border-rule p-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-ink-muted">
            FILTER BY STATE
          </div>
          {currentState && (
            <button
              type="button"
              onClick={() => onStateChange(null)}
              className="text-[10px] font-extrabold uppercase tracking-wide text-rust hover:underline"
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <motion.button
            type="button"
            onClick={() => onStateChange(null)}
            whileTap={{ scale: 0.94 }}
            className={clsx(
              'rounded-full border-[1.5px] border-rule px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide transition-colors',
              !currentState ? 'bg-ink text-cream' : 'bg-paper text-ink hover:bg-cream',
            )}
          >
            All states
          </motion.button>
          {topStates.map((s) => (
            <motion.button
              key={s.code}
              type="button"
              onClick={() => onStateChange(s.code)}
              whileTap={{ scale: 0.94 }}
              className={clsx(
                'flex items-center gap-1.5 rounded-full border-[1.5px] border-rule px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide transition-colors',
                currentState === s.code ? 'bg-ink text-cream' : 'bg-paper text-ink hover:bg-cream',
              )}
            >
              <StateBadge code={s.code} size="sm" />
              <span>{s.code}</span>
              <span className="font-mono text-[10px] opacity-70">{s.plate_count}</span>
            </motion.button>
          ))}
          {topStates.length === 0 && (
            <div className="text-[11px] font-semibold text-ink-muted">No plates uploaded yet.</div>
          )}
        </div>
      </div>

      <div>
        <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-ink-muted">
          TOP THIS WEEK
        </div>
        <div className="flex flex-col gap-1.5">
          {weekTop.map((p, i) => (
            <Link
              key={p.id}
              to={`/plate/${p.id}`}
              className="group flex items-center gap-2.5 rounded-lg border-[1.5px] border-rule bg-paper px-2.5 py-2 transition-transform hover:-translate-y-px"
            >
              <div
                className={clsx(
                  'font-display text-[18px] font-black leading-none tracking-tight',
                  i === 0 ? 'text-rust' : i === 1 ? 'text-cobalt' : 'text-mustard',
                )}
              >
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[14px] font-black tracking-tight text-ink">
                  "{p.plate_text}"
                </div>
                <div className="flex items-center gap-1 text-[10px] font-semibold text-ink-soft">
                  <span>▲ {p.score.toLocaleString()}</span>
                  <span className="opacity-60">·</span>
                  <span>{p.state_code}</span>
                </div>
              </div>
            </Link>
          ))}
          {weekTop.length === 0 && (
            <div className="text-[11px] font-semibold text-ink-muted">Nothing ranked yet this week.</div>
          )}
        </div>
      </div>

      <motion.div
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
        className="rounded-xl border-[1.5px] border-rule bg-mustard-lite p-4"
      >
        <div className="font-display text-[22px] font-black uppercase leading-[0.95] tracking-tight text-ink">
          SPOTTED<br />A PLATE?
        </div>
        <p className="mt-1.5 text-[12px] font-semibold leading-snug text-ink">
          Snap it and help map the country.
        </p>
        <Link
          to={user ? '/upload' : '/login?next=/upload'}
          className="mt-3 block rounded-full bg-ink py-2 text-center text-[12px] font-extrabold uppercase tracking-wide text-cream"
        >
          START AN UPLOAD →
        </Link>
      </motion.div>
    </aside>
  )
}

function FeedHero({ count }: { count: number }) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  return (
    <div
      className="relative flex items-center gap-5 overflow-hidden rounded-[18px] border-[1.5px] border-rule bg-ink p-6 text-cream"
      style={{ minHeight: 160 }}
    >
      <svg className="absolute inset-0 h-full w-full opacity-35" viewBox="0 0 900 160" preserveAspectRatio="none" aria-hidden="true">
        <g stroke="var(--color-mustard)" strokeWidth="6" strokeDasharray="40 40" fill="none">
          <line x1="0" y1="140" x2="900" y2="140" />
          <line x1="0" y1="150" x2="900" y2="150" />
        </g>
      </svg>
      <div className="relative flex-1">
        <div className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-[1.5px] text-mustard">
          YOUR FEED · {today.toUpperCase()}
        </div>
        <div className="font-display text-[52px] font-black uppercase leading-[0.9] tracking-tight">
          {count > 0 ? (
            <>{count} FRESH PLATES<br />FROM THE ROAD.</>
          ) : (
            <>NOTHING HERE YET.<br />GO POST ONE.</>
          )}
        </div>
      </div>
      <div className="relative z-10 hidden -rotate-6 md:block">
        <Plate text="HOWDY" state="TX" width={180} />
      </div>
    </div>
  )
}

function HotStates() {
  const { data } = useMapSummary()
  const states = data?.states ?? []
  const hot = [...states].sort((a, b) => b.plate_count - a.plate_count).slice(0, 4)

  return (
    <div
      className="rounded-[14px] border-[1.5px] border-rule bg-rust p-4 text-cream"
      style={{ boxShadow: '0 3px 0 var(--color-rule)' }}
    >
      <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-mustard">
        This week
      </div>
      <div className="font-display text-[28px] font-black uppercase leading-[0.95] tracking-tight">
        HOTTEST STATES
      </div>
      <div className="mt-3 grid gap-2.5">
        {hot.map((s, i) => (
          <Link
            key={s.code}
            to={`/states/${s.code}`}
            className="flex items-center gap-2 text-[13px] font-bold text-cream hover:text-mustard"
          >
            <span className="w-4 font-mono text-[11px] opacity-70">{String(i + 1).padStart(2, '0')}</span>
            <StateBadge code={s.code} size="sm" />
            <span className="flex-1">{s.name}</span>
            <span className="font-mono text-[11px] font-extrabold">+{s.plate_count}</span>
          </Link>
        ))}
        {hot.length === 0 && <p className="text-[12px] font-semibold opacity-80">Be the first to unlock a state.</p>}
      </div>
    </div>
  )
}

function PlateOfTheDay() {
  const { data } = useLeaderboard('week', 1)
  const top = data?.items?.[0]
  if (!top) return null
  return (
    <div className="mt-4">
      <div className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-ink-muted">
        Plate of the day
      </div>
      <Link
        to={`/plate/${top.id}`}
        className="block rounded-[14px] border-[1.5px] border-rule bg-paper p-3"
        style={{ boxShadow: '0 2px 0 var(--color-rule)' }}
      >
        <div className="flex justify-center">
          <Plate text={top.plate_text} state={top.state_code} width={232} />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <div className="font-display text-[22px] font-black leading-none tracking-tight text-ink">
            {top.score.toLocaleString()}
          </div>
          <div className="text-[11px] font-bold text-ink-soft">
            UPVOTES · {top.state_name.toUpperCase()}
          </div>
        </div>
      </Link>
    </div>
  )
}

function StatesUnlocked() {
  const { data } = useMapSummary()
  const states = data?.states ?? []
  const unlocked = states.filter((s) => s.plate_count > 0).length
  const total = 51
  const missing = Object.keys(US_STATES)
    .filter((code) => !(states.find((s) => s.code === code)?.plate_count))
    .slice(0, 10)

  return (
    <div className="mt-4">
      <div className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-ink-muted">
        50 + DC unlocked
      </div>
      <Link
        to="/states"
        className="block rounded-[14px] border-[1.5px] border-rule bg-paper p-3.5 text-center"
        style={{ boxShadow: '0 2px 0 var(--color-rule)' }}
      >
        <div className="font-display text-[44px] font-black leading-none text-cobalt">
          {unlocked} / {total}
        </div>
        <div className="mt-0.5 text-[12px] font-bold text-ink-soft">
          states with plates uploaded
        </div>
        <div className="mt-2.5 flex flex-wrap justify-center gap-0.5">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className={clsx(
                'h-2.5 w-2.5 rounded-sm',
                i < unlocked ? 'bg-rust' : 'bg-paper-edge',
              )}
            />
          ))}
        </div>
        {missing.length > 0 && (
          <div className="mt-3 text-[11px] font-bold text-ink-muted">
            Missing: {missing.join(', ')}
          </div>
        )}
      </Link>
    </div>
  )
}

function FeedRightRail() {
  return (
    <aside className="border-l-[1.5px] border-rule bg-cream p-5">
      <HotStates />
      <PlateOfTheDay />
      <StatesUnlocked />
    </aside>
  )
}

export default function Home() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sort = searchParams.get('sort') || 'top_week'
  const stateFilter = searchParams.get('state')
  const query = searchParams.get('q') || undefined
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useFeed({
    sort,
    state: stateFilter || undefined,
    q: query,
  })
  const plates = data?.pages.flatMap((p) => p.items) ?? []

  const sentinelRef = useRef<HTMLDivElement>(null)
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  )
  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, { rootMargin: '200px' })
    if (sentinelRef.current) observer.observe(sentinelRef.current)
    return () => observer.disconnect()
  }, [handleObserver])

  function setSort(k: string) {
    const next = new URLSearchParams(searchParams)
    next.set('sort', k)
    setSearchParams(next, { replace: true })
  }

  function setStateFilter(code: string | null) {
    const next = new URLSearchParams(searchParams)
    if (code) next.set('state', code)
    else next.delete('state')
    setSearchParams(next, { replace: true })
  }

  return (
    <motion.main
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.25 }}
      className="grid min-h-[calc(100vh-72px)] grid-cols-[220px_1fr_300px]"
    >
      <FeedSideNav currentState={stateFilter} onStateChange={setStateFilter} />
      <section className="overflow-hidden px-7 py-5">
        <FeedHero count={plates.length} />
        {query && (
          <div className="mt-4 flex items-center gap-3 rounded-xl border-[1.5px] border-rule bg-mustard-lite px-4 py-2.5">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-ink-muted">
              SEARCH RESULTS
            </span>
            <span className="font-display text-[16px] font-black text-ink">"{query}"</span>
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(searchParams)
                next.delete('q')
                setSearchParams(next, { replace: true })
              }}
              className="ml-auto text-[11px] font-extrabold uppercase tracking-wide text-rust hover:underline"
            >
              Clear
            </button>
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          {SORTS.map((s) => (
            <button
              key={s.k}
              type="button"
              onClick={() => setSort(s.k)}
              className={clsx(
                'rounded-full border-[1.5px] border-rule px-3.5 py-1.5 text-[13px] font-extrabold tracking-tight transition-colors',
                sort === s.k ? 'bg-ink text-cream' : 'bg-transparent text-ink hover:bg-paper',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4">
          {isLoading ? (
            <div className="py-16 text-center font-mono text-sm text-ink-muted">Loading feed…</div>
          ) : plates.length > 0 ? (
            plates.map((p) => <PlateCard key={p.id} plate={p} />)
          ) : (
            <div className="rounded-2xl border-[1.5px] border-dashed border-rule bg-paper p-10 text-center">
              <h2 className="font-display text-3xl font-black tracking-tight text-ink">No plates yet.</h2>
              <p className="mt-1.5 text-sm font-semibold text-ink-soft">Be the first to post.</p>
              <Link to="/upload" className="mt-5 inline-block rounded-full bg-rust px-5 py-2.5 font-extrabold uppercase tracking-wide text-white">
                Post a plate →
              </Link>
            </div>
          )}
        </div>

        <div ref={sentinelRef} className="h-px" />
        {isFetchingNextPage && (
          <div className="py-6 text-center font-mono text-sm text-ink-muted">Loading more…</div>
        )}
      </section>
      <FeedRightRail />
    </motion.main>
  )
}
