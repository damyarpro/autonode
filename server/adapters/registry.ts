import { CHANNELS, type Channel } from '../types.ts'
import { hasClaude, hasTelegram } from '../env.ts'
import { storeOnlyChannel } from './channels/store-only.ts'
import { telegramChannel } from './channels/telegram.ts'
import { templateAi } from './ai/template.ts'
import { claudeAi } from './ai/claude.ts'
import { mockPayments } from './payments/mock.ts'
import type { AiAdapter, ChannelAdapter, PaymentAdapter } from './types.ts'

/** Real adapter when credentials exist, working fallback otherwise. */
export function channelFor(channel: Channel): ChannelAdapter {
  if (channel === 'telegram' && hasTelegram()) return telegramChannel
  return storeOnlyChannel(channel)
}

export const ai = (): AiAdapter => (hasClaude() ? claudeAi : templateAi)

export const payments = (): PaymentAdapter => mockPayments

/** Shown on /api/health so it is never a guess which half is real. */
export const adapterStatus = () => ({
  channels: Object.fromEntries(CHANNELS.map((c) => [c, channelFor(c).live ? 'live' : 'simulated'])),
  ai: ai().name,
  payments: payments().provider,
})
