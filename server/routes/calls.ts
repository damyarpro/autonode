import type { FastifyInstance } from 'fastify'
import * as q from '../db/queries.ts'
import { voice } from '../adapters/registry.ts'
import { bookMeeting, callHours, freeSlots, prepareCall, runDueCallWork, slotMinutes } from '../calls/calls.ts'

/**
 * The sales call over HTTP. Thin: validate, call `server/calls/calls.ts`, and
 * return. Failures come back as `field:code` strings for the client to phrase.
 */
export default async function callRoutes(app: FastifyInstance) {
  /** Writes the brief and places the call — or prepares it, with no credentials. */
  app.post('/api/calls/:leadId/prepare', async (request, reply) => {
    const leadId = Number((request.params as { leadId: string }).leadId)
    if (!Number.isInteger(leadId)) return reply.code(400).send({ error: 'invalid input', errors: ['leadId:not_a_number'] })

    const prepared = await prepareCall(leadId)
    if (!prepared) return reply.code(404).send({ error: 'not found' })

    return { brief: prepared.brief, call: prepared.call, adapter: voice().name, live: voice().live }
  })

  app.get('/api/calls/slots', async (request) => {
    const { days } = request.query as { days?: string }
    const window = Number(days)
    const hours = callHours()
    return {
      slots: freeSlots(Number.isFinite(window) && window > 0 ? window : 7).map((slot) => ({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
      })),
      slotMinutes: slotMinutes(),
      hours: { start: hours.startMinute, end: hours.endMinute, offsetMinutes: hours.offsetMinutes, days: hours.days },
    }
  })

  app.post('/api/calls/:leadId/book', async (request, reply) => {
    const leadId = Number((request.params as { leadId: string }).leadId)
    const { slotStart } = (request.body ?? {}) as { slotStart?: string }
    if (!slotStart?.trim()) return reply.code(400).send({ error: 'invalid input', errors: ['slotStart:required'] })
    if (Number.isNaN(Date.parse(slotStart))) {
      return reply.code(400).send({ error: 'invalid input', errors: ['slotStart:not_a_time'] })
    }

    const result = bookMeeting(leadId, slotStart)
    if (result.ok) return reply.code(201).send({ booking: result.booking, reminders: result.reminders })
    if (result.code === 'unknown_lead') return reply.code(404).send({ error: 'not found' })
    // Past, taken or outside the working day: the slot is real but unavailable.
    return reply.code(409).send({ error: 'slot unavailable', errors: [`slotStart:${result.code}`] })
  })

  app.get('/api/calls', async (request) => {
    const { leadId } = request.query as { leadId?: string }
    const id = Number(leadId)
    return {
      calls: Number.isInteger(id) && id > 0 ? q.leadCalls(id) : q.listCalls(),
      bookings: q.listBookings(),
      counts: q.callCounts(),
      adapter: voice().name,
    }
  })

  /** Runs the reminder and referral passes now, instead of waiting for the worker. */
  app.post('/api/calls/run-due', async () => runDueCallWork())
}
