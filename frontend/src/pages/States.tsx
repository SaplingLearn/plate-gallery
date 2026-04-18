import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { useMapSummary, useStateLeaderboard } from '@/hooks/useApi'
import { Plate } from '@/components/Plate'
import { StateBadge } from '@/components/StateBadge'
import { Pill } from '@/components/Pill'
import { PG } from '@/lib/design'
import { US_STATES } from '@/lib/states'

type GridCell = { c: string; name: string; col: number; row: number }

const STATE_GRID: GridCell[] = [
  { c: 'AK', name: 'Alaska', col: 1, row: 7 },
  { c: 'ME', name: 'Maine', col: 12, row: 1 },
  { c: 'VT', name: 'Vermont', col: 11, row: 2 },
  { c: 'NH', name: 'New Hampshire', col: 12, row: 2 },
  { c: 'WA', name: 'Washington', col: 2, row: 2 },
  { c: 'ID', name: 'Idaho', col: 3, row: 2 },
  { c: 'MT', name: 'Montana', col: 4, row: 2 },
  { c: 'ND', name: 'North Dakota', col: 5, row: 2 },
  { c: 'MN', name: 'Minnesota', col: 6, row: 2 },
  { c: 'WI', name: 'Wisconsin', col: 7, row: 2 },
  { c: 'MI', name: 'Michigan', col: 9, row: 2 },
  { c: 'NY', name: 'New York', col: 10, row: 2 },
  { c: 'MA', name: 'Massachusetts', col: 11, row: 3 },
  { c: 'OR', name: 'Oregon', col: 2, row: 3 },
  { c: 'UT', name: 'Utah', col: 3, row: 3 },
  { c: 'WY', name: 'Wyoming', col: 4, row: 3 },
  { c: 'SD', name: 'South Dakota', col: 5, row: 3 },
  { c: 'IA', name: 'Iowa', col: 6, row: 3 },
  { c: 'IL', name: 'Illinois', col: 7, row: 3 },
  { c: 'IN', name: 'Indiana', col: 8, row: 3 },
  { c: 'OH', name: 'Ohio', col: 9, row: 3 },
  { c: 'PA', name: 'Pennsylvania', col: 10, row: 3 },
  { c: 'NJ', name: 'New Jersey', col: 11, row: 4 },
  { c: 'CT', name: 'Connecticut', col: 10, row: 4 },
  { c: 'RI', name: 'Rhode Island', col: 12, row: 3 },
  { c: 'CA', name: 'California', col: 2, row: 4 },
  { c: 'NV', name: 'Nevada', col: 3, row: 4 },
  { c: 'CO', name: 'Colorado', col: 4, row: 4 },
  { c: 'NE', name: 'Nebraska', col: 5, row: 4 },
  { c: 'MO', name: 'Missouri', col: 6, row: 4 },
  { c: 'KY', name: 'Kentucky', col: 8, row: 4 },
  { c: 'WV', name: 'West Virginia', col: 9, row: 4 },
  { c: 'VA', name: 'Virginia', col: 10, row: 5 },
  { c: 'MD', name: 'Maryland', col: 11, row: 5 },
  { c: 'DE', name: 'Delaware', col: 12, row: 5 },
  { c: 'DC', name: 'D.C.', col: 10, row: 6 },
  { c: 'AZ', name: 'Arizona', col: 3, row: 5 },
  { c: 'NM', name: 'New Mexico', col: 4, row: 5 },
  { c: 'KS', name: 'Kansas', col: 5, row: 5 },
  { c: 'OK', name: 'Oklahoma', col: 6, row: 5 },
  { c: 'AR', name: 'Arkansas', col: 7, row: 5 },
  { c: 'TN', name: 'Tennessee', col: 8, row: 5 },
  { c: 'NC', name: 'North Carolina', col: 9, row: 5 },
  { c: 'TX', name: 'Texas', col: 6, row: 6 },
  { c: 'LA', name: 'Louisiana', col: 7, row: 6 },
  { c: 'MS', name: 'Mississippi', col: 8, row: 6 },
  { c: 'AL', name: 'Alabama', col: 9, row: 6 },
  { c: 'GA', name: 'Georgia', col: 10, row: 7 },
  { c: 'SC', name: 'South Carolina', col: 11, row: 6 },
  { c: 'HI', name: 'Hawaii', col: 2, row: 7 },
  { c: 'FL', name: 'Florida', col: 11, row: 7 },
]

