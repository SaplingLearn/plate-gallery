import { Link, useParams } from 'react-router-dom'
import { useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useStateDetail, useFeed } from '@/hooks/useApi'
import { Plate } from '@/components/Plate'
import { PhotoSnap } from '@/components/PhotoSnap'
import { Pill } from '@/components/Pill'
import { PG } from '@/lib/design'

function HeroStat({ v, l, accent }: { v: string; l: string; accent?: string }) {
  return (
    <div
      className="min-w-[110px] rounded-[14px] px-[18px] py-[14px]"
      style={{
        background: 'rgba(0,0,0,0.22)',
        border: '1.5px solid rgba(245,236,220,0.2)',
      }}
    >
      <div
        className="font-display text-[48px] font-black leading-none tracking-tight"
        style={{ color: accent ?? PG.c.cream }}
      >
        {v}
      </div>
      <div className="font-mono text-[10px] font-bold uppercase tracking-wide text-mustard">
        {l}
      </div>
    </div>
  )
}

function SectionTitle({ kicker, title, right }: { kicker: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-end gap-3">
      <div>
        <div className="font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-ink-muted">
          {kicker}
        </div>
        <div className="font-display text-[34px] font-black leading-none tracking-[-0.8px] text-ink">
          {title}
        </div>
      </div>
      {right && <div className="ml-auto">{right}</div>}
    </div>
  )
}

