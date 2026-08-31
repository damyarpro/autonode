import type { Lead } from '../../types.ts'
import type { PlaceCallInput, VoiceAdapter } from '../types.ts'

/**
 * Vapi places the outbound call and runs the assistant on it. Its variables are
 * read from `process.env` at call time rather than from `env.ts`, so a test can
 * toggle them and so this adapter stays self-contained.
 */
const read = () => ({
  apiKey: process.env.VAPI_API_KEY ?? '',
  assistantId: process.env.VAPI_ASSISTANT_ID ?? '',
  phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID ?? '',
  base: (process.env.VAPI_API_BASE ?? 'https://api.vapi.ai').replace(/\/+$/, ''),
})

/** Both are needed: a key with no assistant has nothing to say on the call. */
export function hasVapi(): boolean {
  const { apiKey, assistantId } = read()
  return apiKey.length > 0 && assistantId.length > 0
}

/** Default country for a number written the local way. 98 is Iran. */
const defaultCallingCode = () => (process.env.DEFAULT_CALLING_CODE ?? '98').replace(/\D/g, '')

/**
 * The only number we ever hold for a lead is their handle, and on most channels
 * that is a username. Anything that is not a phone number means there is
 * nothing to dial.
 *
 * Vapi wants E.164. A Persian speaker writes their number as `09123456789`, and
 * prefixing that with `+` produces `+09…`, which every carrier rejects — so the
 * national trunk `0` is replaced by the country's calling code instead.
 */
export function dialableNumber(lead: Lead): string | null {
  const handle = lead.handle?.trim() ?? ''
  if (!/^\+?[\d][\d\s\-()]{6,19}$/.test(handle)) return null

  const digits = handle.replace(/\D/g, '')
  if (handle.startsWith('+')) return `+${digits}`
  if (digits.startsWith('00')) return `+${digits.slice(2)}`

  const code = defaultCallingCode()
  if (digits.startsWith('0')) return `+${code}${digits.slice(1)}`
  // Already carries its country code, e.g. 989123456789.
  if (digits.startsWith(code)) return `+${digits}`
  return `+${code}${digits}`
}

const TIMEOUT_MS = 15_000

export const vapiVoice: VoiceAdapter = {
  name: 'vapi',
  live: true,

  async placeCall({ lead, brief, slotStart }: PlaceCallInput) {
    const { apiKey, assistantId, phoneNumberId, base } = read()
    const number = dialableNumber(lead)
    // No number is not a failure of the call, it is a call that cannot happen —
    // the brief still exists, so the owner can dial it themselves.
    if (!number) {
      console.warn(`[voice] lead ${lead.id} has no dialable number; leaving the brief for the owner`)
      return { status: 'simulated' as const }
    }

    try {
      const response = await fetch(`${base}/call`, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        body: JSON.stringify({
          assistantId,
          ...(phoneNumberId ? { phoneNumberId } : {}),
          customer: { number, name: lead.name ?? undefined },
          assistantOverrides: {
            variableValues: {
              name: lead.name ?? '',
              locale: lead.locale,
              opening: brief.opening,
              objections: brief.objections
                .map((entry) => `${entry.objection} → ${entry.answer}`)
                .join('\n'),
              ask: brief.ask,
              slotStart: slotStart ?? '',
            },
          },
        }),
      })

      if (!response.ok) {
        console.warn(`[voice] vapi refused the call for lead ${lead.id}: ${response.status}`)
        return { status: 'failed' as const }
      }

      const payload = (await response.json()) as { id?: string }
      return { status: 'dialled' as const, externalId: payload.id }
    } catch (error) {
      // Never throw: a dead provider must not take the funnel pass down.
      console.warn('[voice] vapi call failed:', (error as Error).message)
      return { status: 'failed' as const }
    }
  },
}
