import { useSearchParams, Navigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { signInWithGoogle } from '@/lib/supabase'
import { useAuth } from '@/hooks/AuthContext'
import { LogoMark } from '@/components/LogoMark'
import { Plate as PlateSvg } from '@/components/Plate'

export default function Login() {
  const [searchParams] = useSearchParams()
  const { user, loading } = useAuth()
  const next = searchParams.get('next') || '/'

  if (!loading && user) {
    return <Navigate to={next} replace />
  }

  return (
    <motion.main
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.25 }}
      className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-cream px-6 py-10"
    >
      <div
        className="w-full max-w-[420px] overflow-hidden rounded-[22px] border-[1.5px] border-rule bg-paper p-8 text-center"
        style={{ boxShadow: '0 4px 0 var(--color-rule)' }}
      >
        <div className="mx-auto flex w-fit items-center gap-2.5">
          <LogoMark size={48} />
          <div className="text-left font-display text-[34px] font-black leading-[0.88] tracking-[-1px] text-ink">
            PLATE<span className="text-rust">GALLERY</span>
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <PlateSvg text="WELCOME" state="CA" width={240} tilt={-2} />
        </div>

        <h1 className="mt-7 font-display text-[40px] font-black uppercase leading-[0.9] tracking-[-1.5px] text-ink">
          SIGN IN TO <br />PLATEGALLERY.
        </h1>
        <p className="mt-2.5 text-[14px] font-semibold text-ink-soft">
          Upload plates, vote, and chart the country.
        </p>

        <button
          type="button"
          onClick={() =>
            signInWithGoogle(
              `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
            )
          }
          className="mt-7 flex w-full items-center justify-center gap-3 rounded-full border-[1.5px] border-rule bg-ink px-6 py-3.5 font-sans text-[14px] font-extrabold uppercase tracking-[0.3px] text-cream"
          style={{ boxShadow: '0 3px 0 var(--color-rule)' }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path
              d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
              fill="#f5ecdc"
            />
            <path
              d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
              fill="#f5ecdc"
            />
            <path
              d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
              fill="#f5ecdc"
            />
            <path
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58z"
              fill="#f5ecdc"
            />
          </svg>
          Continue with Google
        </button>

        <div className="mt-5 text-[11px] font-semibold text-ink-muted">
          By continuing, you agree to keep it friendly and drama-free.
        </div>
        <Link to="/" className="mt-3 inline-block text-[12px] font-extrabold uppercase tracking-wide text-rust">
          ← back to the feed
        </Link>
      </div>
    </motion.main>
  )
}
