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
  destinations: ChannelDestinations
}

/**
 * Where each channel publishes: a Telegram chat id or @name, a LinkedIn URN, an
 * Instagram business account id, a YouTube channel id, the URL a site posts to.
 * Every channel has a key so the form can render a field per channel and the
 * publisher can ask for one without checking whether it exists; `null` is the
 * honest "the owner has not said yet", which is what stops a live adapter.
 */
export type ChannelDestinations = Record<BusinessChannel, string | null>

/**
 * The cap a destination is *rejected* at rather than trimmed to. An address cut
 * short is a different address, and a silently wrong one publishes into the
 * wrong place; the other text fields can afford to trim because prose that
 * loses its tail is still about the same business.
 */
export const DESTINATION_LIMIT = 200

/** The caps the route trims to, so the form can count down to the same numbers. */
export const BUSINESS_LIMITS = { name: 120, whatWeSell: 600, audience: 300, notes: 600 } as const

export const emptyDestinations = (): ChannelDestinations => ({
  instagram: null,
  telegram: null,
  linkedin: null,
  youtube: null,
  website: null,
})

export const emptyBusiness = (): BusinessProfile => ({
  name: '',
  whatWeSell: '',
  audience: '',
  tone: 'friendly',
  priceToman: 0,
  channels: [],
  ctaUrl: null,
  notes: null,
  destinations: emptyDestinations(),
})

/**
 * One destination as it may be stored, or the `field:code` saying why it may
 * not be. The channel is the field id, so `linkedin:too_long:200` needs no
 * vocabulary the error dictionary does not already have.
 *
 * Deliberately no shape rule: a LinkedIn URN, a Telegram chat id and a site URL
 * look nothing alike, and a guessed pattern would reject a value that works.
 * The channel itself is the only honest judge of an address.
 */
export type DestinationCheck = { ok: true; value: string | null } | { ok: false; code: string }

export function checkDestination(channel: BusinessChannel, value: unknown): DestinationCheck {
  if (value === null || value === undefined) return { ok: true, value: null }
  if (typeof value !== 'string') return { ok: false, code: `${channel}:not_text` }

  const trimmed = value.trim()
  // Blank means "not set". Storing '' would look filled to the publisher and
  // then hand the adapter an address of nothing.
  if (trimmed.length === 0) return { ok: true, value: null }
  if (trimmed.length > DESTINATION_LIMIT) return { ok: false, code: `${channel}:too_long:${DESTINATION_LIMIT}` }
  return { ok: true, value: trimmed }
}

/**
 * Reads a stored blob back as destinations, keeping only the channels we know
 * and only non-empty strings. Anything else — a row saved before this field
 * existed, a hand-edited one, an outright lie — comes back as unset rather than
 * throwing, because a bad address must cost one channel, not the whole profile.
 */
export function normalizeDestinations(value: unknown): ChannelDestinations {
  const next = emptyDestinations()
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return next

  const given = value as Record<string, unknown>
  for (const channel of BUSINESS_CHANNELS) {
    const checked = checkDestination(channel, given[channel])
    if (checked.ok) next[channel] = checked.value
  }
  return next
}

/**
 * Where this channel publishes, or null. Reads through an older profile object
 * that predates the field, so a caller never has to guard for it.
 */
export const destinationFor = (profile: BusinessProfile, channel: BusinessChannel): string | null =>
  profile.destinations?.[channel] ?? null

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
