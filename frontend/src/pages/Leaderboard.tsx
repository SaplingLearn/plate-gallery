import { useSearchParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { useLeaderboard, useMapSummary } from '@/hooks/useApi'
import { Plate as PlateSvg } from '@/components/Plate'
import { StateBadge } from '@/components/StateBadge'
import { PG } from '@/lib/design'
import type { Plate } from '@/lib/types'

const WINDOWS = [
  { value: 'all', label: 'ALL TIME' },
  { value: 'year', label: 'THIS YEAR' },
  { value: 'month', label: 'THIS MONTH' },
  { value: 'week', label: 'THIS WEEK' },
  { value: 'day', label: 'TODAY' },
]

function PodiumCard({
  plate,
  rank,
  color,
  big,
  dark,
}: {
  plate: Plate
  rank: 1 | 2 | 3
  color: string
  big?: boolean
  dark?: boolean
}) {
  const txt = dark ? PG.c.ink : PG.c.cream
  return (
    <Link
      to={`/plate/${plate.id}`}
      className="relative flex flex-col gap-2.5 overflow-hidden rounded-[18px] border-[1.5px] border-rule p-[18px]"
      style={{
        background: color,
        color: txt,
        boxShadow: '0 4px 0 var(--color-rule)',
        height: big ? 280 : rank === 2 ? 240 : 220,
      }}
    >
      <div
        className="absolute right-3 top-3 font-display font-black leading-[0.8] tracking-[-3px] opacity-20"
        style={{ fontSize: big ? 120 : 90 }}
      >
        {String(rank).padStart(2, '0')}
      </div>
      <div className="relative flex items-center gap-2">
        <div
          className="flex h-[34px] w-[34px] items-center justify-center rounded-full border-[1.5px] border-rule font-display text-[18px] font-black"
          style={{
            background: dark ? PG.c.ink : PG.c.cream,
            color: dark ? PG.c.mustard : color,
          }}
        >
          {rank === 1 ? '★' : rank}
        </div>
        <StateBadge code={plate.state_code} />
      </div>
      <div className="relative mt-auto">
        <PlateSvg text={plate.plate_text} state={plate.state_code} width={big ? 280 : 240} />
      </div>
      <div className="relative flex items-center gap-2.5">
        <div
          className="font-display font-black leading-none tracking-[-1px]"
          style={{ fontSize: big ? 44 : 36 }}
        >
          ▲ {plate.upvotes.toLocaleString()}
        </div>
        <div className="text-[12px] font-bold opacity-85">
          @{plate.author?.display_name ?? 'anonymous'}
        </div>
      </div>
    </Link>
  )
}

function LeaderRows({ rows }: { rows: Plate[] }) {
  return (
    <div
      className="overflow-hidden rounded-[18px] border-[1.5px] border-rule bg-paper"
      style={{ boxShadow: '0 3px 0 var(--color-rule)' }}
    >
      <div
        className="grid bg-ink px-[18px] py-2.5 font-mono text-[10px] font-bold uppercase tracking-[1.2px] text-cream"
        style={{ gridTemplateColumns: '56px 160px 1fr 100px 80px' }}
      >
        <div>#</div>
        <div>PLATE</div>
        <div>CREATOR</div>
        <div>UPVOTES</div>
        <div>STATE</div>
      </div>
      {rows.map((r, i) => (
        <Link
          key={r.id}
          to={`/plate/${r.id}`}
          className="grid items-center px-[18px] py-2.5"
          style={{
            gridTemplateColumns: '56px 160px 1fr 100px 80px',
            borderTop: i === 0 ? 'none' : '1px dashed var(--color-paper-edge)',
          }}
        >
          <div className="font-display text-[26px] font-black leading-none tracking-[-0.5px] text-ink">
            {i + 4}
          </div>
          <PlateSvg text={r.plate_text} state={r.state_code} width={150} />
          <div>
            <div className="text-[14px] font-extrabold text-ink">“{r.plate_text}”</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-ink-soft">
              <StateBadge code={r.state_code} size="sm" /> @{r.author?.display_name ?? 'anonymous'}
            </div>
          </div>
          <div className="font-display text-[22px] font-black tracking-[-0.3px] text-ink">
            {r.upvotes.toLocaleString()}
          </div>
          <div className="font-mono text-[11px] font-bold text-ink-soft">
            {r.state_code}
          </div>
        </Link>
      ))}
    </div>
  )
}

function LeaderSideCards({ plates }: { plates: Plate[] }) {
  const { data: mapSummary } = useMapSummary()
  const states = mapSummary?.states ?? []
  const topState = [...states].sort((a, b) => b.plate_count - a.plate_count)[0]
  const lockedState = states.find((s) => s.plate_count === 0)
  const witty = plates.slice(0, 3).map((p) => p.plate_text)

  return (
    <div className="flex flex-col gap-3.5">
      <div className="rounded-[18px] border-[1.5px] border-rule bg-ink p-4 text-cream">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-mustard">
          MOST ACTIVE STATE
        </div>
        <div className="mt-1 font-display text-[54px] font-black uppercase leading-[0.85] tracking-[-1.5px] text-cream">
          {topState?.name ?? '—'}.
        </div>
        <div className="mt-1.5 text-[12px] font-bold text-mustard">
          {topState ? `${topState.plate_count.toLocaleString()} plates uploaded` : 'No data yet'}
        </div>
      </div>
      <div className="rounded-[18px] border-[1.5px] border-rule bg-mustard-lite p-4 text-ink">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-ink">
          RAREST STATE REPRESENTED
        </div>
        <div className="mt-1 font-display text-[54px] font-black uppercase leading-[0.85] tracking-[-1.5px] text-ink">
          {lockedState ? (
            <>
              {lockedState.name.toUpperCase()}?<br />(not yet.)
            </>
          ) : (
            'ALL 50 + DC.'
          )}
        </div>
        <div className="mt-1.5 text-[12px] font-bold">
          {lockedState
            ? 'Still locked. Be the first to post from here.'
            : 'Every state represented. Keep climbing.'}
        </div>
      </div>
      <div className="rounded-[18px] border-[1.5px] border-rule bg-paper p-4">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-ink-muted">
          TOP QUOTES THIS LIST
        </div>
        <div className="mt-1 font-display text-[30px] font-black leading-[0.95] tracking-[-0.5px] text-ink">
          {witty.length > 0 ? witty.map((t) => `“${t}”`).join(', ') : 'Nothing here yet.'}
        </div>
      </div>
    </div>
  )
}

export default function Leaderboard() {
  const [searchParams, setSearchParams] = useSearchParams()
  const window = searchParams.get('window') || 'all'
  const { data, isLoading } = useLeaderboard(window, 50)
  const plates = data?.items ?? []
  const [p1, p2, p3] = plates
  const rest = plates.slice(3, 11)

  function setWindow(v: string) {
    const next = new URLSearchParams(searchParams)
    next.set('window', v)
    setSearchParams(next, { replace: true })
  }

  return (
    <motion.main
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.25 }}
      className="px-8 py-6"
    >
      {/* Header row */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <div className="mb-1 font-mono text-[11px] font-bold uppercase tracking-[1.5px] text-ink-muted">
            ALL 51 STATES · {WINDOWS.find((w) => w.value === window)?.label ?? 'ALL TIME'}
          </div>
          <div className="font-display text-[80px] font-black uppercase leading-[0.88] tracking-[-2.5px] text-ink">
            HALL OF PLATES.
          </div>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {WINDOWS.map((w) => (
            <button
              key={w.value}
              type="button"
              onClick={() => setWindow(w.value)}
              className={clsx(
                'rounded-full border-[1.5px] border-rule px-3.5 py-2 text-[12px] font-extrabold tracking-[0.3px]',
                window === w.value ? 'bg-ink text-cream' : 'bg-paper text-ink',
              )}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="py-16 text-center font-mono text-sm text-ink-muted">Loading leaderboard…</div>
      ) : plates.length === 0 ? (
        <div className="mt-10 rounded-[18px] border-[1.5px] border-dashed border-rule bg-paper p-12 text-center">
          <h2 className="font-display text-3xl font-black tracking-tight text-ink">No plates ranked yet.</h2>
          <p className="mt-2 text-sm font-semibold text-ink-soft">
            Upload and vote to fill the leaderboard.
          </p>
        </div>
      ) : (
        <>
          {/* Podium */}
          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1.15fr_1fr]">
            {p2 ? (
              <PodiumCard plate={p2} rank={2} color={PG.c.cobalt} />
            ) : (
              <div className="hidden md:block" />
            )}
            {p1 && <PodiumCard plate={p1} rank={1} color={PG.c.rust} big />}
            {p3 ? (
              <PodiumCard plate={p3} rank={3} color={PG.c.mustard} dark />
            ) : (
              <div className="hidden md:block" />
            )}
          </div>

          {/* Rest + side cards */}
          {rest.length > 0 && (
            <div className="mt-5 grid gap-5 lg:grid-cols-[2fr_1fr]">
              <LeaderRows rows={rest} />
              <LeaderSideCards plates={plates} />
            </div>
          )}
        </>
      )}
    </motion.main>
  )
}
