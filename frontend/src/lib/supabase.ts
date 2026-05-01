import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

function makeStubClient(): SupabaseClient {
  const notConfigured = () =>
    Promise.resolve({
      data: null,
      error: { name: 'ConfigError', message: 'Supabase env vars are not set. Add a frontend/.env file.' },
    } as never)

  const stubAuth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithOAuth: notConfigured,
    signOut: async () => ({ error: null }),
    getUser: async () => ({ data: { user: null }, error: null }),
  }

  return { auth: stubAuth } as unknown as SupabaseClient
}

if (!supabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[PlateGallery] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
      'Copy frontend/.env.example to frontend/.env and fill in values. ' +
      'Running in read-only demo mode — auth and uploads are disabled.',
  )
}

export const supabase: SupabaseClient = supabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  : makeStubClient()

export async function getSession() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function signInWithGoogle(redirectTo?: string) {
  if (!supabaseConfigured) {
    alert('Auth is disabled — Supabase env vars are not configured. Create frontend/.env from .env.example.')
    return { data: null, error: null }
  }
  return supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo || `${window.location.origin}/auth/callback`,
    },
  })
}

export async function signOut() {
  return supabase.auth.signOut()
}
