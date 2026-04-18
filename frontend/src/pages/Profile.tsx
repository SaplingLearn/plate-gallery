import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { clsx } from 'clsx'
import { useQueryClient } from '@tanstack/react-query'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useMyPlates, useMyVotes, useMyFavorites } from '@/hooks/useApi'
import { signOut } from '@/lib/supabase'
import { PhotoSnap } from '@/components/PhotoSnap'
import { StateBadge } from '@/components/StateBadge'
import { Pill } from '@/components/Pill'
import { PG } from '@/lib/design'
import type { Plate } from '@/lib/types'

type Tab = 'plates' | 'votes' | 'favorites'

const EASE_OUT = [0.22, 1, 0.36, 1] as const

function useCountUp(target: number, duration = 700, enabled = true) {
  const [value, setValue] = useState(enabled ? 0 : target)
  useEffect(() => {
    if (!enabled) return
    let raf = 0
    let start: number | null = null
    const tick = (t: number) => {
      if (start === null) start = t
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setValue(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration, enabled])
  return enabled ? value : target
}

function ProfileStat({ v, l, accent }: { v: number; l: string; accent?: string }) {
  const reduced = useReducedMotion()
  const count = useCountUp(v, 700, !reduced)
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } },
      }}
      whileHover={{ y: -2 }}
      className="min-w-[86px] rounded-xl border-[1.5px] border-rule bg-cream px-3.5 py-2.5"
    >
      <div
        className="font-display text-[30px] font-black leading-none tracking-[-0.5px] tabular-nums"
        style={{ color: accent ?? PG.c.ink }}
      >
        {count.toLocaleString()}
      </div>
      <div className="font-mono text-[10px] font-bold uppercase tracking-wide text-ink-muted">
        {l}
      </div>
    </motion.div>
  )
}

function PlateTile({ plate, rankLabel }: { plate: Plate; rankLabel?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.3, ease: EASE_OUT }}
    >
    <Link
      to={`/plate/${plate.id}`}
      className="block overflow-hidden rounded-[14px] border-[1.5px] border-rule bg-paper"
      style={{ boxShadow: '0 2px 0 var(--color-rule)' }}
    >
      <div className="relative">
        <PhotoSnap
          plate={plate.plate_text}
          state={plate.state_code}
          width={260}
          height={160}
          imageUrl={plate.image_thumb_url || plate.image_url}
          alt={`${plate.plate_text} · ${plate.state_name}`}
        />
        {rankLabel && (
          <div className="absolute left-2 top-2">
            <Pill bg={PG.c.rust} fg={PG.c.cream}>
              {rankLabel}
            </Pill>
          </div>
        )}
        {plate.status === 'rejected' && (
          <div className="absolute right-2 top-2">
            <Pill bg={PG.c.cherry} fg={PG.c.cream}>
              REJECTED
            </Pill>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="font-display text-[18px] font-black tracking-[-0.3px] text-ink">
          “{plate.plate_text}”
        </div>
        <span className="ml-auto font-mono text-[11px] font-bold text-ink">
          ▲ {plate.score.toLocaleString()}
        </span>
      </div>
    </Link>
    </motion.div>
  )
}

