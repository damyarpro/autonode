import { useCallback, useEffect, useState } from 'react'
import { getJson, postJson } from './client'

export type AuthStatus = { enabled: boolean; authenticated: boolean }

/** Why a login attempt did not go through, in terms the login screen can render. */
export type LoginOutcome = 'ok' | 'invalid' | 'locked' | 'offline'

export type Session = {
  /** True only when the server has a password configured. */
  enabled: boolean
  authenticated: boolean
  loading: boolean
  login: (password: string) => Promise<LoginOutcome>
  logout: () => Promise<void>
}

/**
 * `client.ts` throws a message rather than a status, so the status is read back
 * off the end of it — enough to tell a wrong password from a lockout.
 */
const statusOf = (error: unknown): number => {
  const match = /(\d{3})$/.exec(error instanceof Error ? error.message : '')
  return match ? Number(match[1]) : 0
}

/**
 * Opt-in session state. With no password configured the server reports
 * `enabled: false` and the app renders exactly as it always has. If the API is
 * unreachable this reports the same thing rather than locking the operator out
 * of a page that needs no server.
 */
export function useSession(): Session {
  const [status, setStatus] = useState<AuthStatus>({ enabled: false, authenticated: true })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let live = true
    getJson<AuthStatus>('/api/auth/status')
      .then((next) => {
        if (live) setStatus(next)
      })
      .catch(() => {
        // An unreachable API must not become a locked door.
        if (live) setStatus({ enabled: false, authenticated: true })
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [])

  const login = useCallback(async (password: string): Promise<LoginOutcome> => {
    try {
      await postJson<{ ok: true }>('/api/auth/login', { password })
      setStatus({ enabled: true, authenticated: true })
      return 'ok'
    } catch (error) {
      const code = statusOf(error)
      if (code === 401) return 'invalid'
      if (code === 429) return 'locked'
      return 'offline'
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await postJson<{ ok: true }>('/api/auth/logout')
    } catch {
      // The cookie may already be gone; the guard is the source of truth.
    }
    setStatus((prev) => (prev.enabled ? { enabled: true, authenticated: false } : prev))
  }, [])

  return { enabled: status.enabled, authenticated: status.authenticated, loading, login, logout }
}
