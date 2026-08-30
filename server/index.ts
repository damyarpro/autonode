import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'
import { env, hasClaude, hasTelegram } from './env.ts'
import { db } from './db/index.ts'
import { adapterStatus } from './adapters/registry.ts'
import { registerAuth } from './auth.ts'
import { startWorker } from './jobs/worker.ts'
import health from './routes/health.ts'
import leads from './routes/leads.ts'
import pipeline from './routes/pipeline.ts'
import stream from './routes/stream.ts'
import webhooks from './routes/webhooks.ts'
import checkout from './routes/checkout.ts'
import appRoutes from './routes/app.ts'
import authRoutes from './routes/auth.ts'
import toolRoutes from './routes/tools.ts'

export async function buildServer() {
  const app = Fastify({ logger: false })

  // Action endpoints are called with no body; treat that as an empty object
  // rather than a 400, which is also what webhook senders tend to do.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    const raw = typeof body === 'string' ? body.trim() : ''
    if (raw === '') return done(null, {})
    try {
      done(null, JSON.parse(raw))
    } catch (error) {
      // A bare SyntaxError has no statusCode, so Fastify's default handler
      // would report a malformed client request as a 500. Stamp it, the way
      // Fastify's own JSON parser does, so a truncated POST reads as a 400.
      const parseError = error as Error & { statusCode?: number }
      parseError.statusCode = 400
      done(parseError, undefined)
    }
  })

  // The dashboard and the Vite dev server sit on a different port.
  app.addHook('onSend', async (_request, reply) => {
    reply.header('access-control-allow-origin', '*')
    reply.header('access-control-allow-headers', 'content-type, x-signature')
    reply.header('access-control-allow-methods', 'GET, POST, OPTIONS')
  })
  app.options('/api/*', async (_request, reply) => reply.code(204).send())

  db()

  // Called directly, not through app.register: a plugin body would encapsulate
  // the preHandler in a child context and every route would answer unguarded.
  registerAuth(app)

  await app.register(authRoutes)
  await app.register(health)
  await app.register(leads)
  await app.register(pipeline)
  await app.register(stream)
  await app.register(webhooks)
  await app.register(checkout)
  await app.register(appRoutes)
  await app.register(toolRoutes)
  return app
}

const isEntrypoint = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])

if (isEntrypoint) {
  const app = await buildServer()
  await app.listen({ port: env.port, host: env.host })
  startWorker()

  const status = adapterStatus()
  console.log(`\n  monitiezai api  →  http://${env.host}:${env.port}`)
  console.log(`  database        →  ${env.dbFile}`)
  console.log(`  ai              →  ${status.ai}${hasClaude() ? '' : '  (set ANTHROPIC_API_KEY for Claude)'}`)
  console.log(`  telegram        →  ${hasTelegram() ? 'live' : 'simulated  (set TELEGRAM_BOT_TOKEN)'}`)
  if (hasTelegram()) console.log(`  webhook path    →  /api/webhooks/telegram/${env.telegramWebhookSecret}`)
  console.log(`  payments        →  ${status.payments}  (no gateway, no real money)\n`)
}
