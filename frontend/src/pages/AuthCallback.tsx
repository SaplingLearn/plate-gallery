import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/AuthContext'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, loading } = useAuth()

  useEffect(() => {
    if (!loading && user) {
      const next = searchParams.get('next') || '/'
      navigate(next, { replace: true })
    }
  }, [user, loading, navigate, searchParams])

  return (
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.3 }}
      className="flex min-h-screen items-center justify-center"
    >
      <h1 className="font-display text-2xl text-charcoal">
        Signing you in&hellip;
      </h1>
    </motion.main>
  )
}
