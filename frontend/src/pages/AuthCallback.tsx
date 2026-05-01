import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/AuthContext'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (user) {
      const next = searchParams.get('next') || '/'
      navigate(next, { replace: true })
    } else {
      navigate('/', { replace: true })
    }
  }, [user, loading, navigate, searchParams])

  return (
    <motion.main
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.25 }}
      className="flex min-h-[calc(100vh-72px)] items-center justify-center bg-cream px-6"
    >
      <div
        className="rounded-[18px] border-[1.5px] border-rule bg-paper px-8 py-10 text-center"
        style={{ boxShadow: '0 3px 0 var(--color-rule)' }}
      >
        <div className="font-mono text-[11px] font-bold uppercase tracking-[1.5px] text-ink-muted">
          AUTH · HANDSHAKE
        </div>
        <h1 className="mt-2 font-display text-[48px] font-black uppercase leading-[0.9] tracking-[-1.5px] text-ink">
          SIGNING YOU IN…
        </h1>
        <p className="mt-2 text-[13px] font-semibold text-ink-soft">
          Hang tight, grabbing your plates.
        </p>
      </div>
    </motion.main>
  )
}
