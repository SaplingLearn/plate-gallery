import { Link, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import { useAuth } from '@/hooks/AuthContext'

const NAV_LINKS = [
  { to: '/gallery', label: 'Gallery' },
  { to: '/states', label: 'Map' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/upload', label: 'Upload' },
]

export function Nav() {
  const location = useLocation()
  const { user, loading } = useAuth()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[rgba(244,240,232,0.85)] backdrop-blur-[12px]">
      <div className="absolute bottom-0 left-0 right-0 h-px bg-border" />
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 md:px-12">
        <Link to="/" className="font-display text-xl text-charcoal tracking-tight">
          PlateGallery
        </Link>

        <div className="flex items-center gap-8">
          {NAV_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={clsx(
                'link-draw hidden font-sans text-sm md:block',
                location.pathname.startsWith(to) ? 'text-charcoal' : 'text-stone hover:text-charcoal'
              )}
            >
              {label}
            </Link>
          ))}
          {!loading && (
            user ? (
              <Link to="/profile" className="flex items-center gap-2">
                {user.user_metadata?.avatar_url ? (
                  <img
                    src={user.user_metadata.avatar_url}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-7 w-7 rounded-full"
                  />
                ) : (
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-cream text-xs font-medium text-stone">
                    {(user.user_metadata?.full_name || user.email || '?')[0].toUpperCase()}
                  </div>
                )}
              </Link>
            ) : (
              <Link
                to="/login"
                className="font-sans text-sm text-stone hover:text-charcoal link-draw"
              >
                Sign in
              </Link>
            )
          )}
        </div>
      </div>
    </nav>
  )
}
