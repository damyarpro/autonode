import type { FastifyInstance } from 'fastify'
import * as q from '../db/queries.ts'
import { CHANNELS, ROUTES, STAGES, type Channel, type Route, type Stage } from '../types.ts'
import { bookMeeting, capture, completeCall, handleInbound, recordReferral } from '../service.ts'
import { channelFor } from '../adapters/registry.ts'

type CaptureBody = {
  source?: string
  externalId?: string
  handle?: string
  name?: string
  locale?: string
  message?: string
}

export default async function leads(app: FastifyInstance) {
  app.post('/api/leads', async (request, reply) => {
    const body = (request.body ?? {}) as CaptureBody
    const source = body.source as Channel
    if (!CHANNELS.includes(source)) {
      return reply.code(400).send({ error: `source must be one of ${CHANNELS.join(', ')}` })
    }
    const lead = capture({
      source,
      externalId: body.externalId ?? null,
      handle: body.handle ?? null,
      name: body.name ?? null,
      locale: body.locale ?? 'fa',
      message: body.message,
    })
    return reply.code(201).send({ lead })
  })

  app.get('/api/leads', async (request) => {
    const query = request.query as { route?: string; stage?: string; q?: string }
    return {
      leads: q.listLeads({
        route: ROUTES.includes(query.route as Route) ? (query.route as Route) : undefined,
        stage: STAGES.includes(query.stage as Stage) ? (query.stage as Stage) : undefined,
        q: query.q,
      }),
    }
  })

  app.get('/api/leads/:id', async (request, reply) => {
    const id = Number((request.params as { id: string }).id)
    const lead = q.getLead(id)
    if (!lead) return reply.code(404).send({ error: 'not found' })
    return { lead, events: q.leadEvents(id), messages: q.leadMessages(id) }
  })

  app.get('/api/conversations', async () => ({ conversations: q.conversations() }))

  /** Manual reply from the Inbox page — delivered through the same adapter. */
  app.post('/api/leads/:id/messages', async (request, reply) => {
    const id = Number((request.params as { id: string }).id)
    const { body } = (request.body ?? {}) as { body?: string }
    const lead = q.getLead(id)
    if (!lead) return reply.code(404).send({ error: 'not found' })
    if (!body?.trim()) return reply.code(400).send({ error: 'body is required' })

    const result = await channelFor(lead.source).send(lead, body)
    q.addMessage({
      lead_id: id,
      channel: lead.source,
      direction: 'out',
      body,
      status: result.status,
      external_id: result.externalId ?? null,
    })
    q.addEvent(id, 'message_out', { manual: true })
    return { ok: true, status: result.status, messages: q.leadMessages(id) }
  })

  /** Stage transitions the dashboard can trigger by hand. */
  app.post('/api/leads/:id/:action', async (request, reply) => {
    const { id, action } = request.params as { id: string; action: string }
    const leadId = Number(id)
    const handlers: Record<string, (leadId: number) => unknown> = {
      'book-meeting': bookMeeting,
      'complete-call': completeCall,
      referral: recordReferral,
    }
    const handler = handlers[action]
    if (!handler) return reply.code(404).send({ error: 'unknown action' })
    const lead = handler(leadId)
    if (!lead) return reply.code(404).send({ error: 'not found' })
    return { lead }
  })

  app.post('/api/leads/:id/inbound', async (request, reply) => {
    const id = Number((request.params as { id: string }).id)
    const { body } = (request.body ?? {}) as { body?: string }
    if (!body?.trim()) return reply.code(400).send({ error: 'body is required' })
    const lead = handleInbound(id, body)
    if (!lead) return reply.code(404).send({ error: 'not found' })
    return { lead }
  })
}
