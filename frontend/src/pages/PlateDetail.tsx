import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQueryClient } from '@tanstack/react-query'
import { Eyebrow } from '@/components/Eyebrow'
import { RevealOnScroll } from '@/components/RevealOnScroll'
import { VoteControl } from '@/components/VoteControl'
import { PlateCard } from '@/components/PlateCard'
import { Divider } from '@/components/Divider'
import { usePlateDetail, useVote, useComments, useCreateComment } from '@/hooks/useApi'
import { useAuth } from '@/hooks/AuthContext'
import { queryKeys } from '@/lib/queryKeys'
import type { PlateDetail as PlateDetailType } from '@/lib/types'
import { useState } from 'react'

export default function PlateDetail() {
  const { id } = useParams<{ id: string }>()
  const { data: plate, isLoading } = usePlateDetail(id!)
  const voteMutation = useVote(id!)
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const { data: commentsData } = useComments(id!)
  const createCommentMutation = useCreateComment(id!)
  const [commentBody, setCommentBody] = useState('')
  const comments = commentsData?.pages.flatMap((p) => p.items) ?? []

  function handleVote(value: 1 | -1 | 0) {
    if (!plate) return

    // Optimistic update
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
      onError: () => {
        queryClient.setQueryData(queryKeys.plates.detail(id!), prev)
      },
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
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex min-h-screen items-center justify-center pt-20"
      >
        <p className="font-display text-lg text-stone">Loading...</p>
      </motion.main>
    )
  }

  if (!plate) {
    return (
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex min-h-screen items-center justify-center pt-20"
      >
        <div className="text-center">
          <h1 className="font-display text-3xl text-charcoal">Plate not found</h1>
          <Link to="/gallery" className="link-draw mt-4 inline-block text-sm text-oxblood">
            Back to gallery <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </motion.main>
    )
  }

  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.3 }}
      className="pt-20 pb-16"
    >
      <div className="lg:flex">
        {/* Image column */}
        <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-5rem)] lg:w-[60%]">
          <img
            src={plate.image_url}
            alt={`Vanity plate reading '${plate.plate_text}' from ${plate.state_name}`}
            className="h-full w-full object-cover"
          />
        </div>

        {/* Content column */}
        <div className="px-6 py-12 lg:w-[40%] lg:px-12">
          <RevealOnScroll>
            <Eyebrow>{plate.state_name}</Eyebrow>
            <h1 className="mt-4 font-display text-5xl tracking-tight text-charcoal md:text-6xl">
              {plate.plate_text}
            </h1>

            <div className="mt-4 flex items-center gap-2 text-sm text-stone">
              {plate.author && (
                <>
                  {plate.author.avatar_url && (
                    <img src={plate.author.avatar_url} alt="" className="h-5 w-5 rounded-full" />
                  )}
                  <span>{plate.author.display_name}</span>
                  <span aria-hidden="true">&middot;</span>
                </>
              )}
              <span>{new Date(plate.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
            </div>

            {plate.caption && (
              <blockquote className="mt-6 font-display text-lg italic text-ink/80">
                "{plate.caption}"
              </blockquote>
            )}
          </RevealOnScroll>

          <RevealOnScroll delay={0.1}>
            <div className="mt-10">
              <VoteControl
                score={plate.score}
                userVote={plate.user_vote}
                onVote={handleVote}
                disabled={voteMutation.isPending}
              />
            </div>
          </RevealOnScroll>

          {/* Comments */}
          {plate.comments_enabled && (
            <RevealOnScroll delay={0.2}>
              <Divider />
              <h3 className="font-sans text-xs uppercase tracking-[0.2em] text-stone">
                Comments ({plate.comment_count})
              </h3>

              {user && (
                <form onSubmit={handleSubmitComment} className="mt-4 flex gap-3">
                  <input
                    type="text"
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    placeholder="Add a comment..."
                    maxLength={500}
                    className="flex-1 border-b border-border bg-transparent py-2 font-sans text-sm text-ink outline-none placeholder:text-stone/40 focus:border-charcoal"
                  />
                  <button
                    type="submit"
                    disabled={!commentBody.trim() || createCommentMutation.isPending}
                    className="font-sans text-sm text-oxblood disabled:opacity-40"
                  >
                    Post
                  </button>
                </form>
              )}

              <div className="mt-6 space-y-6">
                {comments.map((comment) => (
                  <div key={comment.id}>
                    <div className="flex items-center gap-2 text-xs text-stone">
                      {comment.author.avatar_url && (
                        <img src={comment.author.avatar_url} alt="" className="h-4 w-4 rounded-full" />
                      )}
                      <span className="font-medium text-ink">{comment.author.display_name}</span>
                      <span>&middot;</span>
                      <span>{new Date(comment.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="mt-1 text-sm text-ink">{comment.body}</p>
                  </div>
                ))}
              </div>
            </RevealOnScroll>
          )}

          {/* Related plates */}
          {plate.related_plates && plate.related_plates.length > 0 && (
            <RevealOnScroll delay={0.3}>
              <Divider />
              <Eyebrow>More from {plate.state_name}</Eyebrow>
              <div className="mt-6 grid grid-cols-2 gap-4">
                {plate.related_plates.map((rp) => (
                  <PlateCard key={rp.id} plate={rp} />
                ))}
              </div>
            </RevealOnScroll>
          )}
        </div>
      </div>
    </motion.main>
  )
}
