import { Link } from 'react-router-dom'
import { useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Plate } from '@/lib/types'
import { PhotoSnap } from './PhotoSnap'
import { StateBadge } from './StateBadge'
import { VoteControl } from './VoteControl'
import { useVote, useToggleFavorite } from '@/hooks/useApi'
import { queryKeys } from '@/lib/queryKeys'
import { useAuth } from '@/hooks/AuthContext'

function relativeTime(iso: string) {
  const d = new Date(iso)
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

export function PlateCard({ plate }: { plate: Plate; priority?: boolean }) {
  const queryClient = useQueryClient()
  const voteMutation = useVote(plate.id)
  const favMutation = useToggleFavorite(plate.id)
  const { user } = useAuth()
  const voteInFlight = useRef(false)

  function applyVoteDelta(list: Plate[] | undefined, id: string, value: 1 | -1 | 0, prev: 1 | -1 | 0): Plate[] | undefined {
    if (!list) return list
    return list.map((p) => {
      if (p.id !== id) return p
      const delta = value - prev
      return {
        ...p,
        user_vote: value,
        score: p.score + delta,
        upvotes: p.upvotes + (value === 1 ? 1 : 0) - (prev === 1 ? 1 : 0),
        downvotes: p.downvotes + (value === -1 ? 1 : 0) - (prev === -1 ? 1 : 0),
      }
    })
  }

  function handleVote(value: 1 | -1 | 0) {
    if (voteInFlight.current) return
    voteInFlight.current = true
    const prev = plate.user_vote

    queryClient.setQueriesData(
      { queryKey: queryKeys.plates.all },
      (old: unknown) => {
        if (!old) return old
        // Paginated feed data
        if (typeof old === 'object' && 'pages' in (old as object)) {
          const paged = old as { pages: { items: Plate[] }[] }
          return {
            ...paged,
            pages: paged.pages.map((pg) => ({ ...pg, items: applyVoteDelta(pg.items, plate.id, value, prev) || [] })),
          }
        }
        // Leaderboard / single-list response
        if (typeof old === 'object' && 'items' in (old as object)) {
          const listed = old as { items: Plate[] }
          return { ...listed, items: applyVoteDelta(listed.items, plate.id, value, prev) || [] }
        }
        return old
      },
    )

    voteMutation.mutate(value, {
      onSettled: () => { voteInFlight.current = false },
    })
  }

  function handleFav(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!user) return
    favMutation.mutate()
  }

  return (
    <article
      className="grid grid-cols-[320px_1fr] overflow-hidden rounded-2xl border-[1.5px] border-rule bg-paper"
      style={{ boxShadow: '0 2px 0 var(--color-rule)' }}
    >
      <Link to={`/plate/${plate.id}`} className="relative block bg-ink">
        <PhotoSnap
          plate={plate.plate_text}
          state={plate.state_code}
          width={320}
          height={260}
          imageUrl={plate.image_thumb_url || plate.image_url}
          alt={`${plate.plate_text} · ${plate.state_name}`}
        />
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-md bg-[rgba(15,13,9,0.72)] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-cream">
          <span className="text-mustard">●</span> IN THE WILD · {relativeTime(plate.created_at)} AGO
        </div>
        <div className="absolute top-2.5 right-2.5">
          <StateBadge code={plate.state_code} />
        </div>
      </Link>

      <div className="flex flex-col p-5">
        <div className="flex items-center gap-2.5">
          {plate.author?.avatar_url ? (
            <img
              src={plate.author.avatar_url}
              alt=""
              referrerPolicy="no-referrer"
              className="h-[30px] w-[30px] rounded-full border-[1.5px] border-rule object-cover"
            />
          ) : (
            <div className="flex h-[30px] w-[30px] items-center justify-center rounded-full border-[1.5px] border-rule bg-cobalt-lite text-[12px] font-extrabold text-cream">
              {(plate.author?.display_name || '?').slice(0, 2).toUpperCase()}
            </div>
          )}
          <span className="text-[13px] font-bold text-ink">
            @{plate.author?.display_name ?? 'anonymous'}
          </span>
          <span className="ml-auto text-[18px] tracking-[2px] text-ink-muted">···</span>
        </div>

        <Link to={`/plate/${plate.id}`} className="mt-3">
          <div className="font-display text-[42px] font-black leading-[0.95] tracking-tight text-ink">
            “{plate.plate_text}”
          </div>
        </Link>

        {plate.caption && (
          <p className="mt-1.5 text-[13px] font-medium leading-[1.4] text-ink-soft">
            {plate.caption}
          </p>
        )}

        <div className="mt-auto flex items-center gap-2.5 pt-4">
          <VoteControl
            score={plate.score}
            userVote={plate.user_vote}
            onVote={handleVote}
            disabled={voteMutation.isPending}
          />
          <Link
            to={`/plate/${plate.id}`}
            className="flex h-9 items-center gap-1.5 rounded-full border-[1.5px] border-rule bg-cream px-3.5 text-[13px] font-bold text-ink"
          >
            💬 {plate.comment_count}
          </Link>
          <button
            type="button"
            onClick={handleFav}
            disabled={favMutation.isPending}
            className="flex h-9 items-center gap-1.5 rounded-full border-[1.5px] border-rule bg-cream px-3.5 text-[13px] font-bold text-ink disabled:opacity-60"
            aria-label={plate.is_favorited ? 'Remove from favorites' : 'Save'}
            aria-pressed={!!plate.is_favorited}
          >
            <span className={plate.is_favorited ? 'text-rust' : ''}>{plate.is_favorited ? '♥' : '♡'}</span>
            {plate.is_favorited ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
    </article>
  )
}