export default function StateDetail() {
  const { code } = useParams<{ code: string }>()
  const upperCode = code?.toUpperCase() ?? ''
  const { data: stateData, isLoading } = useStateDetail(upperCode)
  const { data: feedData, fetchNextPage, hasNextPage, isFetchingNextPage } = useFeed({
    state: upperCode,
    sort: 'recent',
  })

  const recent = feedData?.pages.flatMap((p) => p.items) ?? []
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
      <main className="flex min-h-[calc(100vh-72px)] items-center justify-center">
        <p className="font-mono text-sm text-ink-muted">Loading…</p>
      </main>
    )
  }

  const stateName = stateData?.state.name ?? upperCode
  const total = stateData?.total_count ?? 0
  const creators = new Set(stateData?.top_10.map((p) => p.author?.id).filter(Boolean)).size
  const top10 = stateData?.top_10 ?? []
  const fresh = recent.slice(0, 6)

  return (
    <motion.main
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.25 }}
    >
      {/* Hero */}
      <section
        className="relative overflow-hidden border-b-[1.5px] border-rule bg-cobalt px-8 py-7 text-cream"
      >
        <svg
          className="absolute inset-0 h-full w-full opacity-15"
          viewBox="0 0 1280 200"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <line
              key={i}
              x1="0"
              y1={30 + i * 32}
              x2="1280"
              y2={30 + i * 32}
              stroke={PG.c.mustard}
              strokeWidth="2"
              strokeDasharray="20 20"
            />
          ))}
        </svg>
        <div className="relative flex flex-wrap items-end gap-6">
          <div>
            <div className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-[1.5px] text-mustard">
              {upperCode} · {total.toLocaleString()} PLATES · VANITY GALLERY
            </div>
            <div className="font-display text-[120px] font-black uppercase leading-[0.82] tracking-[-4px]">
              {stateName}.
            </div>
          </div>
          <div className="ml-auto flex flex-wrap gap-3.5">
            <HeroStat v={total.toLocaleString()} l="PLATES" />
            <HeroStat v={creators.toLocaleString()} l="CREATORS" />
            <HeroStat v={top10[0]?.upvotes.toLocaleString() ?? '0'} l="TOP UPVOTES" />
            <HeroStat
              v={top10[0] ? `▲${top10[0].score}` : '—'}
              l="#1 SCORE"
              accent={PG.c.mustard}
            />
          </div>
        </div>
      </section>

      <div className="grid gap-6 px-8 py-5 lg:grid-cols-[1.2fr_1fr]">
        {/* Top 10 */}
        <section>
          <SectionTitle kicker="LEADERBOARD · ALL TIME" title={`TOP ${Math.min(top10.length, 10)} PLATES`} />
          {top10.length > 0 ? (
            <div
              className="overflow-hidden rounded-[18px] border-[1.5px] border-rule bg-paper"
              style={{ boxShadow: '0 3px 0 var(--color-rule)' }}
            >
              {top10.map((p, i) => (
                <Link
                  key={p.id}
                  to={`/plate/${p.id}`}
                  className="grid items-center gap-4 px-[18px] py-3"
                  style={{
                    gridTemplateColumns: '56px 180px 1fr auto auto',
                    borderTop: i === 0 ? 'none' : '1px dashed var(--color-paper-edge)',
                    background: i === 0 ? PG.c.mustardLite : 'transparent',
                  }}
                >
                  <div
                    className="font-display text-[42px] font-black leading-none tracking-[-1.5px]"
                    style={{ color: i < 3 ? PG.c.rust : PG.c.ink }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <Plate text={p.plate_text} state={p.state_code} width={180} />
                  <div>
                    <div className="font-display text-[22px] font-black leading-none tracking-[-0.3px] text-ink">
                      “{p.plate_text}”
                    </div>
                    <div className="mt-0.5 text-[12px] font-semibold text-ink-soft">
                      by <strong className="text-ink">@{p.author?.display_name ?? 'anonymous'}</strong>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-[24px] font-black leading-none tracking-[-0.5px] text-ink">
                      ▲ {p.upvotes.toLocaleString()}
                    </div>
                    <div className="font-mono text-[10px] font-bold uppercase tracking-wide text-ink-muted">
                      UPVOTES
                    </div>
                  </div>
                  <div
                    className="flex h-[30px] w-[30px] items-center justify-center rounded-full border-[1.5px] border-rule bg-cream text-[14px] font-black text-rust"
                  >
                    ▲
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-[18px] border-[1.5px] border-dashed border-rule bg-paper p-8 text-center">
              <p className="font-mono text-sm font-bold text-ink-soft">No plates yet for {stateName}.</p>
            </div>
          )}
        </section>

        {/* Fresh sightings + fun fact */}
        <section>
          <SectionTitle
            kicker="FRESH SIGHTINGS"
            title={`LATEST IN ${upperCode}`}
            right={<Pill bg={PG.c.paper}>SEE ALL {total.toLocaleString()} →</Pill>}
          />
          {fresh.length > 0 ? (
            <div className="grid grid-cols-2 gap-3.5">
              {fresh.map((p) => (
                <Link
                  key={p.id}
                  to={`/plate/${p.id}`}
                  className="overflow-hidden rounded-[14px] border-[1.5px] border-rule bg-paper"
                  style={{ boxShadow: '0 2px 0 var(--color-rule)' }}
                >
                  <PhotoSnap
                    plate={p.plate_text}
                    state={p.state_code}
                    width={280}
                    height={180}
                    imageUrl={p.image_thumb_url || p.image_url}
                    alt={`${p.plate_text} · ${p.state_name}`}
                  />
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <div className="font-display text-[18px] font-black tracking-[-0.3px] text-ink">
                      “{p.plate_text}”
                    </div>
                    <span className="ml-auto font-mono text-[11px] font-bold text-ink-soft">
                      ▲ {p.score.toLocaleString()}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-[14px] border-[1.5px] border-dashed border-rule bg-paper p-6 text-center">
              <p className="text-[13px] font-semibold text-ink-soft">No recent sightings yet.</p>
            </div>
          )}

          {total > 0 && (
            <div className="mt-4 rounded-[14px] border-[1.5px] border-rule bg-mustard-lite p-4">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-ink">
                {upperCode} FUN FACT
              </div>
              <div className="mt-1 font-display text-[26px] font-black leading-none tracking-[-0.3px] text-ink">
                {total.toLocaleString()} PLATES AND COUNTING.
              </div>
              <div className="mt-1 text-[13px] font-semibold text-ink-soft">
                {creators > 0
                  ? `${creators} creators on the leaderboard so far. Keep 'em coming.`
                  : 'Be the first to leave your mark here.'}
              </div>
            </div>
          )}

          <div ref={sentinelRef} className="h-px" />
          {isFetchingNextPage && (
            <div className="py-4 text-center font-mono text-sm text-ink-muted">Loading more…</div>
          )}
        </section>
      </div>
    </motion.main>
  )
}
