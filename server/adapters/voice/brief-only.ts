import type { PlaceCallInput, VoiceAdapter } from '../types.ts'

/**
 * The no-credentials default, and the reason the voice node is real without a
 * paid account.
 *
 * The work product of a voice call is not the dial tone — it is knowing what to
 * say. `server/calls/calls.ts` writes the brief (opening, the two objections
 * this lead's own log predicts, the exact ask) and stores it against the call
 * whichever adapter is selected. This one stops there and marks the call
 * `simulated`, so the owner picks up the phone themselves with the brief in
 * hand. Only the dialling is gated by credentials.
 */
export const briefOnlyVoice: VoiceAdapter = {
  name: 'brief-only',
  live: false,

  async placeCall(_input: PlaceCallInput) {
    return { status: 'simulated' as const }
  },
}
