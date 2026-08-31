/**
 * Real ad-video generation through Higgsfield, behind `HIGGSFIELD_API_KEY`.
 *
 * UNVERIFIED: no account exists in this repository, so this call has never run
 * against the live API. It follows the documented shape — submit a text-to-video
 * job, poll the job set until it carries a URL — and every part of it that a
 * future API change could move (base URL, path, poll budget) is an environment
 * variable, so fixing it needs no code. Generation is asynchronous, so a job
 * that has not finished inside the poll budget is NOT reported as rendered: the
 * storyboard is recorded instead, with the provider's job id kept so the owner
 * can collect the video where it lands.
 *
 * The variables are read from `process.env` at call time instead of `env.ts`
 * so this adapter is self-contained and a test can toggle them.
 */
import { setTimeout as sleep } from 'node:timers/promises'
import { briefOnlyVideo } from './brief-only.ts'
import type { AdVideoAdapter, AdVideoInput } from './types.ts'

const apiKey = () => process.env.HIGGSFIELD_API_KEY ?? ''
const apiSecret = () => process.env.HIGGSFIELD_API_SECRET ?? ''
const baseUrl = () => (process.env.HIGGSFIELD_API_URL ?? 'https://platform.higgsfield.ai/v1').replace(/\/$/, '')
const model = () => process.env.HIGGSFIELD_MODEL || 'text2video'

const pollMs = () => Number(process.env.HIGGSFIELD_POLL_MS ?? 3000)
const pollAttempts = () => Number(process.env.HIGGSFIELD_POLL_ATTEMPTS ?? 20)

export const hasHiggsfield = (): boolean => apiKey().length > 0

const headers = () => ({
  'content-type': 'application/json',
  'hf-api-key': apiKey(),
  'hf-secret': apiSecret(),
})

type JobSet = {
  id?: string
  jobs?: { status?: string; results?: { raw?: { url?: string }; min?: { url?: string } } }[]
}

const finishedUrl = (set: JobSet): string | undefined =>
  set.jobs?.find((job) => job.status === 'completed')?.results?.raw?.url

const failed = (set: JobSet): boolean =>
  (set.jobs?.length ?? 0) > 0 && (set.jobs ?? []).every((job) => job.status === 'failed' || job.status === 'canceled')

async function submit(input: AdVideoInput): Promise<string> {
  const response = await fetch(`${baseUrl()}/${model()}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      params: {
        prompt: input.brief,
        ...(input.style ? { style: input.style } : {}),
      },
    }),
  })
  if (!response.ok) throw new Error(`higgsfield answered ${response.status}`)

  const set = (await response.json()) as JobSet
  if (!set.id) throw new Error('higgsfield returned no job id')
  return set.id
}

/** Bounded on purpose: a render that outlives the budget is not a failure. */
async function waitForVideo(jobSetId: string): Promise<string | undefined> {
  for (let attempt = 0; attempt < pollAttempts(); attempt += 1) {
    await sleep(pollMs())
    const response = await fetch(`${baseUrl()}/job-sets/${encodeURIComponent(jobSetId)}`, { headers: headers() })
    if (!response.ok) throw new Error(`higgsfield answered ${response.status} while polling`)

    const set = (await response.json()) as JobSet
    const url = finishedUrl(set)
    if (url) return url
    if (failed(set)) throw new Error('higgsfield reported the job failed')
  }
  return undefined
}

export const higgsfieldVideo: AdVideoAdapter = {
  name: 'higgsfield',
  live: true,

  async render(input: AdVideoInput) {
    let jobSetId: string | undefined
    try {
      jobSetId = await submit(input)
      const url = await waitForVideo(jobSetId)
      if (url) return { status: 'rendered' as const, externalId: jobSetId, url }

      console.warn(`[media] higgsfield job ${jobSetId} is still rendering; recording the storyboard`)
      const pending = await briefOnlyVideo.render(input)
      return { ...pending, externalId: jobSetId, reason: 'higgsfield:still_rendering' }
    } catch (error) {
      console.warn('[media] higgsfield failed; recording the storyboard instead:', (error as Error).message)
      const storyboarded = await briefOnlyVideo.render(input)
      return { ...storyboarded, externalId: jobSetId, reason: 'higgsfield:unavailable' }
    }
  },
}
