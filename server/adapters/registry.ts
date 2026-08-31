import { CHANNELS, type Channel } from '../types.ts'
import { hasClaude, hasTelegram } from '../env.ts'
import { storeOnlyChannel } from './channels/store-only.ts'
import { telegramChannel } from './channels/telegram.ts'
import { hasLinkedIn, linkedinChannel } from './channels/linkedin.ts'
import { hasInstagram, instagramChannel } from './channels/instagram.ts'
import { hasYouTube, youtubeChannel } from './channels/youtube.ts'
import { hasWebsite, websiteChannel } from './channels/website.ts'
import { templateAi } from './ai/template.ts'
import { claudeAi } from './ai/claude.ts'
import { mockPayments } from './payments/mock.ts'
import { scriptOnlyVoice } from './media/script-only.ts'
import { elevenLabsVoice, hasElevenLabs } from './media/elevenlabs.ts'
import { briefOnlyVideo } from './media/brief-only.ts'
import { hasHiggsfield, higgsfieldVideo } from './media/higgsfield.ts'
import { briefOnlyVoice } from './voice/brief-only.ts'
import { hasVapi, vapiVoice } from './voice/vapi.ts'
import type { AiAdapter, ChannelAdapter, PaymentAdapter, VoiceAdapter } from './types.ts'
import type { AdVideoAdapter, VoiceoverAdapter } from './media/types.ts'

/**
 * Real adapter when credentials exist, working fallback otherwise. Each `has*`
 * helper lives beside its own adapter and reads `process.env` at call time, so
 * a channel goes live the moment its credentials appear and no other channel
 * is affected by what is missing from the environment.
 */
export function channelFor(channel: Channel): ChannelAdapter {
  if (channel === 'telegram' && hasTelegram()) return telegramChannel
  if (channel === 'linkedin' && hasLinkedIn()) return linkedinChannel
  if (channel === 'instagram' && hasInstagram()) return instagramChannel
  if (channel === 'youtube' && hasYouTube()) return youtubeChannel
  if (channel === 'website' && hasWebsite()) return websiteChannel
  return storeOnlyChannel(channel)
}

export const ai = (): AiAdapter => (hasClaude() ? claudeAi : templateAi)

export const payments = (): PaymentAdapter => mockPayments

/**
 * Vapi dials when it is configured; otherwise the brief-only adapter prepares
 * the call and leaves the phone to the owner. Either way the brief gets written.
 */
export const voice = (): VoiceAdapter => (hasVapi() ? vapiVoice : briefOnlyVoice)

/**
 * ELEVENLABS. Without a key the fallback still finishes the script and times
 * it, so the node produces a real artefact on an empty environment — the two
 * `has*` helpers live beside their adapters rather than in `env.ts`, which
 * keeps each media adapter self-contained.
 */
export const voiceover = (): VoiceoverAdapter => (hasElevenLabs() ? elevenLabsVoice : scriptOnlyVoice)

/** HIGGSFIELD. Without a key the fallback still returns the shot list. */
export const adVideo = (): AdVideoAdapter => (hasHiggsfield() ? higgsfieldVideo : briefOnlyVideo)

/** Shown on /api/health so it is never a guess which half is real. */
export const adapterStatus = () => ({
  channels: Object.fromEntries(CHANNELS.map((c) => [c, channelFor(c).live ? 'live' : 'simulated'])),
  ai: ai().name,
  voice: voice().name,
  payments: payments().provider,
  voiceover: voiceover().name,
  adVideo: adVideo().name,
})
