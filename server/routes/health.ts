import type { FastifyInstance } from 'fastify'
import { adapterStatus } from '../adapters/registry.ts'
import { env, hasTelegram } from '../env.ts'
import { vapiWebhookPath } from './webhooks.ts'

export default async function health(app: FastifyInstance) {
  app.get('/api/health', async () => ({
    ok: true,
    adapters: adapterStatus(),
    telegramWebhookPath: hasTelegram() ? `/api/webhooks/telegram/${env.telegramWebhookSecret}` : null,
    // The path to paste into Vapi's server URL. Null unless VAPI_WEBHOOK_SECRET
    // is set, because a per-boot random one would be useless to configure with.
    vapiWebhookPath: vapiWebhookPath(),
  }))
}