function volColor(cnt: number) {
  if (cnt === 0) return PG.c.paperEdge
  if (cnt < 25) return '#e9d8a8'
  if (cnt < 100) return PG.c.mustard
  if (cnt < 250) return '#e87a47'
  return PG.c.rust
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-3.5 w-3.5 rounded-sm border-[1.5px] border-rule" style={{ background: color }} />
      {label}
    </span>
  )
}

function QuickPeek({ code, name, count }: { code: string; name: string; count: number }) {
  const { data } = useStateLeaderboard(code, 'all', 4)
  const top = data?.items?.[0]
  const others = (data?.items ?? []).slice(1, 4)
  const navigate = useNavigate()
  const labelParts = name.toUpperCase().split(/(?<=A|E|I|O|U)-?/)

  return (
    <div
      className="flex h-full flex-col gap-3 overflow-hidden rounded-[18px] border-[1.5px] border-rule bg-ink p-5 text-cream"
      style={{ boxShadow: '0 3px 0 var(--color-rule)' }}
    >
      <div className="flex items-center gap-2">
        <StateBadge code={code} />
        <div className="font-mono text-[10px] font-bold uppercase tracking-wide text-mustard">
          HOVERED
        </div>
      </div>
      <div className="font-display text-[44px] font-black uppercase leading-[0.85] tracking-[-1.5px] text-cream">
        {labelParts[0]}
        {labelParts[1] ? <><br />{labelParts[1]}</> : null}.
      </div>
      <div className="text-[12px] font-bold text-mustard">
        {count} plates {count === 0 && '· locked'}
      </div>

      {top ? (
        <div className="rounded-lg border border-dashed border-cream/25 bg-white/5 p-3">
          <div className="mb-2 font-mono text-[10px] font-bold uppercase tracking-wide text-mustard">
            #1 in state
          </div>
          <Plate text={top.plate_text} state={top.state_code} width={260} />
          <div className="mt-2 flex gap-2.5 text-[11px] font-bold">
            <span>▲ {top.score}</span>
            <span>💬 {top.comment_count}</span>
            <span className="ml-auto text-mustard">by @{top.author?.display_name ?? 'anonymous'}</span>
          </div>
        </div>
      ) : count === 0 ? (
        <div className="rounded-lg border border-dashed border-cream/25 bg-white/5 p-3 text-[12px] font-semibold text-mustard">
          First uploader gets 50 bonus votes.
        </div>
      ) : null}

      {others.length > 0 && (
        <div>
          <div className="mb-1.5 font-mono text-[10px] font-bold uppercase tracking-wide text-mustard">
            Also trending
          </div>
          {others.map((p, i) => (
            <div
              key={p.id}
              className="flex items-center gap-2.5 py-2 text-[12px] font-bold"
              style={{ borderTop: i === 0 ? 'none' : '1px dashed rgba(245,236,220,0.2)' }}
            >
              <span className="w-4 font-mono text-[10px] text-mustard">0{i + 2}</span>
              <span className="flex-1 font-display text-[18px] font-black leading-none tracking-tight text-cream">
                {p.plate_text}
              </span>
              <span className="font-mono text-[11px]">▲ {p.score}</span>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate(`/states/${code}`)}
        disabled={count === 0}
        className="mt-auto h-11 rounded-full border-[1.5px] border-rule bg-rust font-display text-[18px] font-black tracking-wide text-white disabled:opacity-40"
        style={{ boxShadow: '0 3px 0 var(--color-rust-deep)' }}
      >
        ENTER {code} →
      </button>
    </div>
  )
}

export default function States() {
  const { data, isLoading } = useMapSummary()
  const navigate = useNavigate()
  const [hovered, setHovered] = useState<string>('MA')

  const byCode = new Map<string, { count: number; name: string }>()
  data?.states.forEach((s) => byCode.set(s.code, { count: s.plate_count, name: s.name }))

  const total = data?.states.reduce((a, s) => a + s.plate_count, 0) ?? 0
  const unlocked = data?.states.filter((s) => s.plate_count > 0).length ?? 0

  const cols = 12
  const rows = 7
  const cell = 72
  const gap = 8
  const hoveredCount = byCode.get(hovered)?.count ?? 0
  const hoveredName = byCode.get(hovered)?.name ?? US_STATES[hovered] ?? hovered

  return (
    <motion.main
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.25 }}
      className="px-8 py-5"
    >
      <div className="flex flex-wrap items-end gap-5">
        <div>
          <div className="mb-1 font-mono text-[11px] font-bold uppercase tracking-[1.5px] text-ink-muted">
            50 states + 1 district · a living index
          </div>
          <h1 className="font-display text-[64px] font-black uppercase leading-[0.9] tracking-[-2px] text-ink">
            The periodic table of plates.
          </h1>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2.5">
          <Pill bg={PG.c.mustardLite}>{unlocked} / 51 UNLOCKED</Pill>
          <Pill bg={PG.c.paper}>{total.toLocaleString()} TOTAL PLATES</Pill>
        </div>
      </div>

      <div className="mt-3.5 mb-3.5 flex flex-wrap items-center gap-3.5 font-mono text-[11px] font-bold uppercase tracking-wide text-ink-soft">
        <span>Legend:</span>
        <LegendSwatch color={PG.c.paperEdge} label="LOCKED" />
        <LegendSwatch color="#e9d8a8" label="1–24 PLATES" />
        <LegendSwatch color={PG.c.mustard} label="25–99" />
        <LegendSwatch color="#e87a47" label="100–249" />
        <LegendSwatch color={PG.c.rust} label="250+" />
        <div className="ml-auto flex items-center gap-1.5 text-ink">
          CURRENTLY VIEWING <StateBadge code={hovered} /> {hoveredName.toUpperCase()} ({hoveredCount})
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* Periodic grid */}
        <div
          className="overflow-hidden rounded-[18px] border-[1.5px] border-rule bg-paper p-6"
          style={{ boxShadow: '0 3px 0 var(--color-rule)' }}
        >
          {isLoading ? (
            <div className="flex h-[540px] items-center justify-center font-mono text-sm text-ink-muted">
              Loading state data…
            </div>
          ) : (
            <div
              className="relative mx-auto"
              style={{
                width: cols * cell + (cols - 1) * gap,
                height: rows * cell + (rows - 1) * gap,
              }}
            >
              {Array.from({ length: cols }).map((_, c) =>
                Array.from({ length: rows }).map((_, r) => (
                  <div
                    key={`bg-${c}-${r}`}
                    className="absolute rounded-md"
                    style={{
                      left: c * (cell + gap),
                      top: r * (cell + gap),
                      width: cell,
                      height: cell,
                      border: `1px dashed ${PG.c.paperEdge}`,
                    }}
                  />
                )),
              )}
              {STATE_GRID.map((s) => {
                const cnt = byCode.get(s.c)?.count ?? 0
                const locked = cnt === 0
                const bg = volColor(cnt)
                const isHot = cnt >= 250
                const fg = isHot ? PG.c.cream : PG.c.ink
                const active = s.c === hovered
                return (
                  <button
                    key={s.c}
                    type="button"
                    onMouseEnter={() => setHovered(s.c)}
                    onFocus={() => setHovered(s.c)}
                    onClick={() => !locked && navigate(`/states/${s.c}`)}
                    aria-label={`${s.name}: ${cnt} plates`}
                    className={clsx(
                      'absolute flex flex-col justify-between rounded-md p-1.5 text-left transition-transform',
                      locked ? 'cursor-not-allowed' : 'cursor-pointer hover:-translate-y-0.5',
                    )}
                    style={{
                      left: (s.col - 1) * (cell + gap),
                      top: (s.row - 1) * (cell + gap),
                      width: cell,
                      height: cell,
                      background: bg,
                      border: active ? `2.5px solid ${PG.c.ink}` : `1.5px solid ${PG.c.rule}`,
                      boxShadow: active ? `0 4px 0 ${PG.c.ink}` : locked ? 'none' : `0 2px 0 ${PG.c.rule}`,
                      opacity: locked ? 0.6 : 1,
                      transform: active ? 'translateY(-2px)' : undefined,
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <span className="font-mono text-[9px] font-bold" style={{ color: fg, opacity: 0.65 }}>
                        {s.col}·{s.row}
                      </span>
                      {locked && <span className="text-[10px]">🔒</span>}
                    </div>
                    <div>
                      <div
                        className="font-display text-[24px] font-black leading-[0.85] tracking-tight"
                        style={{ color: fg }}
                      >
                        {s.c}
                      </div>
                      <div
                        className="mt-0.5 font-mono text-[9px] font-bold"
                        style={{ color: fg, opacity: 0.75 }}
                      >
                        {locked ? '— — —' : String(cnt).padStart(3, '0')}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick peek panel */}
        <QuickPeek code={hovered} name={hoveredName} count={hoveredCount} />
      </div>
    </motion.main>
  )
}
