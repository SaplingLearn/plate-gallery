import { Link, NavLink, useNavigate } from 'react-router-dom'
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

  const initials = (() => {
    if (!user) return '?'
    const name = (user.user_metadata?.full_name || user.email || '?').toString()
    const parts = name.split(/[\s@.]+/).filter(Boolean)
    return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
  })()

  return (
    <nav className="sticky top-0 z-50 flex h-[72px] items-center gap-8 border-b-[1.5px] border-rule bg-cream px-8">
      <Link to="/" className="flex items-center gap-2.5">
        <LogoMark size={38} />
        <span className="font-display text-[30px] font-black leading-none tracking-tight text-ink">
          PLATE<span className="text-rust">GALLERY</span>
        </span>
      </Link>

      <div className="ml-4 flex gap-1">
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

      <div className="ml-auto hidden h-10 max-w-[320px] flex-1 items-center gap-2 rounded-full border-[1.5px] border-rule bg-paper px-4 text-[13px] font-medium text-ink-muted md:flex">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="6" cy="6" r="4.5" stroke="var(--color-ink-soft)" strokeWidth="1.5" />
          <path d="M9.5 9.5L12 12" stroke="var(--color-ink-soft)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        search plates, states, creators…
      </div>

      <button
        type="button"
        onClick={() => navigate(user ? '/upload' : '/login?next=/upload')}
        className="flex h-11 items-center gap-2 rounded-full bg-rust px-5 font-sans text-[15px] font-extrabold uppercase tracking-wide text-white transition-transform hover:-translate-y-px"
        style={{ boxShadow: '0 3px 0 var(--color-rust-deep), 0 6px 14px rgba(40,26,10,0.22)' }}
      >
        <span className="text-lg leading-none">+</span> POST A PLATE
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
    </nav>
  )
}
