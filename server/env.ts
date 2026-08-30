import { randomBytes } from 'node:crypto'

const bool = (value: string | undefined, fallback: boolean) =>
  value === undefined ? fallback : value === '1' || value.toLowerCase() === 'true'

/**
 * Everything optional. With an empty environment the whole funnel still runs —
 * channels store their messages instead of sending, and copy comes from
 * templates rather than a model.
 */
export const env = {
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? '127.0.0.1',
  publicUrl: process.env.PUBLIC_URL ?? `http://127.0.0.1:${process.env.PORT ?? 8787}`,
  dbFile: process.env.DB_FILE ?? 'data/autonode.db',

  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  // Secret path segment on the webhook route; generated per boot when unset so
  // an unconfigured server never exposes a guessable endpoint.
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? randomBytes(16).toString('hex'),

  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-opus-5',

  webhookSigningSecret: process.env.WEBHOOK_SIGNING_SECRET ?? '',

  /** Multiplier on every nurture delay. 0 makes each step due immediately. */
  sequenceSpeed: Number(process.env.SEQUENCE_SPEED ?? 1),
  workerIntervalMs: Number(process.env.WORKER_INTERVAL_MS ?? 15_000),
  workerEnabled: bool(process.env.WORKER_ENABLED, true),

  /** Share of each payment the growth loop puts back into ads and testing. */
  growthReinvestRate: Number(process.env.GROWTH_REINVEST_RATE ?? 0.27),
}

export const hasTelegram = () => env.telegramBotToken.length > 0
export const hasClaude = () => env.anthropicApiKey.length > 0
