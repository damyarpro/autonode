import type { FastifyInstance } from 'fastify'
import {
  authEnabled,
  clearedCookie,
  createSession,
  destroySession,
  isAuthenticated,
  isSecureRequest,
  readToken,
  sessionCookie,
  verifyPassword,
} from '../auth.ts'

/** A password is only worth having if it cannot be guessed at machine speed. */
const MAX_FAILURES = 5
const LOCKOUT_MS = 15 * 60 * 1000

// Per-IP failure counters, in memory: a restart forgives everyone, which is the
// same tradeoff the session table makes and is fine for a single-operator box.
const failures = new Map<string, { count: number; until: number }>()

const lockedFor = (ip: string, now: number): number => {
  const entry = failures.get(ip)
  if (!entry) return 0
  if (entry.until <= now) {
    failures.delete(ip)
    return 0
  }
  return entry.count >= MAX_FAILURES ? Math.ceil((entry.until - now) / 1000) : 0
}

const recordFailure = (ip: string, now: number) => {
  const entry = failures.get(ip)
  const count = entry && entry.until > now ? entry.count + 1 : 1
  failures.set(ip, { count, until: now + LOCKOUT_MS })
}

export default async function authRoutes(app: FastifyInstance) {
  /** The first thing the client asks. Answers whether or not auth is switched on. */
  app.get('/api/auth/status', async (request) => ({
    enabled: authEnabled(),
    authenticated: isAuthenticated(request),
  }))

  app.post('/api/auth/login', async (request, reply) => {
    if (!authEnabled()) return reply.code(400).send({ error: 'authentication is not configured' })

    const now = Date.now()
    const ip = request.ip
    const retryAfter = lockedFor(ip, now)
    if (retryAfter > 0) {
      return reply
        .code(429)
        .header('retry-after', String(retryAfter))
        .send({ error: 'too many attempts', retryAfterSeconds: retryAfter })
    }

    const { password } = (request.body ?? {}) as { password?: unknown }
    if (typeof password !== 'string' || !verifyPassword(password)) {
      recordFailure(ip, now)
      return reply.code(401).send({ error: 'invalid password' })
    }

    failures.delete(ip)
    const session = createSession()
    return reply
      .header('set-cookie', sessionCookie(session.token, session.maxAgeSeconds, isSecureRequest(request)))
      .send({ ok: true })
  })

  app.post('/api/auth/logout', async (request, reply) => {
    destroySession(readToken(request))
    return reply.header('set-cookie', clearedCookie(isSecureRequest(request))).send({ ok: true })
  })
}
