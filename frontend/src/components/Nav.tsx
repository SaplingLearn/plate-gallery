import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import { useAuth } from '@/hooks/AuthContext'
import { LogoMark } from './LogoMark'

const LINKS = [
  { to: '/', label: 'Feed', end: true },
  { to: '/states', label: 'USA Map', end: false },
  { to: '/leaderboard', label: 'Leaderboards', end: false },
  { to: '/about', label: 'About', end: false },
]

export function Nav() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = q.trim()
    if (!trimmed) return
    navigate(`/?q=${encodeURIComponent(trimmed)}`)
  }

  const initials = (() => {
    if (!user) return '?'
    const name = (user.user_metadata?.full_name || user.email || '?').toString()
    const parts = name.split(/[\s@.]+/).filter(Boolean)
    return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
  })()

  return (
    <nav className="sticky top-0 z-50 flex h-[72px] items-center gap-3 border-b-[1.5px] border-rule bg-cream px-4 lg:gap-8 lg:px-8">
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setMenuOpen(true)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-rule bg-paper text-lg text-ink lg:hidden"
      >
        ☰
      </button>
      <Link to="/" className="flex items-center gap-2.5">
        <LogoMark size={38} />
        <span className="font-display text-[30px] font-black leading-none tracking-tight text-ink">
          PLATE<span className="text-rust">GALLERY</span>
        </span>
      </Link>

      <div className="ml-4 hidden gap-1 lg:flex">
        {LINKS.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) =>
              clsx(
                'rounded-full border-[1.5px] px-3.5 py-2 font-sans text-[15px] font-bold transition-colors',
                isActive
                  ? 'border-rule bg-paper text-ink'
                  : 'border-transparent text-ink-soft hover:text-ink',
              )
            }
          >
            {l.label}
          </NavLink>
        ))}
      </div>

      <form
        onSubmit={handleSearch}
        className="ml-auto hidden h-10 max-w-[320px] flex-1 items-center gap-2 rounded-full border-[1.5px] border-rule bg-paper px-4 text-[13px] font-medium text-ink md:flex"
        role="search"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="6" cy="6" r="4.5" stroke="var(--color-ink-soft)" strokeWidth="1.5" />
          <path d="M9.5 9.5L12 12" stroke="var(--color-ink-soft)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="search plates…"
          className="h-full w-full bg-transparent text-[13px] font-medium text-ink placeholder:text-ink-muted focus:outline-none"
          aria-label="Search plates"
        />
      </form>

      <button
        type="button"
        onClick={() => navigate(user ? '/upload' : '/login?next=/upload')}
        className="ml-auto flex h-11 items-center gap-2 rounded-full bg-rust px-3 font-sans text-[15px] font-extrabold uppercase tracking-wide text-white transition-transform hover:-translate-y-px md:ml-0 lg:px-5"
        style={{ boxShadow: '0 3px 0 var(--color-rust-deep), 0 6px 14px rgba(40,26,10,0.22)' }}
      >
        <span className="text-lg leading-none">+</span>
        <span className="hidden lg:inline">POST A PLATE</span>
      </button>

      {!loading && user ? (
        <Link
          to="/profile"
          aria-label="Profile"
          className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-[1.5px] border-rule bg-cobalt text-sm font-extrabold text-white"
        >
          {user.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
          ) : (
            <span>{initials}</span>
          )}
        </Link>
      ) : !loading ? (
        <Link
          to="/login"
          className="shrink-0 rounded-full border-[1.5px] border-rule bg-paper px-4 py-2 font-sans text-[13px] font-bold text-ink"
        >
          Sign in
        </Link>
      ) : null}

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              className="fixed left-0 top-0 z-50 flex h-full w-[260px] max-w-[80vw] flex-col gap-2 overflow-y-auto bg-cream p-4 lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
            >
              {LINKS.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      'rounded-full border-[1.5px] px-4 py-2.5 font-sans text-[15px] font-bold',
                      isActive ? 'border-rule bg-paper text-ink' : 'border-transparent text-ink-soft',
                    )
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  )
}
