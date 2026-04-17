import { useSearchParams } from 'react-router-dom'
import { useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { Container } from '@/components/Container'
import { Eyebrow } from '@/components/Eyebrow'
import { RevealOnScroll } from '@/components/RevealOnScroll'
import { PlateCard } from '@/components/PlateCard'
import { useFeed } from '@/hooks/useApi'
import { US_STATES } from '@/lib/states'

const SORT_OPTIONS = [
  { value: 'recent', label: 'Recent' },
  { value: 'top_day', label: 'Top today' },
  { value: 'top_week', label: 'Top this week' },
  { value: 'top_all', label: 'All-time' },
]

export default function Gallery() {
  const [searchParams, setSearchParams] = useSearchParams()
  const state = searchParams.get('state') || undefined
  const sort = searchParams.get('sort') || 'recent'

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useFeed({ state, sort })
  const plates = data?.pages.flatMap((p) => p.items) ?? []

  const sentinelRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage()
      }
    },
    [fetchNextPage, hasNextPage, isFetchingNextPage],
  )

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect()
    observerRef.current = new IntersectionObserver(handleObserver, { rootMargin: '200px' })
    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current)
    return () => observerRef.current?.disconnect()
  }, [handleObserver])

  function setFilter(key: string, value: string | undefined) {
    const next = new URLSearchParams(searchParams)
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
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
          <Eyebrow>The Gallery</Eyebrow>
          <h1 className="mt-4 font-display text-4xl text-charcoal md:text-5xl">
            All plates
          </h1>
        </RevealOnScroll>

        {/* Filters */}
        <div className="sticky top-16 z-40 -mx-6 mt-8 overflow-x-auto bg-bone/90 px-6 py-4 backdrop-blur-md md:-mx-12 md:px-12">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setFilter('state', undefined)}
              className={clsx(
                'shrink-0 rounded-full px-3 py-1.5 font-sans text-xs transition-colors',
                !state ? 'bg-charcoal text-bone' : 'bg-cream text-stone hover:text-charcoal',
              )}
            >
              All
            </button>
            {Object.entries(US_STATES).map(([code, name]) => (
              <button
                key={code}
                onClick={() => setFilter('state', code)}
                className={clsx(
                  'shrink-0 rounded-full px-3 py-1.5 font-sans text-xs transition-colors',
                  state === code ? 'bg-charcoal text-bone' : 'bg-cream text-stone hover:text-charcoal',
                )}
                title={name}
              >
                {code}
              </button>
            ))}

            <div className="ml-auto shrink-0">
              <select
                value={sort}
                onChange={(e) => setFilter('sort', e.target.value)}
                className="rounded-sm border border-border bg-transparent px-3 py-1.5 font-sans text-xs text-ink outline-none"
              >
                {SORT_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/5] rounded-sm bg-cream" />
                <div className="mt-3 h-3 w-20 rounded bg-cream" />
                <div className="mt-2 h-5 w-32 rounded bg-cream" />
              </div>
            ))}
          </div>
        ) : plates.length > 0 ? (
          <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {plates.map((plate, i) => (
              <RevealOnScroll key={plate.id} delay={(i % 3) * 0.08}>
                <PlateCard plate={plate} priority={i < 3} />
              </RevealOnScroll>
            ))}
          </div>
        ) : (
          <div className="mt-24 text-center">
            <h2 className="font-display text-2xl text-charcoal">
              No plates here yet.
            </h2>
            <p className="mt-2 text-sm text-stone">Be the first.</p>
            <a href="/upload" className="link-draw mt-6 inline-block font-sans text-sm text-oxblood">
              Upload a plate <span aria-hidden="true">&rarr;</span>
            </a>
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} className="h-px" />
        {isFetchingNextPage && (
          <div className="py-8 text-center">
            <p className="font-sans text-sm text-stone">Loading more...</p>
          </div>
        )}
      </Container>
    </motion.main>
  )
}
