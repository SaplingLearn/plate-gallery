import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import { AuthProvider } from '@/hooks/AuthProvider'
import { Nav } from '@/components/Nav'
import { Footer } from '@/components/Footer'
import { ProtectedRoute } from '@/components/ProtectedRoute'

const Home = lazy(() => import('@/pages/Home'))
const Gallery = lazy(() => import('@/pages/Gallery'))
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
    <div className="flex min-h-screen items-center justify-center">
      <p className="font-display text-lg text-stone">Loading...</p>
    </div>
  )
}

function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<PageLoader />}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Home />} />
          <Route path="/gallery" element={<Gallery />} />
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
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Nav />
          <AnimatedRoutes />
          <Footer />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
