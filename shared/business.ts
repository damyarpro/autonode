/**
 * The business profile contract, imported by the server that stores it and the
 * form that edits it. Rule 10: a shape both halves need lives here once, so a
 * new field cannot mean two edits that drift apart.
 */

export const BUSINESS_CHANNELS = ['instagram', 'telegram', 'linkedin', 'youtube', 'website'] as const
export type BusinessChannel = (typeof BUSINESS_CHANNELS)[number]

export const TONES = ['friendly', 'expert', 'direct', 'playful'] as const
export type Tone = (typeof TONES)[number]

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
  channels: BusinessChannel[]
  ctaUrl: string | null
  notes: string | null
}

/** The caps the route trims to, so the form can count down to the same numbers. */
export const BUSINESS_LIMITS = { name: 120, whatWeSell: 600, audience: 300, notes: 600 } as const

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
