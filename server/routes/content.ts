import type { FastifyInstance } from 'fastify'
import * as q from '../db/queries.ts'
import { persistPlan, produce, publishDue } from '../content/factory.ts'
import { isStatus, normalizeRequest, CONTENT_STATUSES } from '../domain/content.ts'
import { CHANNELS, type Channel } from '../types.ts'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

export default async function contentRoutes(app: FastifyInstance) {
  /**
   * Writes a batch from the business profile and schedules it. Nothing here
   * invents an offer: with no usable profile the answer is a 409 carrying the
   * fields the owner still has to fill, and the client turns those codes into
   * sentences the way it does everywhere else.
   */
  app.post('/api/content/produce', async (request, reply) => {
    const parsed = normalizeRequest(request.body)
    if (!parsed.ok) return reply.code(400).send({ error: 'invalid input', errors: parsed.errors })

    const plan = await produce(parsed.request)
    if (plan.blockedBy.length > 0) {
      return reply.code(409).send({ error: 'business profile incomplete', errors: plan.blockedBy })
    }

    return reply.code(201).send({
      pieces: persistPlan(plan),
      producedBy: plan.producedBy,
      locale: plan.locale,
    })
  })

  app.get('/api/content', async (request, reply) => {
    const query = (request.query ?? {}) as { status?: string; channel?: string; limit?: string }

    if (query.status !== undefined && !isStatus(query.status)) {
      return reply.code(400).send({ error: 'invalid input', errors: ['status:not_an_option'] })
    }
    if (query.channel !== undefined && !CHANNELS.includes(query.channel as Channel)) {
      return reply.code(400).send({ error: 'invalid input', errors: ['channel:not_an_option'] })
    }

    const asked = Number(query.limit)
    const limit = Number.isFinite(asked) && asked > 0 ? Math.min(Math.trunc(asked), MAX_LIMIT) : DEFAULT_LIMIT

    return {
      pieces: q.listContent({
        status: isStatus(query.status) ? query.status : undefined,
        channel: query.channel as Channel | undefined,
        limit,
      }),
      pending: q.countContent('pending'),
      statuses: CONTENT_STATUSES,
    }
  })

  /** The publish button: one worker pass, right now. */
  app.post('/api/content/publish', async () => {
    const published = await publishDue(new Date())
    return { published, pending: q.countContent('pending') }
  })

  app.delete('/api/content/:id', async (request, reply) => {
    const id = Number((request.params as { id: string }).id)
    if (!Number.isInteger(id) || !q.deleteContentPiece(id)) return reply.code(404).send({ error: 'not found' })
    return { ok: true }
  })
}
