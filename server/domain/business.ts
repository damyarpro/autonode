import type { Channel } from '../types.ts'

/**
 * What the owner told us about their business. Every generated message, post,
 * call brief and tool answer reads this, so the output is about their offer
 * instead of a generic one.
 */
export type BusinessProfile = {
  name: string
  whatWeSell: string
  audience: string
  tone: Tone
  priceToman: number
  channels: Channel[]
  ctaUrl: string | null
  notes: string | null
}

export const TONES = ['friendly', 'expert', 'direct', 'playful'] as const
export type Tone = (typeof TONES)[number]

export const emptyBusiness = (): BusinessProfile => ({
  name: '',
  whatWeSell: '',
  audience: '',
  tone: 'friendly',
  priceToman: 0,
  channels: [],
  ctaUrl: null,
  notes: null,
})

/** A profile is usable once it says what is sold and to whom. */
export function isUsable(profile: BusinessProfile): boolean {
  return profile.whatWeSell.trim().length > 0 && profile.audience.trim().length > 0
}

/** Which required fields are still blank, as `field:code` for the client. */
export function missingFields(profile: BusinessProfile): string[] {
  const missing: string[] = []
  if (!profile.name.trim()) missing.push('name:required')
  if (!profile.whatWeSell.trim()) missing.push('whatWeSell:required')
  if (!profile.audience.trim()) missing.push('audience:required')
  return missing
}

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
