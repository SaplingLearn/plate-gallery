import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { useAuth } from '@/hooks/AuthContext'
import { useState } from 'react'

interface VoteControlProps {
  score: number
  userVote: 1 | -1 | 0
  onVote: (value: 1 | -1 | 0) => void
  disabled?: boolean
}

export function VoteControl({ score, userVote, onVote, disabled }: VoteControlProps) {
  const { user } = useAuth()
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)

  function handleVote(value: 1 | -1) {
    if (!user) {
      setShowAuthPrompt(true)
      setTimeout(() => setShowAuthPrompt(false), 3000)
      return
    }
    onVote(userVote === value ? 0 : value)
  }

  return (
    <div className="relative flex items-center gap-4">
      <motion.button
        whileTap={{ scale: 1.15 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={() => handleVote(1)}
        disabled={disabled}
        className={clsx(
          'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
          userVote === 1 ? 'bg-sage text-bone' : 'bg-cream text-stone hover:text-charcoal',
        )}
        aria-label="Upvote"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3L3 10h10L8 3z" />
        </svg>
      </motion.button>

      <span className="min-w-[3ch] text-center font-display text-2xl tabular-nums text-charcoal">
        {score}
      </span>

      <motion.button
        whileTap={{ scale: 1.15 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={() => handleVote(-1)}
        disabled={disabled}
        className={clsx(
          'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
          userVote === -1 ? 'bg-oxblood text-bone' : 'bg-cream text-stone hover:text-charcoal',
        )}
        aria-label="Downvote"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 13L3 6h10L8 13z" />
        </svg>
      </motion.button>

      {showAuthPrompt && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="absolute -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-charcoal px-3 py-1.5 text-xs text-bone"
        >
          <a href="/login" className="underline">Sign in</a> to vote
        </motion.div>
      )}
    </div>
  )
}