export default function Profile() {
  const { user, loading } = useRequireAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('plates')

  const { data: platesData } = useMyPlates()
  const { data: votesData } = useMyVotes()
  const { data: favoritesData } = useMyFavorites()

  const plates = platesData?.pages.flatMap((p) => p.items) ?? []
  const votes = votesData?.pages.flatMap((p) => p.items) ?? []
  const favorites = favoritesData?.pages.flatMap((p) => p.items) ?? []

  async function handleSignOut() {
    await signOut()
    queryClient.clear()
    navigate('/')
  }

  if (loading || !user) return null

  const displayName = user.user_metadata?.full_name || user.email || 'User'
  const handle = user.email ? user.email.split('@')[0] : 'user'
  const avatarUrl = user.user_metadata?.avatar_url
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? '')
    .join('') || '?'

  const totalUpvotes = plates.reduce((acc, p) => acc + p.upvotes, 0)
  const unlockedStates = new Set(plates.map((p) => p.state_code))

  const activeList = tab === 'plates' ? plates : tab === 'favorites' ? favorites : []

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Header */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
        }}
        className="border-b-[1.5px] border-rule bg-paper px-8 py-7"
      >
        <div className="flex flex-wrap items-center gap-5">
          <motion.div
            variants={{
              hidden: { opacity: 0, scale: 0.82 },
              show: { opacity: 1, scale: 1, transition: { duration: 0.45, ease: EASE_OUT } },
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="h-[120px] w-[120px] rounded-full border-[3px] border-rule object-cover"
                style={{ boxShadow: '0 4px 0 var(--color-rule)' }}
              />
            ) : (
              <div
                className="flex h-[120px] w-[120px] items-center justify-center rounded-full border-[3px] border-rule bg-cobalt font-display text-[54px] font-black text-cream"
                style={{ boxShadow: '0 4px 0 var(--color-rule)' }}
              >
                {initials}
              </div>
            )}
          </motion.div>
          <motion.div
            variants={{
              hidden: { opacity: 0, x: -12 },
              show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: EASE_OUT } },
            }}
            className="min-w-0"
          >
            <div className="font-mono text-[11px] font-bold uppercase tracking-[1.5px] text-ink-muted">
              @{handle.toUpperCase()} · JOINED{' '}
              {new Date(user.created_at).toLocaleDateString('en-US', {
                month: 'short',
                year: 'numeric',
              })}
            </div>
            <div className="font-display text-[72px] font-black leading-[0.9] tracking-[-2px] text-ink">
              {displayName}.
            </div>
            <div className="mt-1 max-w-[520px] text-[14px] font-semibold text-ink-soft">
              {plates.length > 0
                ? `${plates.length} plates uploaded · chasing the nation one hood at a time.`
                : 'No plates uploaded yet — your gallery is waiting.'}
            </div>
          </motion.div>
          <motion.div
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.06, delayChildren: 0.15 } },
            }}
            className="ml-auto flex flex-wrap items-center gap-3"
          >
            <ProfileStat v={plates.length} l="POSTED" />
            <ProfileStat v={totalUpvotes} l="TOTAL UPVOTES" accent={PG.c.rust} />
            <ProfileStat v={unlockedStates.size} l="STATES" accent={PG.c.cobalt} />
            <ProfileStat v={favorites.length} l="SAVED" />
            <motion.button
              type="button"
              onClick={handleSignOut}
              variants={{
                hidden: { opacity: 0, y: 8 },
                show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE_OUT } },
              }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.96 }}
              className="h-12 rounded-full border-[1.5px] border-rule bg-ink px-5.5 font-sans text-[13px] font-extrabold uppercase tracking-[0.3px] text-cream"
              style={{ boxShadow: '0 3px 0 var(--color-rule)' }}
            >
              Sign out
            </motion.button>
          </motion.div>
        </div>
      </motion.div>

      <div className="grid gap-6 px-8 py-5 lg:grid-cols-[1fr_320px]">
        {/* Main panel */}
        <section>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {(['plates', 'votes', 'favorites'] as const).map((t) => (
              <motion.button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.94 }}
                transition={{ duration: 0.14, ease: EASE_OUT }}
                className={clsx(
                  'relative rounded-full border-[1.5px] border-rule bg-paper px-3.5 py-1.5 text-[12px] font-extrabold uppercase tracking-[0.3px]',
                  tab === t ? 'text-cream' : 'text-ink',
                )}
              >
                {tab === t && (
                  <motion.span
                    layoutId="profile-tab-indicator"
                    className="absolute inset-[-1.5px] -z-10 rounded-full bg-ink"
                    transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                  />
                )}
                <span className="relative z-10">
                  {t === 'plates' ? 'My Posts' : t === 'favorites' ? 'Saved' : 'My Votes'}
                </span>
              </motion.button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
            >
          {tab === 'plates' && (
            <>
              {plates.length > 0 ? (
                <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
                  {plates.map((plate) => (
                    <PlateTile key={plate.id} plate={plate} />
                  ))}
                </div>
              ) : (
                <div className="rounded-[18px] border-[1.5px] border-dashed border-rule bg-paper p-10 text-center">
                  <h2 className="font-display text-2xl font-black tracking-tight text-ink">
                    No plates uploaded yet.
                  </h2>
                  <Link
                    to="/upload"
                    className="mt-4 inline-block rounded-full bg-rust px-5 py-2.5 font-extrabold uppercase tracking-wide text-white"
                  >
                    Upload your first plate →
                  </Link>
                </div>
              )}
            </>
          )}

          {tab === 'favorites' && (
            <>
              {favorites.length > 0 ? (
                <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
                  {favorites.map((plate) => (
                    <PlateTile key={plate.id} plate={plate} />
                  ))}
                </div>
              ) : (
                <div className="rounded-[18px] border-[1.5px] border-dashed border-rule bg-paper p-10 text-center">
                  <h2 className="font-display text-2xl font-black tracking-tight text-ink">
                    No saved plates yet.
                  </h2>
                  <Link
                    to="/"
                    className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 font-extrabold uppercase tracking-wide text-cream"
                  >
                    Browse the feed →
                  </Link>
                </div>
              )}
            </>
          )}

          {tab === 'votes' && (
            <>
              {votes.length > 0 ? (
                <div
                  className="overflow-hidden rounded-[18px] border-[1.5px] border-rule bg-paper"
                  style={{ boxShadow: '0 3px 0 var(--color-rule)' }}
                >
                  {votes.map((vote, i) => (
                    <Link
                      key={`${vote.plate.id}-${vote.voted_at}`}
                      to={`/plate/${vote.plate.id}`}
                      className="flex items-center gap-4 px-5 py-3"
                      style={{
                        borderTop: i === 0 ? 'none' : '1px dashed var(--color-paper-edge)',
                      }}
                    >
                      <span
                        className={clsx(
                          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-rule font-display text-[18px] font-black',
                          vote.value === 1 ? 'bg-rust text-cream' : 'bg-ink text-mustard',
                        )}
                      >
                        {vote.value === 1 ? '▲' : '▼'}
                      </span>
                      <div className="flex-1">
                        <div className="font-display text-[20px] font-black tracking-[-0.3px] text-ink">
                          “{vote.plate.plate_text}”
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-ink-soft">
                          <StateBadge code={vote.plate.state_code} size="sm" /> {vote.plate.state_name}
                        </div>
                      </div>
                      <div className="font-mono text-[11px] font-bold text-ink-muted">
                        {new Date(vote.voted_at).toLocaleDateString()}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="rounded-[18px] border-[1.5px] border-dashed border-rule bg-paper p-10 text-center">
                  <h2 className="font-display text-2xl font-black tracking-tight text-ink">
                    No votes yet.
                  </h2>
                  <Link
                    to="/"
                    className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 font-extrabold uppercase tracking-wide text-cream"
                  >
                    Start voting →
                  </Link>
                </div>
              )}
            </>
          )}
            </motion.div>
          </AnimatePresence>
        </section>

        {/* Sidebar */}
        <aside className="flex flex-col gap-3.5">
          <div
            className="rounded-[14px] border-[1.5px] border-rule bg-mustard-lite p-4"
            style={{ boxShadow: '0 2px 0 var(--color-rule)' }}
          >
            <div className="font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-ink">
              QUICK STATS
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border-[1.5px] border-rule bg-paper px-1.5 py-2">
                <div className="font-display text-[22px] font-black leading-none text-ink">
                  {plates.length}
                </div>
                <div className="mt-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-ink-muted">
                  POSTS
                </div>
              </div>
              <div className="rounded-lg border-[1.5px] border-rule bg-paper px-1.5 py-2">
                <div className="font-display text-[22px] font-black leading-none text-rust">
                  {totalUpvotes.toLocaleString()}
                </div>
                <div className="mt-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-ink-muted">
                  UPVOTES
                </div>
              </div>
              <div className="rounded-lg border-[1.5px] border-rule bg-paper px-1.5 py-2">
                <div className="font-display text-[22px] font-black leading-none text-cobalt">
                  {favorites.length}
                </div>
                <div className="mt-0.5 font-mono text-[9px] font-bold uppercase tracking-wide text-ink-muted">
                  SAVED
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[14px] border-[1.5px] border-rule bg-ink p-4 text-cream">
            <div className="font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-mustard">
              STATES UNLOCKED
            </div>
            <div className="mt-1 font-display text-[44px] font-black leading-none tracking-[-1px]">
              {unlockedStates.size} / 51
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1">
              {[...unlockedStates].slice(0, 16).map((code) => (
                <StateBadge key={code} code={code} size="sm" />
              ))}
              {unlockedStates.size === 0 && (
                <div className="text-[11px] font-bold text-mustard">
                  Post from any state to begin.
                </div>
              )}
            </div>
            {unlockedStates.size > 0 && unlockedStates.size < 51 && (
              <div className="mt-2.5 text-[11px] font-bold text-mustard">
                Next goal: {Math.min(10, 51 - unlockedStates.size)} more
                {unlockedStates.size < 10
                  ? ' → Road-Tripper badge'
                  : ' → Cross-Country badge'}
              </div>
            )}
          </div>

          {activeList.length > 0 && tab !== 'votes' && (
            <div className="rounded-[14px] border-[1.5px] border-rule bg-paper p-4">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-ink-muted">
                HIGHEST SCORE
              </div>
              {(() => {
                const top = [...activeList].sort((a, b) => b.score - a.score)[0]
                if (!top) return null
                return (
                  <Link to={`/plate/${top.id}`} className="mt-1 block">
                    <div className="font-display text-[30px] font-black leading-none tracking-[-0.5px] text-ink">
                      “{top.plate_text}”
                    </div>
                    <div className="mt-1 text-[12px] font-bold text-ink-soft">
                      ▲ {top.score.toLocaleString()} · {top.state_name}
                    </div>
                  </Link>
                )
              })()}
            </div>
          )}
        </aside>
      </div>
    </motion.main>
  )
}
