import { createHmac, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { env } from '../env.ts'
import { CHANNELS, type Channel } from '../types.ts'
import { verifyCheckout } from '../domain/checkout-token.ts'
import * as q from '../db/queries.ts'
import { capture, capturePayment, handleInbound } from '../service.ts'

type TelegramUpdate = {
  message?: {
    message_id: number
    text?: string
    chat: { id: number; first_name?: string; username?: string }
    from?: { first_name?: string; username?: string; language_code?: string }
  }
}

const signatureMatches = (raw: string, signature: string) => {
  if (!env.webhookSigningSecret) return false
  const expected = createHmac('sha256', env.webhookSigningSecret).update(raw).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

export default async function webhooks(app: FastifyInstance) {
  /**
   * Real Telegram updates. The secret lives in the path, which is Telegram's
   * own recommendation — the token itself never leaves the server.
   */
  app.post('/api/webhooks/telegram/:secret', async (request, reply) => {
    const { secret } = request.params as { secret: string }
    if (secret !== env.telegramWebhookSecret) return reply.code(404).send({ error: 'not found' })

    const update = (request.body ?? {}) as TelegramUpdate
    const message = update.message
    if (!message?.text) return { ok: true }

    const chatId = String(message.chat.id)
    const name = message.from?.first_name ?? message.chat.first_name ?? null
    const handle = message.from?.username ?? message.chat.username ?? null
    const locale = message.from?.language_code?.startsWith('fa') ? 'fa' : 'en'

    const existing = q
      .listLeads({ limit: 1000 })
      .find((lead) => lead.source === 'telegram' && lead.external_id === chatId)

    if (existing) handleInbound(existing.id, message.text, String(message.message_id))
    else capture({ source: 'telegram', externalId: chatId, name, handle, locale, message: message.text })

    return { ok: true }
  })

  /**
   * Generic capture for the channels that need a business account and platform
   * review before they can be wired up for real. HMAC-signed so it is not an
   * open door on a deployed instance.
   */
  app.post('/api/webhooks/:channel', async (request, reply) => {
    const { channel } = request.params as { channel: string }
    if (!CHANNELS.includes(channel as Channel)) return reply.code(404).send({ error: 'unknown channel' })

    const signature = request.headers['x-signature']
    if (env.webhookSigningSecret) {
      if (typeof signature !== 'string' || !signatureMatches(JSON.stringify(request.body ?? {}), signature)) {
        return reply.code(401).send({ error: 'bad signature' })
      }
    }

    const body = (request.body ?? {}) as {
      externalId?: string
      name?: string
      handle?: string
      message?: string
      locale?: string
    }
    const lead = capture({
      source: channel as Channel,
      externalId: body.externalId ?? null,
      name: body.name ?? null,
      handle: body.handle ?? null,
      locale: body.locale ?? 'fa',
      message: body.message,
    })
    return reply.code(201).send({ lead })
  })

  /**
   * Called by the local checkout page. No gateway, no money — but it writes a
   * sale and makes the growth loop reinvest, so it is not open: only a
   * confirmation carrying the token `startCheckout` signed is accepted.
   */
  app.post('/api/webhooks/payment', async (request, reply) => {
    const body = (request.body ?? {}) as {
      leadId?: number
      dealId?: number
      ref?: string
      amountToman?: number
      token?: string
    }
    if (!body.leadId || !body.dealId || !body.ref || !body.amountToman) {
      return reply.code(400).send({ error: 'leadId, dealId, ref and amountToman are required' })
    }

    const facts = {
      leadId: Number(body.leadId),
      dealId: Number(body.dealId),
      ref: body.ref,
      amountToman: Number(body.amountToman),
    }
    if (!verifyCheckout(facts, body.token ?? '', env.checkoutSigningSecret)) {
      return reply.code(401).send({ error: 'bad checkout token' })
    }

    // The token proves the facts were ours; the deal row proves they are still
    // the deal's own, so a captured link cannot confirm a different amount.
    const deal = q.dealById(facts.dealId)
    if (!deal || deal.lead_id !== facts.leadId || deal.amount_toman !== facts.amountToman) {
      return reply.code(409).send({ ok: false, reason: 'deal does not match' })
    }

    const result = capturePayment(facts)
    if (!result.ok) return reply.code(409).send(result)
    return result
  })
}
