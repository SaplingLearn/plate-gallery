import { clsx } from 'clsx'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/AuthContext'

interface VoteControlProps {
  score: number
  userVote: 1 | -1 | 0
  onVote: (value: 1 | -1 | 0) => void
  disabled?: boolean
  size?: 'sm' | 'md'
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const

export function VoteControl({ score, userVote, onVote, disabled, size = 'md' }: VoteControlProps) {
  const { user } = useAuth()
  const [showAuthPrompt, setShowAuthPrompt] = useState(false)
  const btn = size === 'sm' ? 'h-7 w-7 text-[14px]' : 'h-9 w-9 text-[18px]'
  const num = size === 'sm' ? 'text-[16px] px-2.5 min-w-[32px]' : 'text-[22px] px-3 min-w-[40px]'

  function handleVote(value: 1 | -1) {
    if (!user) {
      setShowAuthPrompt(true)
      setTimeout(() => setShowAuthPrompt(false), 2500)
      return
    }
    onVote(userVote === value ? 0 : value)
  }

  return (
    <div className="relative inline-flex items-center gap-0.5 rounded-full border-[1.5px] border-rule bg-cream p-[3px]">
      <motion.button
        type="button"
        onClick={() => handleVote(1)}
        disabled={disabled}
        aria-label="Upvote"
        aria-pressed={userVote === 1}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.85 }}
        transition={{ duration: 0.15, ease: EASE_OUT }}
        className={clsx(
          'flex items-center justify-center rounded-full font-black leading-none transition-colors disabled:opacity-60',
          btn,
          userVote === 1 ? 'bg-rust text-white' : 'bg-rust/95 text-white hover:bg-rust',
        )}
      >
        <motion.span
          key={`up-${userVote === 1}`}
          initial={userVote === 1 ? { y: 6, scale: 0.6 } : false}
          animate={userVote === 1 ? { y: [-3, 0], scale: [1.3, 1] } : { y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
          className="inline-block"
        >
          ▲
        </motion.span>
      </motion.button>

      <div className={clsx('relative flex items-center justify-center overflow-hidden', num)}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={score}
            initial={{ y: 14, opacity: 0, scale: 0.85 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -14, opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.22, ease: EASE_OUT }}
            className="block font-display font-black tabular-nums tracking-tight text-ink"
          >
            {score}
          </motion.span>
        </AnimatePresence>
      </div>

      <motion.button
        type="button"
        onClick={() => handleVote(-1)}
        disabled={disabled}
        aria-label="Downvote"
        aria-pressed={userVote === -1}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.85 }}
        transition={{ duration: 0.15, ease: EASE_OUT }}
        className={clsx(
          'flex items-center justify-center rounded-full font-black leading-none transition-colors disabled:opacity-60',
          btn,
          userVote === -1 ? 'bg-ink text-cream' : 'bg-paper text-ink-soft hover:bg-paper-edge',
        )}
      >
        <motion.span
          key={`down-${userVote === -1}`}
          initial={userVote === -1 ? { y: -6, scale: 0.6 } : false}
          animate={userVote === -1 ? { y: [3, 0], scale: [1.3, 1] } : { y: 0, scale: 1 }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
          className="inline-block"
        >
          ▼
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {showAuthPrompt && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.94 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-3 py-1.5 text-xs font-bold text-cream shadow-lg"
          >
            <a href="/login" className="underline">Sign in</a> to vote
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
