import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import {
  authEnabled,
  createSession,
  destroySession,
  isPublicPath,
  makeCredential,
  readToken,
  registerAuth,
  SESSION_COOKIE,
  verifyPassword,
  verifyToken,
} from './auth.ts'

const clearEnv = () => {
  delete process.env.APP_PASSWORD
  delete process.env.APP_PASSWORD_HASH
}

/** Enough of a Fastify instance to see whether the guard installed a hook. */
const hookSpy = () => {
  const hooks: string[] = []
  const app = { addHook: (name: string) => hooks.push(name) } as unknown as FastifyInstance
  return { app, hooks }
}

const requestWith = (headers: Record<string, string>) => ({ headers }) as unknown as FastifyRequest

test('an empty environment leaves authentication off and the guard silent', () => {
  clearEnv()
  assert.equal(authEnabled(), false)
  assert.equal(verifyPassword('anything'), false, 'no password can be right when none is configured')

  const { app, hooks } = hookSpy()
  registerAuth(app)
  assert.deepEqual(hooks, [], 'a disabled guard adds no hook at all')
})

test('a configured password verifies and a wrong one does not', () => {
  clearEnv()
  process.env.APP_PASSWORD = 'correct horse battery staple'
  assert.equal(authEnabled(), true)
  assert.equal(verifyPassword('correct horse battery staple'), true)
  assert.equal(verifyPassword('correct horse battery stapl'), false)
  assert.equal(verifyPassword(''), false)
  assert.equal(verifyPassword('CORRECT HORSE BATTERY STAPLE'), false)
  clearEnv()
})

test('a pre-computed salt:hash works the same and the password itself stays out of the environment', () => {
  clearEnv()
  const credential = makeCredential('راز من')
  assert.match(credential, /^[0-9a-f]{32}:[0-9a-f]{128}$/)

  process.env.APP_PASSWORD_HASH = credential
  assert.equal(authEnabled(), true)
  assert.equal(verifyPassword('راز من'), true)
  assert.equal(verifyPassword('راز تو'), false)
  clearEnv()
})

test('the guard installs a preHandler once a password is configured', () => {
  clearEnv()
  process.env.APP_PASSWORD = 'guarded'
  const { app, hooks } = hookSpy()
  registerAuth(app)
  assert.deepEqual(hooks, ['preHandler'])
  clearEnv()
})

test('a fresh token verifies and a tampered one is rejected', () => {
  const { token } = createSession()
  assert.notEqual(verifyToken(token), null)

  const [id, expiry, signature] = token.split('.')
  assert.equal(verifyToken(`${id}.${expiry}.${'0'.repeat(signature.length)}`), null, 'a forged signature')
  assert.equal(verifyToken(`${id}.${Number(expiry) + 60_000}.${signature}`), null, 'a stretched expiry')
  assert.equal(verifyToken(`${'a'.repeat(id.length)}.${expiry}.${signature}`), null, 'a swapped id')
  assert.equal(verifyToken(`${token}.extra`), null, 'a malformed token')
  assert.equal(verifyToken(''), null)
  assert.equal(verifyToken(null), null)
})

test('an expired token is rejected even though it is correctly signed', () => {
  const { token } = createSession(-1)
  assert.equal(verifyToken(token), null)
})

test('destroySession invalidates the token it was given, and only that one', () => {
  const mine = createSession()
  const other = createSession()

  assert.equal(destroySession(mine.token), true)
  assert.equal(verifyToken(mine.token), null)
  assert.equal(destroySession(mine.token), false, 'logging out twice removes nothing the second time')
  assert.notEqual(verifyToken(other.token), null, 'another session is untouched')
  destroySession(other.token)
})

test('the public set covers probes and machines, and nothing else', () => {
  assert.equal(isPublicPath('GET', '/api/health'), true)
  assert.equal(isPublicPath('GET', '/api/auth/status'), true)
  assert.equal(isPublicPath('POST', '/api/auth/login'), true)
  assert.equal(isPublicPath('POST', '/api/webhooks/telegram/abc123'), true)
  assert.equal(isPublicPath('POST', '/api/webhooks/payment'), true)
  assert.equal(isPublicPath('GET', '/api/checkout/page?lead=1&deal=2'), true)
  assert.equal(isPublicPath('OPTIONS', '/api/leads'), true, 'CORS preflight carries no cookie')
  assert.equal(isPublicPath('GET', '/'), true, 'the app shell has to load to show a login screen')

  assert.equal(isPublicPath('GET', '/api/leads'), false)
  assert.equal(isPublicPath('POST', '/api/leads'), false)
  assert.equal(isPublicPath('GET', '/api/health/detail'), false)
  assert.equal(isPublicPath('GET', '/api/webhooks/telegram/abc123'), false, 'only POST reaches a webhook')
  assert.equal(isPublicPath('POST', '/api/checkout/12'), false)
  assert.equal(isPublicPath('GET', '/api/profile'), false)
  assert.equal(isPublicPath('GET', '/api/stream'), false)
})

test('the token is read from the cookie first and the bearer header second', () => {
  assert.equal(readToken(requestWith({})), null)
  assert.equal(
    readToken(requestWith({ cookie: `other=1; ${SESSION_COOKIE}=abc.def.ghi; trailing=2` })),
    'abc.def.ghi',
  )
  assert.equal(readToken(requestWith({ authorization: 'Bearer abc.def.ghi' })), 'abc.def.ghi')
  assert.equal(
    readToken(requestWith({ cookie: `${SESSION_COOKIE}=from-cookie`, authorization: 'Bearer from-header' })),
    'from-cookie',
    'the cookie wins so a stale header cannot shadow a live session',
  )
})
