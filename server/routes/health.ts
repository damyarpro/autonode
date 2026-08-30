import type { FastifyInstance } from 'fastify'
import { adapterStatus } from '../adapters/registry.ts'
import { env, hasTelegram } from '../env.ts'

export default async function health(app: FastifyInstance) {
  app.get('/api/health', async () => ({
    ok: true,
    adapters: adapterStatus(),
    telegramWebhookPath: hasTelegram() ? `/api/webhooks/telegram/${env.telegramWebhookSecret}` : null,
  }))
}
