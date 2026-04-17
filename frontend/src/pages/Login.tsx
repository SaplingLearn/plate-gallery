import { useSearchParams, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { signInWithGoogle } from '@/lib/supabase'
import { useAuth } from '@/hooks/AuthContext'

export default function Login() {
  const [searchParams] = useSearchParams()
  const { user, loading } = useAuth()
  const next = searchParams.get('next') || '/'

  if (!loading && user) {
    return <Navigate to={next} replace />
  }

  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.3 }}
      className="flex min-h-screen items-center justify-center"
    >
      <div className="w-full max-w-sm px-6 text-center">
        <h1 className="font-display text-3xl text-charcoal">
          Sign in to PlateGallery
        </h1>
        <p className="mt-3 text-sm text-stone">
          Upload plates, vote on your favorites, and track your collection.
        </p>
        <button
          onClick={() => signInWithGoogle(`${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`)}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-sm bg-oxblood px-6 py-3.5 font-sans text-sm text-bone transition-colors hover:bg-oxblood/90"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#F4F0E8"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#F4F0E8"/>
            <path d="M3.964 10.706A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#F4F0E8"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58z" fill="#F4F0E8"/>
          </svg>
          Continue with Google
        </button>
      </div>
    </motion.main>
  )
}
