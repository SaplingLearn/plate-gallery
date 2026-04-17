import { useParams } from 'react-router-dom'
import { useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Container } from '@/components/Container'
import { Eyebrow } from '@/components/Eyebrow'
import { RevealOnScroll } from '@/components/RevealOnScroll'
import { PlateCard } from '@/components/PlateCard'
import { Divider } from '@/components/Divider'
import { useStateDetail, useFeed } from '@/hooks/useApi'

export default function StateDetail() {
  const { code } = useParams<{ code: string }>()
  const upperCode = code?.toUpperCase() ?? ''
  const { data: stateData, isLoading } = useStateDetail(upperCode)
  const { data: feedData, fetchNextPage, hasNextPage, isFetchingNextPage } = useFeed({ state: upperCode, sort: 'recent' })

  const allPlates = feedData?.pages.flatMap((p) => p.items) ?? []
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

  if (isLoading) {
    return (
      <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-screen items-center justify-center pt-20">
        <p className="font-display text-lg text-stone">Loading...</p>
      </motion.main>
    )
  }

  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.3 }}
    >
      {/* Hero */}
      <section className="relative flex min-h-[50vh] items-end overflow-hidden bg-charcoal">
        {stateData?.hero_plate && (
          <img
            src={stateData.hero_plate.image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-40"
          />
        )}
        <Container className="relative z-10 pb-12 pt-32">
          <Eyebrow className="text-bone/60">
            {stateData?.total_count ?? 0} plates &middot; State Gallery
          </Eyebrow>
          <h1 className="mt-4 font-display text-5xl text-bone md:text-7xl">
            {stateData?.state.name ?? upperCode}
          </h1>
        </Container>
      </section>

      {/* Top 10 */}
      {stateData?.top_10 && stateData.top_10.length > 0 && (
        <section className="py-16">
          <Container>
            <RevealOnScroll>
              <Eyebrow>Rankings</Eyebrow>
              <h2 className="mt-4 font-display text-3xl text-charcoal">
                Top 10 in {stateData.state.name}
              </h2>
            </RevealOnScroll>

            <div className="mt-10 space-y-0">
              {stateData.top_10.map((plate, i) => (
                <RevealOnScroll key={plate.id} delay={i * 0.05}>
                  <div className="flex items-center gap-6 border-b border-border py-6">
                    <span className="w-10 text-right font-display text-3xl text-stone/40">
                      {i + 1}
                    </span>
                    <div className="w-20 shrink-0">
                      <img
                        src={plate.image_thumb_url || plate.image_url}
                        alt={`Plate ${plate.plate_text}`}
                        className="aspect-square w-full rounded-sm object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <a href={`/plate/${plate.id}`} className="font-display text-xl text-charcoal hover:underline">
                        {plate.plate_text}
                      </a>
                      <p className="text-xs text-stone">
                        {plate.score} points
                        {plate.author && ` \u00b7 by ${plate.author.display_name}`}
                      </p>
                    </div>
                  </div>
                </RevealOnScroll>
              ))}
            </div>
          </Container>
        </section>
      )}

      <Divider className="mx-auto max-w-7xl" />

      {/* All plates grid */}
      <section className="py-16">
        <Container>
          <Eyebrow>All Plates</Eyebrow>
          <h2 className="mt-4 font-display text-3xl text-charcoal">
            From {stateData?.state.name ?? upperCode}
          </h2>

          {allPlates.length > 0 ? (
            <div className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              {allPlates.map((plate, i) => (
                <RevealOnScroll key={plate.id} delay={(i % 3) * 0.08}>
                  <PlateCard plate={plate} />
                </RevealOnScroll>
              ))}
            </div>
          ) : (
            <p className="mt-8 text-sm text-stone">No plates uploaded yet for this state.</p>
          )}

          <div ref={sentinelRef} className="h-px" />
          {isFetchingNextPage && (
            <div className="py-8 text-center">
              <p className="font-sans text-sm text-stone">Loading more...</p>
            </div>
          )}
        </Container>
      </section>
    </motion.main>
  )
}
