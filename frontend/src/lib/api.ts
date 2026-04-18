import { getSession } from './supabase'
import { handleMockRequest, isMockMode } from './mockData'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export class ApiError extends Error {
  status: number
  code: string
  details?: Record<string, unknown>

  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (isMockMode()) {
    try {
      return await handleMockRequest<T>(path, options)
    } catch (err) {
      const e = err as { status?: number; code?: string; message?: string }
      throw new ApiError(e.status ?? 500, e.code ?? 'mock_error', e.message ?? 'Mock error')
    }
  }

  const session = await getSession()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    let body: { error?: { code?: string; message?: string; details?: Record<string, unknown> } } = {}
    try {
      body = await res.json()
    } catch {
      // non-JSON error
    }
    throw new ApiError(
      res.status,
      body.error?.code || 'unknown',
      body.error?.message || res.statusText,
      body.error?.details,
    )
  }

  if (res.status === 204) return undefined as T
  return res.json()
}
