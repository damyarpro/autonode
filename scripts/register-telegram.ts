import { env, hasTelegram } from '../server/env.ts'
import { registerTelegramWebhook } from '../server/adapters/channels/telegram.ts'

/**
 * Points a Telegram bot at this server. The public URL must be reachable from
 * the internet — a tunnel is fine for local work.
 *
 *   PUBLIC_URL=https://your-tunnel.example npm run telegram:register
 */
if (!hasTelegram()) {
  console.error('TELEGRAM_BOT_TOKEN is not set. Get one from @BotFather and put it in .env.')
  process.exit(1)
}

if (env.publicUrl.includes('127.0.0.1') || env.publicUrl.includes('localhost')) {
  console.error(`PUBLIC_URL is ${env.publicUrl}, which Telegram cannot reach. Set a public URL first.`)
  process.exit(1)
}

if (!process.env.TELEGRAM_WEBHOOK_SECRET) {
  console.error(
    'TELEGRAM_WEBHOOK_SECRET is not set, so the server generates a new one each boot and this\n' +
      'registration would stop matching on the next restart. Put a fixed value in .env first.',
  )
  process.exit(1)
}

const url = await registerTelegramWebhook(env.publicUrl)
console.log(`Telegram webhook registered → ${url}`)
