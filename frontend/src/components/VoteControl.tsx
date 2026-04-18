import { clsx } from 'clsx'
import { useState } from 'react'
import { useAuth } from '@/hooks/AuthContext'

interface VoteControlProps {
  score: number
  userVote: 1 | -1 | 0
  onVote: (value: 1 | -1 | 0) => void
  disabled?: boolean
  size?: 'sm' | 'md'
}

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
    <div
      className="relative inline-flex items-center gap-0.5 rounded-full border-[1.5px] border-rule bg-cream p-[3px]"
    >
      <button
        type="button"
        onClick={() => handleVote(1)}
        disabled={disabled}
        aria-label="Upvote"
        aria-pressed={userVote === 1}
        className={clsx(
          'flex items-center justify-center rounded-full font-black leading-none transition-colors disabled:opacity-60',
          btn,
          userVote === 1 ? 'bg-rust text-white' : 'bg-rust/95 text-white hover:bg-rust',
        )}
      >
        ▲
      </button>
      <span className={clsx('text-center font-display font-black tabular-nums tracking-tight text-ink', num)}>
        {score}
      </span>
      <button
        type="button"
        onClick={() => handleVote(-1)}
        disabled={disabled}
        aria-label="Downvote"
        aria-pressed={userVote === -1}
        className={clsx(
          'flex items-center justify-center rounded-full font-black leading-none transition-colors disabled:opacity-60',
          btn,
          userVote === -1 ? 'bg-ink text-cream' : 'bg-paper text-ink-soft hover:bg-paper-edge',
        )}
      >
        ▼
      </button>
      {showAuthPrompt && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-3 py-1.5 text-xs font-bold text-cream shadow-lg">
          <a href="/login" className="underline">Sign in</a> to vote
        </div>
      )}
    </div>
  )
}
