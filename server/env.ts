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

  /**
   * Serving the built app from the API puts both on one origin, which is what
   * makes the session cookie work in production. Off in dev, where Vite serves
   * the app and proxies /api.
   */
  staticDir: process.env.STATIC_DIR ?? 'dist',
  serveStatic: bool(process.env.SERVE_STATIC, false),

  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  // Secret path segment on the webhook route; generated per boot when unset so
  // an unconfigured server never exposes a guessable endpoint.
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? randomBytes(16).toString('hex'),

  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  anthropicModel: process.env.ANTHROPIC_MODEL ?? 'claude-opus-5',

  webhookSigningSecret: process.env.WEBHOOK_SIGNING_SECRET ?? '',

  /**
   * Signs the mock checkout so only a confirmation this server issued is
   * accepted. Random per boot when unset, which is safe by default and simply
   * means a checkout link does not survive a restart — set it to keep them.
   */
  checkoutSigningSecret: process.env.CHECKOUT_SIGNING_SECRET || randomBytes(32).toString('hex'),

  /** Multiplier on every nurture delay. 0 makes each step due immediately. */
  sequenceSpeed: Number(process.env.SEQUENCE_SPEED ?? 1),
  workerIntervalMs: Number(process.env.WORKER_INTERVAL_MS ?? 15_000),
  workerEnabled: bool(process.env.WORKER_ENABLED, true),

  /** Share of each payment the growth loop puts back into ads and testing. */
  growthReinvestRate: Number(process.env.GROWTH_REINVEST_RATE ?? 0.27),
}

export const hasTelegram = () => env.telegramBotToken.length > 0
export const hasClaude = () => env.anthropicApiKey.length > 0
