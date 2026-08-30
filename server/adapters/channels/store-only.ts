import type { Channel, Lead } from '../../types.ts'
import type { ChannelAdapter } from '../types.ts'

/**
 * Default for every channel without real credentials. The message is still
 * written to the database and still advances the funnel — it just isn't
 * delivered anywhere, and says so via the `simulated` status.
 */
export function storeOnlyChannel(channel: Channel): ChannelAdapter {
  return {
    channel,
    live: false,
    async send(_lead: Lead) {
      return { status: 'simulated' as const }
    },
  }
}
