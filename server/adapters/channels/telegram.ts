import { env } from '../../env.ts'
import type { Lead } from '../../types.ts'
import type { ChannelAdapter } from '../types.ts'

const api = (method: string) => `https://api.telegram.org/bot${env.telegramBotToken}/${method}`

/** Real delivery over the Telegram Bot API. */
export const telegramChannel: ChannelAdapter = {
  channel: 'telegram',
  live: true,
  async send(lead: Lead, body: string) {
    if (!lead.external_id) return { status: 'failed' as const }

    const response = await fetch(api('sendMessage'), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: lead.external_id, text: body }),
    })
    const payload = (await response.json()) as { ok: boolean; result?: { message_id: number } }
    if (!response.ok || !payload.ok) return { status: 'failed' as const }
    return { status: 'sent' as const, externalId: String(payload.result?.message_id ?? '') }
  },
}

/** Points Telegram at this server. Run once after exposing a public URL. */
export async function registerTelegramWebhook(publicUrl: string): Promise<string> {
  const url = `${publicUrl.replace(/\/$/, '')}/api/webhooks/telegram/${env.telegramWebhookSecret}`
  const response = await fetch(api('setWebhook'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url, allowed_updates: ['message'] }),
  })
  const payload = (await response.json()) as { ok: boolean; description?: string }
  if (!payload.ok) throw new Error(`Telegram rejected the webhook: ${payload.description}`)
  return url
}
