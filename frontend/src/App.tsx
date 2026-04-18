import { Component, lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { AuthProvider } from '@/hooks/AuthProvider'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { supabaseConfigured } from '@/lib/supabase'

const Home = lazy(() => import('@/pages/Home'))
const States = lazy(() => import('@/pages/States'))
const StateDetail = lazy(() => import('@/pages/StateDetail'))
const Leaderboard = lazy(() => import('@/pages/Leaderboard'))
const PlateDetail = lazy(() => import('@/pages/PlateDetail'))
const Upload = lazy(() => import('@/pages/Upload'))
const Profile = lazy(() => import('@/pages/Profile'))
const Login = lazy(() => import('@/pages/Login'))
const AuthCallback = lazy(() => import('@/pages/AuthCallback'))
const About = lazy(() => import('@/pages/About'))
const NotFound = lazy(() => import('@/pages/NotFound'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error && 'status' in error && (error as { status: number }).status < 500) return false
        return failureCount < 1
      },
    },
  },
})

function PageLoader() {
  return (
    <div className="flex min-h-[calc(100vh-72px)] items-center justify-center">
      <p className="font-mono text-sm font-bold uppercase tracking-[1.5px] text-ink-muted">Loading…</p>
    </div>
  )
}

function ConfigBanner() {
  if (supabaseConfigured) return null
  return (
    <div className="sticky top-[72px] z-40 border-b-[1.5px] border-rule bg-mustard-lite px-8 py-2.5 text-[12px] font-bold text-ink">
      <span className="font-mono uppercase tracking-[1.5px]">Demo mode</span> · showing fake plates.
      Create <code className="rounded bg-paper px-1.5 py-0.5 font-mono text-[11px]">frontend/.env</code> from
      {' '}<code className="rounded bg-paper px-1.5 py-0.5 font-mono text-[11px]">.env.example</code> to wire up real auth + API.
    </div>
  )
}

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error('[PlateGallery] render error', error, info)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="flex min-h-screen items-center justify-center bg-cream px-8 py-10">
        <div
          className="w-full max-w-[640px] rounded-[22px] border-[1.5px] border-rule bg-paper p-8"
          style={{ boxShadow: '0 4px 0 var(--color-rule)' }}
        >
          <div className="font-mono text-[11px] font-bold uppercase tracking-[1.5px] text-ink-muted">
            RENDER ERROR
          </div>
          <div className="mt-1 font-display text-[44px] font-black uppercase leading-[0.9] tracking-[-1.5px] text-ink">
            Something broke.
          </div>
          <pre className="mt-4 overflow-x-auto rounded-lg border-[1.5px] border-rule bg-cream p-3 font-mono text-[12px] text-ink">
            {this.state.error.stack ?? this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-full border-[1.5px] border-rule bg-ink px-5 py-2.5 font-sans text-[13px] font-extrabold uppercase tracking-wide text-cream"
          >
            Reload
          </button>
        </div>
      </main>
    )
  }
}

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<PageLoader />}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Home />} />
          <Route path="/gallery" element={<Navigate to="/" replace />} />
          <Route path="/states" element={<States />} />
          <Route path="/states/:code" element={<StateDetail />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/plate/:id" element={<PlateDetail />} />
          <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <Nav />
            <ConfigBanner />
            <AnimatedRoutes />
            <Footer />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </AppErrorBoundary>
  )
}
