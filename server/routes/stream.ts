import type { FastifyInstance } from 'fastify'
import { subscribe } from '../events.ts'

/** Server-sent events: one line per domain event, carrying the edge to pulse. */
export default async function stream(app: FastifyInstance) {
  app.get('/api/stream', (request, reply) => {
    reply.raw.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    })
    reply.raw.write(': connected\n\n')

    const unsubscribe = subscribe((event) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`)
    })
    // Proxies drop idle connections; a comment line keeps this one alive.
    const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), 25_000)

    request.raw.on('close', () => {
      clearInterval(heartbeat)
      unsubscribe()
    })
  })
}
