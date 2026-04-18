import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { useState, useRef } from 'react'
import { usePlateDetail, useVote, useComments, useCreateComment, useToggleFavorite } from '@/hooks/useApi'
import { useAuth } from '@/hooks/AuthContext'
import { queryKeys } from '@/lib/queryKeys'
import type { PlateDetail as PlateDetailType } from '@/lib/types'
import { PhotoSnap } from '@/components/PhotoSnap'
import { Plate } from '@/components/Plate'
import { Pill } from '@/components/Pill'
import { PG } from '@/lib/design'

function MetaStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] font-bold uppercase tracking-[0.8px] text-ink-muted">
        {label}
      </div>
      <div
        className="font-display text-[26px] font-black leading-none tracking-tight"
        style={{ color: accent ?? PG.c.ink }}
      >
        {value}
      </div>
    </div>
  )
}

export default function PlateDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: plate, isLoading } = usePlateDetail(id!)
  const voteMutation = useVote(id!)
  const favoriteMutation = useToggleFavorite(id!)
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const { data: commentsData } = useComments(id!)
  const createCommentMutation = useCreateComment(id!)
  const [commentBody, setCommentBody] = useState('')
  const comments = commentsData?.pages.flatMap((p) => p.items) ?? []
  const voteInFlight = useRef(false)

  function handleVote(value: 1 | -1 | 0) {
    if (!plate || voteInFlight.current) return
    voteInFlight.current = true

    const prev = plate
    const delta = value - plate.user_vote
    queryClient.setQueryData(queryKeys.plates.detail(id!), (old: PlateDetailType | undefined) => {
      if (!old) return old
      return {
        ...old,
        user_vote: value,
        score: old.score + delta,
        upvotes: old.upvotes + (value === 1 ? 1 : 0) - (prev.user_vote === 1 ? 1 : 0),
        downvotes: old.downvotes + (value === -1 ? 1 : 0) - (prev.user_vote === -1 ? 1 : 0),
      }
    })

    voteMutation.mutate(value, {
      onSettled: () => { voteInFlight.current = false },
      onError: () => queryClient.setQueryData(queryKeys.plates.detail(id!), prev),
    })
  }

  function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentBody.trim()) return
    createCommentMutation.mutate(commentBody.trim(), {
      onSuccess: () => setCommentBody(''),
    })
  }

  if (isLoading) {
    return (
      <main className="flex min-h-[calc(100vh-72px)] items-center justify-center">
        <p className="font-mono text-sm text-ink-muted">Loading…</p>
      </main>
    )
  }

  if (!plate) {
    return (
      <main className="flex min-h-[calc(100vh-72px)] items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-5xl font-black tracking-tight text-ink">Plate not found</h1>
          <Link to="/" className="mt-4 inline-block font-bold text-rust">← Back to the feed</Link>
        </div>
      </main>
    )
  }

  const userInitial = (n: string) => n.slice(0, 2).toUpperCase()

  return (
    <motion.main
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.25 }}
      className="px-8 py-5"
    >
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-2.5 font-mono text-[11px] font-bold uppercase tracking-wide text-ink-soft">
        <Link to="/" className="hover:text-ink">Home</Link>
        <span className="text-ink-muted">/</span>
        <Link to={`/states/${plate.state_code}`} className="hover:text-ink">{plate.state_name}</Link>
        <span className="text-ink-muted">/</span>
        <span className="text-ink">“{plate.plate_text}”</span>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        {/* Photo panel */}
        <section
          className="flex flex-col overflow-hidden rounded-[18px] border-[1.5px] border-rule bg-paper p-5"
          style={{ boxShadow: '0 3px 0 var(--color-rule)' }}
        >
          <div className="mb-3 flex items-end gap-4">
            <div className="font-display text-[72px] font-black leading-[0.85] tracking-[-2px] text-ink">
              “{plate.plate_text}”
            </div>
            <div className="flex-1">
              <Pill bg={PG.c.rust} fg={PG.c.cream}>{plate.state_code} · PLATE</Pill>
            </div>
          </div>

          <div className="mb-4 text-[14px] font-semibold text-ink-soft">
            Spotted {new Date(plate.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            {plate.author && <> · by <strong className="text-ink">@{plate.author.display_name}</strong></>}
          </div>

          <div className="relative flex-1 overflow-hidden rounded-xl border-[1.5px] border-rule">
            <PhotoSnap
              plate={plate.plate_text}
              state={plate.state_code}
              width={700}
              height={420}
              imageUrl={plate.image_url}
              alt={`Vanity plate ${plate.plate_text} from ${plate.state_name}`}
            />
            <div className="absolute top-3.5 left-3.5 rounded-md bg-ink px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-mustard">
              📍 {plate.state_name}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-6 rounded-xl border-[1.5px] border-rule bg-cream px-4 py-3">
            <MetaStat label="UPVOTES" value={plate.upvotes.toLocaleString()} accent={PG.c.rust} />
            <MetaStat label="COMMENTS" value={plate.comment_count.toLocaleString()} />
            <MetaStat label="SCORE" value={plate.score.toLocaleString()} />
            <MetaStat label="STATE" value={plate.state_code} accent={PG.c.cobalt} />
            <div className="ml-auto flex gap-2">
              <Pill bg={PG.c.mustardLite}>✓ AUTO-MODERATED</Pill>
            </div>
          </div>
        </section>

        {/* Side panel */}
        <div className="flex flex-col gap-4">
          {/* Vote strip */}
          <div className="flex items-center gap-4 rounded-[14px] border-[1.5px] border-rule bg-ink p-5 text-cream">
            <div className="font-display text-[48px] font-black leading-[0.9] tracking-tight text-mustard">
              {plate.score.toLocaleString()}
            </div>
            <div className="text-[12px] font-bold leading-snug">
              score · {plate.upvotes.toLocaleString()} upvotes
              <br />
              <span className="text-mustard">{plate.downvotes.toLocaleString()} downvotes</span>
            </div>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => handleVote(plate.user_vote === 1 ? 0 : 1)}
                disabled={!user || voteMutation.isPending}
                aria-pressed={plate.user_vote === 1}
                className="h-11 rounded-full border-[1.5px] border-rule bg-rust px-4 font-sans text-[14px] font-black text-white disabled:opacity-60"
              >
                ▲ UPVOTE
              </button>
              <button
                type="button"
                onClick={() => handleVote(plate.user_vote === -1 ? 0 : -1)}
                disabled={!user || voteMutation.isPending}
                aria-pressed={plate.user_vote === -1}
                className="h-11 w-11 rounded-full border-[1.5px] border-rule bg-paper text-[14px] font-black text-ink disabled:opacity-60"
              >
                ▼
              </button>
              {user && (
                <button
                  type="button"
                  onClick={() => favoriteMutation.mutate()}
                  disabled={favoriteMutation.isPending}
                  aria-pressed={!!plate.is_favorited}
                  className="h-11 w-11 rounded-full border-[1.5px] border-rule bg-paper text-[18px] text-rust disabled:opacity-60"
                >
                  {plate.is_favorited ? '♥' : '♡'}
                </button>
              )}
            </div>
          </div>

          {/* Vectorized plate */}
          <div
            className="rounded-[14px] border-[1.5px] border-rule bg-paper p-4"
            style={{ boxShadow: '0 3px 0 var(--color-rule)' }}
          >
            <div className="mb-2.5 font-mono text-[10px] font-bold uppercase tracking-[1.5px] text-ink-muted">
              The plate · vectorized
            </div>
            <div className="flex justify-center">
              <Plate text={plate.plate_text} state={plate.state_code} width={440} />
            </div>
          </div>

          {/* Comments */}
          {plate.comments_enabled && (
            <div
              className="rounded-[14px] border-[1.5px] border-rule bg-paper p-4"
              style={{ boxShadow: '0 3px 0 var(--color-rule)' }}
            >
              <div className="mb-3 flex items-baseline gap-2">
                <div className="font-display text-[24px] font-black tracking-tight text-ink">COMMENTS</div>
                <div className="text-[12px] font-bold text-ink-soft">{plate.comment_count} · sorted by newest</div>
              </div>
              {comments.map((c, i) => (
                <div
                  key={c.id}
                  className="flex gap-3 py-2.5"
                  style={{ borderTop: i === 0 ? 'none' : '1px dashed var(--color-paper-edge)' }}
                >
                  {c.author.avatar_url ? (
                    <img
                      src={c.author.avatar_url}
                      alt=""
                      referrerPolicy="no-referrer"
                      className="h-7 w-7 shrink-0 rounded-full border-[1.5px] border-rule object-cover"
                    />
                  ) : (
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-cream"
                      style={{ background: [PG.c.rust, PG.c.cobalt, PG.c.mustard][i % 3] }}
                    >
                      {userInitial(c.author.display_name)}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="text-[12px] font-extrabold text-ink">@{c.author.display_name}</div>
                    <div className="mt-0.5 text-[13px] leading-snug text-ink">{c.body}</div>
                    <div className="mt-1 font-mono text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                      {new Date(c.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
              {user ? (
                <form onSubmit={handleSubmitComment} className="mt-3 flex items-center gap-2.5 rounded-lg border-[1.5px] border-rule bg-cream px-3 py-2.5">
                  <input
                    type="text"
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    maxLength={500}
                    placeholder="say something nice…"
                    className="flex-1 bg-transparent text-[13px] font-medium text-ink outline-none placeholder:text-ink-muted"
                  />
                  <button
                    type="submit"
                    disabled={!commentBody.trim() || createCommentMutation.isPending}
                    className="rounded-full bg-ink px-3 py-1 text-[11px] font-extrabold uppercase text-cream disabled:opacity-40"
                  >
                    Post
                  </button>
                </form>
              ) : (
                <div className="mt-3 rounded-lg border-[1.5px] border-dashed border-rule bg-cream px-3 py-2.5 text-center text-[12px] font-semibold text-ink-soft">
                  <Link to="/login" className="font-extrabold text-rust">Sign in</Link> to comment.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.main>
  )
}
