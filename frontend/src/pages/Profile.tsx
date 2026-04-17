import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { useQueryClient } from '@tanstack/react-query'
import { Container } from '@/components/Container'
import { Eyebrow } from '@/components/Eyebrow'
import { RevealOnScroll } from '@/components/RevealOnScroll'
import { PlateCard } from '@/components/PlateCard'
import { useRequireAuth } from '@/hooks/useRequireAuth'
import { useMyPlates, useMyVotes } from '@/hooks/useApi'
import { signOut } from '@/lib/supabase'

type Tab = 'plates' | 'votes'

export default function Profile() {
  const { user, loading } = useRequireAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<Tab>('plates')

  const { data: platesData } = useMyPlates()
  const { data: votesData } = useMyVotes()

  const plates = platesData?.pages.flatMap((p) => p.items) ?? []
  const votes = votesData?.pages.flatMap((p) => p.items) ?? []

  async function handleSignOut() {
    await signOut()
    queryClient.clear()
    navigate('/')
  }

  if (loading || !user) return null

  const displayName = user.user_metadata?.full_name || user.email || 'User'
  const avatarUrl = user.user_metadata?.avatar_url

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
          <div className="flex items-center gap-6">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-16 w-16 rounded-full" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-cream text-xl font-medium text-stone">
                {displayName[0].toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="font-display text-3xl text-charcoal">{displayName}</h1>
              <Eyebrow className="mt-1">
                Member since {new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </Eyebrow>
            </div>
            <button
              onClick={handleSignOut}
              className="ml-auto rounded-sm border border-border px-4 py-2 font-sans text-xs text-stone transition-colors hover:text-charcoal"
            >
              Sign out
            </button>
          </div>
        </RevealOnScroll>

        {/* Tabs */}
        <div className="mt-10 flex gap-1 border-b border-border">
          {(['plates', 'votes'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx(
                'border-b-2 px-4 py-3 font-sans text-sm capitalize transition-colors',
                tab === t
                  ? 'border-charcoal text-charcoal'
                  : 'border-transparent text-stone hover:text-charcoal',
              )}
            >
              My {t}
            </button>
          ))}
        </div>

        {tab === 'plates' && (
          <div className="mt-10">
            {plates.length > 0 ? (
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {plates.map((plate) => (
                  <div key={plate.id} className="relative">
                    <PlateCard plate={plate} />
                    {plate.status === 'rejected' && (
                      <div className="absolute top-3 right-3 rounded-full bg-oxblood/90 px-2 py-0.5 text-[10px] font-medium text-bone">
                        Rejected{plate.rejection_reason && `: ${plate.rejection_reason.replace('_', ' ')}`}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center">
                <p className="text-sm text-stone">You haven't uploaded any plates yet.</p>
                <a href="/upload" className="link-draw mt-4 inline-block text-sm text-oxblood">
                  Upload your first plate <span aria-hidden="true">&rarr;</span>
                </a>
              </div>
            )}
          </div>
        )}

        {tab === 'votes' && (
          <div className="mt-10">
            {votes.length > 0 ? (
              <div className="space-y-0">
                {votes.map((vote) => (
                  <a
                    key={vote.plate.id}
                    href={`/plate/${vote.plate.id}`}
                    className="flex items-center gap-4 border-b border-border py-4 transition-colors hover:bg-cream/50"
                  >
                    <span className={clsx(
                      'flex h-8 w-8 items-center justify-center rounded-full text-sm',
                      vote.value === 1 ? 'bg-sage text-bone' : 'bg-oxblood/10 text-oxblood',
                    )}>
                      {vote.value === 1 ? '+' : '-'}
                    </span>
                    <img
                      src={vote.plate.image_thumb_url || vote.plate.image_url}
                      alt=""
                      className="h-10 w-10 rounded-sm object-cover"
                    />
                    <div className="flex-1">
                      <span className="font-display text-lg text-charcoal">{vote.plate.plate_text}</span>
                      <span className="ml-2 text-xs text-stone">{vote.plate.state_code}</span>
                    </div>
                    <span className="text-xs text-stone">
                      {new Date(vote.voted_at).toLocaleDateString()}
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center">
                <p className="text-sm text-stone">You haven't voted on any plates yet.</p>
                <a href="/gallery" className="link-draw mt-4 inline-block text-sm text-oxblood">
                  Browse the gallery <span aria-hidden="true">&rarr;</span>
                </a>
              </div>
            )}
          </div>
        )}
      </Container>
    </motion.main>
  )
}
