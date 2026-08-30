import { CHANNELS, type Channel } from '../types.ts'
import {
  BUSINESS_CHANNELS,
  isUsable,
  type BusinessChannel,
  type BusinessProfile,
  type Tone,
} from '../../shared/business.ts'

// The contract itself lives in shared/, so the form and the store cannot drift.
// Re-exported here because every server module already reaches for it by this
// path, and because `businessBrief` below — prose for the model, not for the
// user — belongs on the server side of the boundary.
export {
  BUSINESS_CHANNELS,
  BUSINESS_LIMITS,
  TONES,
  emptyBusiness,
  isUsable,
  missingFields,
} from '../../shared/business.ts'
export type { BusinessChannel, BusinessProfile, Tone } from '../../shared/business.ts'

// The shared list is written without importing server vocabulary, so these two
// assignments are what fail the build if either side gains a channel the other
// does not have.
const _sharedFitsServer: readonly Channel[] = BUSINESS_CHANNELS
const _serverFitsShared: readonly BusinessChannel[] = CHANNELS
void _sharedFitsServer
void _serverFitsShared

const TONE_HINT: Record<Tone, string> = {
  friendly: 'warm and plain-spoken, like a helpful peer',
  expert: 'precise and evidence-led, never salesy',
  direct: 'short and blunt; say the next action in one line',
  playful: 'light and human, but never silly about money',
}

/**
 * The paragraph every AI call prepends. Kept in one place so a change to how
 * the business is described reaches the coach, the tools, the outreach copy and
 * the content factory at once.
 */
export function businessBrief(profile: BusinessProfile, locale: string): string {
  if (!isUsable(profile)) {
    return locale === 'en'
      ? 'The owner has not filled in their business profile yet. Keep advice general and ask for the missing detail.'
      : 'صاحب کسب‌وکار هنوز پروفایل بیزینسی‌اش را پر نکرده. کلی راهنمایی کن و جزئیات لازم را بپرس.'
  }

  const price =
    profile.priceToman > 0 ? `Typical price: ${profile.priceToman.toLocaleString('en-US')} Toman.` : ''

  return [
    `Business: ${profile.name || 'unnamed'}.`,
    `Sells: ${profile.whatWeSell}`,
    `Audience: ${profile.audience}`,
    `Voice: ${TONE_HINT[profile.tone]}.`,
    price,
    profile.channels.length ? `Active channels: ${profile.channels.join(', ')}.` : '',
    profile.ctaUrl ? `Call to action link: ${profile.ctaUrl}` : '',
    profile.notes ? `Other notes: ${profile.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}
