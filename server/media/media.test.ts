/**
 * The media node's tests. Two halves: the pure functions that make the
 * no-credential artefacts real (the timing estimate and the storyboard split),
 * and the wiring — which adapter the registry picks on an empty environment,
 * what a failing provider does, and what ends up in the database.
 *
 * `MEDIA_DIR` is pointed at a throwaway directory before anything is imported,
 * because a rendered file is written to disk.
 */
import { test, after, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Fastify from 'fastify'

const workdir = mkdtempSync(join(tmpdir(), 'autonode-media-'))
process.env.MEDIA_DIR = join(workdir, 'media')
delete process.env.ELEVENLABS_API_KEY
delete process.env.HIGGSFIELD_API_KEY

const { countWords, scriptOnlyVoice, splitSpeakable, timeScript } = await import('../adapters/media/script-only.ts')
const { briefOnlyVideo, storyboardFromBrief } = await import('../adapters/media/brief-only.ts')
const { elevenLabsVoice } = await import('../adapters/media/elevenlabs.ts')
const { higgsfieldVideo } = await import('../adapters/media/higgsfield.ts')
const { adVideo, voiceover } = await import('../adapters/registry.ts')
const { listMediaJobs, renderAdVideo, renderVoiceover } = await import('./media.ts')
const { open, useDatabase } = await import('../db/index.ts')
const q = await import('../db/queries.ts')
const { default: mediaRoutes } = await import('../routes/media.ts')

useDatabase(open(':memory:'))

const app = Fastify({ logger: false })
before(async () => {
  await app.register(mediaRoutes)
  await app.ready()
})

after(async () => {
  await app.close()
  rmSync(workdir, { recursive: true, force: true })
})

const realFetch = globalThis.fetch
const withFetch = async (fake: typeof globalThis.fetch, body: () => Promise<void>) => {
  globalThis.fetch = fake
  try {
    await body()
  } finally {
    globalThis.fetch = realFetch
  }
}

const post = (url: string, payload: unknown) =>
  app.inject({ method: 'POST', url, headers: { 'content-type': 'application/json' }, payload: JSON.stringify(payload) })

// ── counting words ───────────────────────────────────────────────────────

test('an empty script has no words, no lines and no duration', () => {
  for (const empty of ['', '   ', '\n\n', '— …']) {
    assert.equal(countWords(empty), 0, empty)
    const timed = timeScript(empty)
    assert.deepEqual(timed.lines, [])
    assert.equal(timed.durationSec, 0)
    assert.equal(timed.words, 0)
  }
})

test('a Persian word joined by a zero-width non-joiner counts once', () => {
  assert.equal(countWords('می‌روم'), 1)
  assert.equal(countWords('می‌روم و می‌آیم'), 3)
  assert.equal(countWords('این ویدیو را کامل ببینید'), 5)
})

test('punctuation on its own is not a word', () => {
  assert.equal(countWords('سلام — دنیا'), 2)
  assert.equal(countWords('one , two ; three'), 3)
})

// ── timing the script ────────────────────────────────────────────────────

test('one word is still a full line with a floor on its duration', () => {
  const timed = timeScript('سلام')
  assert.equal(timed.lines.length, 1)
  assert.equal(timed.lines[0]!.words, 1)
  assert.ok(timed.lines[0]!.seconds >= 0.6, 'a one-word line never rounds to nothing')
  assert.equal(timed.durationSec, timed.lines[0]!.seconds)
  assert.equal(timed.lines[0]!.startSec, 0)
})

test('lines are numbered, timed from their word count, and the clock adds up', () => {
  const timed = timeScript('Buy nothing yet. Watch this first. Then decide.')
  assert.equal(timed.lines.length, 3)
  assert.deepEqual(
    timed.lines.map((line) => line.index),
    [1, 2, 3],
  )
  assert.equal(timed.words, countWords('Buy nothing yet. Watch this first. Then decide.'))

  let clock = 0
  for (const line of timed.lines) {
    assert.equal(line.startSec, Math.round(clock * 10) / 10, `line ${line.index} starts where the last one ended`)
    clock += line.seconds
  }
  assert.equal(timed.durationSec, Math.round(clock * 10) / 10)
  assert.ok(timed.durationSec > 0)
})

test('a long script is broken into lines a narrator can say in one breath', () => {
  const long = `${'word '.repeat(400).trim()}.`
  const timed = timeScript(long)

  assert.equal(timed.words, 400)
  assert.ok(timed.lines.length >= 16, 'four hundred words is not one line')
  for (const line of timed.lines) assert.ok(line.words <= 24, `line ${line.index} has ${line.words} words`)
  // 400 words at 150 wpm is 160 seconds before a single breath pause.
  assert.ok(timed.durationSec > 160, `expected more than 160s, got ${timed.durationSec}`)
})

test('a long Persian sentence splits on its clauses rather than mid-thought', () => {
  const sentence =
    'اگر می‌خواهی فروش بیشتری داشته باشی، اول باید بدانی مشتری تو کیست، بعد پیام درست را برایش بنویسی، و بعد همان پیام را هر هفته تکرار کنی، بدون اینکه خسته‌کننده شوی، و بعد نتیجه را اندازه بگیری.'
  const lines = splitSpeakable(sentence)
  assert.ok(lines.length > 1, 'one long sentence is not one line')
  for (const line of lines) assert.ok(countWords(line) <= 24)
  assert.ok(lines.every((line) => line.trim().length > 0))
})

test('a Persian question mark ends a line the same way a full stop does', () => {
  const lines = splitSpeakable('چرا هیچ‌کس محصولت را نمی‌خرد؟ چون هنوز نمی‌داند برای کیست.')
  assert.equal(lines.length, 2)
  assert.match(lines[0]!, /؟$/)
})

test('a faster pace makes the same script shorter', () => {
  const slow = timeScript('one two three four five six seven eight', { wordsPerMinute: 100 })
  const fast = timeScript('one two three four five six seven eight', { wordsPerMinute: 200 })
  assert.ok(fast.durationSec < slow.durationSec)
  assert.equal(fast.wordsPerMinute, 200)
})

test('the requested voice is kept with the script so a later render matches it', () => {
  assert.equal(timeScript('hello', { voice: '  Rachel ' }).voice, 'Rachel')
  assert.equal(timeScript('hello').voice, null)
})

// ── the storyboard ───────────────────────────────────────────────────────

test('a brief becomes shots that open on a hook and close on the call to action', () => {
  const board = storyboardFromBrief(
    'Most shops lose half their leads in the first hour. Our bot answers in ten seconds. It books the call for you. Try it free this week.',
    { locale: 'en' },
  )

  assert.equal(board.shots.length, 4)
  assert.equal(board.shots[0]!.role, 'hook')
  assert.equal(board.shots.at(-1)!.role, 'cta')
  assert.deepEqual(
    board.shots.map((shot) => shot.index),
    [1, 2, 3, 4],
  )
  for (const shot of board.shots) {
    assert.ok(shot.caption.trim().length > 0, 'every shot carries on-screen text')
    assert.ok(shot.onScreen.trim().length > 0, 'every shot says what is on screen')
    assert.ok(shot.seconds >= 2 && shot.seconds <= 6, `shot ${shot.index} holds for ${shot.seconds}s`)
  }
  assert.equal(
    board.durationSec,
    Math.round(board.shots.reduce((total, shot) => total + shot.seconds, 0) * 10) / 10,
  )
})

test('the shots are built from the brief’s own words, not invented copy', () => {
  const board = storyboardFromBrief('فروش شما در اینستاگرام گیر کرده است. ما آن را خودکار می‌کنیم.', { locale: 'fa' })
  const flat = board.shots.map((shot) => `${shot.caption} ${shot.onScreen}`).join(' ')
  assert.match(flat, /اینستاگرام/)
  assert.match(flat, /خودکار/)
})

test('a one-sentence brief is paced across shots instead of held on one frame', () => {
  const board = storyboardFromBrief('ما برای فروشگاه‌های کوچک ویدیوی تبلیغاتی کوتاه می‌سازیم که در یک روز آماده است', {
    locale: 'fa',
  })
  assert.ok(board.shots.length >= 2, `expected more than one shot, got ${board.shots.length}`)
  assert.equal(board.shots[0]!.role, 'hook')
  assert.ok(board.shots.every((shot) => shot.caption.trim().length > 0))
})

test('a very long brief is capped at eight shots and keeps its tail', () => {
  const brief = Array.from({ length: 20 }, (_, at) => `Point number ${at + 1} about the offer.`).join(' ')
  const board = storyboardFromBrief(brief, { locale: 'en' })
  assert.equal(board.shots.length, 8)
  assert.equal(board.shots.at(-1)!.role, 'cta')
  assert.match(board.shots.at(-1)!.onScreen, /Point number 8/)
})

test('an empty brief produces no shots, and the adapter says the job failed', async () => {
  assert.deepEqual(storyboardFromBrief('   ').shots, [])
  assert.equal((await briefOnlyVideo.render({ brief: '  ', locale: 'fa' })).status, 'failed')
  assert.equal((await scriptOnlyVoice.render({ script: '\n', locale: 'fa' })).status, 'failed')
})

test('the storyboard remembers the style it was asked for', () => {
  assert.equal(storyboardFromBrief('One. Two. Three.', { style: ' cinematic ' }).style, 'cinematic')
  assert.equal(storyboardFromBrief('One. Two. Three.').style, null)
})

// ── the registry on an empty environment ─────────────────────────────────

test('with no keys the registry picks the fallbacks, and they do real work', async () => {
  assert.equal(voiceover().name, 'script-only')
  assert.equal(voiceover().live, false)
  assert.equal(adVideo().name, 'brief-only')
  assert.equal(adVideo().live, false)

  const spoken = await voiceover().render({ script: 'اول این را ببین. بعد تصمیم بگیر.', locale: 'fa' })
  assert.equal(spoken.status, 'scripted')
  assert.ok(spoken.script!.lines.length >= 2)
  assert.ok(spoken.durationSec! > 0)
  assert.equal(spoken.url, undefined, 'no audio means no url')

  const filmed = await adVideo().render({ brief: 'Leads go cold. We answer first. Book a demo.', locale: 'en' })
  assert.equal(filmed.status, 'storyboarded')
  assert.ok(filmed.storyboard!.shots.length >= 3)
  assert.equal(filmed.url, undefined, 'no render means no url')
})

test('a key swaps in the real adapter', async () => {
  process.env.ELEVENLABS_API_KEY = 'test-key'
  process.env.HIGGSFIELD_API_KEY = 'test-key'
  try {
    assert.equal(voiceover().name, 'elevenlabs')
    assert.equal(voiceover().live, true)
    assert.equal(adVideo().name, 'higgsfield')
  } finally {
    delete process.env.ELEVENLABS_API_KEY
    delete process.env.HIGGSFIELD_API_KEY
  }
})

// ── the real adapters, with the network stubbed ──────────────────────────

test('a failing elevenlabs call records the timed script instead of throwing', async () => {
  process.env.ELEVENLABS_API_KEY = 'test-key'
  try {
    await withFetch(
      (async () => {
        throw new Error('network down')
      }) as typeof globalThis.fetch,
      async () => {
        const result = await elevenLabsVoice.render({ script: 'Line one. Line two.', locale: 'en' })
        assert.equal(result.status, 'scripted')
        assert.equal(result.reason, 'elevenlabs:unavailable')
        assert.ok(result.script!.lines.length >= 2)
      },
    )

    await withFetch(
      (async () => new Response('nope', { status: 401 })) as typeof globalThis.fetch,
      async () => {
        const refused = await elevenLabsVoice.render({ script: 'Line one. Line two.', locale: 'en' })
        assert.equal(refused.status, 'scripted', 'a rejected key falls back rather than losing the script')
      },
    )
  } finally {
    delete process.env.ELEVENLABS_API_KEY
  }
})

test('elevenlabs writes the audio it gets back and takes the duration from it', async () => {
  process.env.ELEVENLABS_API_KEY = 'test-key'
  try {
    await withFetch(
      (async () =>
        new Response(
          JSON.stringify({
            audio_base64: Buffer.from('not really an mp3').toString('base64'),
            alignment: { character_end_times_seconds: [0.2, 1.5, 4.25] },
          }),
          { status: 200, headers: { 'request-id': 'req_test' } },
        )) as typeof globalThis.fetch,
      async () => {
        const result = await elevenLabsVoice.render({ script: 'Say this out loud.', locale: 'en' })
        assert.equal(result.status, 'rendered')
        assert.equal(result.durationSec, 4.3)
        assert.equal(result.externalId, 'req_test')
        assert.match(result.url!, /^\/api\/media\/file\/[a-f0-9-]{36}\.mp3$/)
        assert.equal(readdirSync(process.env.MEDIA_DIR!).length, 1)
      },
    )
  } finally {
    delete process.env.ELEVENLABS_API_KEY
  }
})

test('a higgsfield job that has not finished is storyboarded, never called rendered', async () => {
  process.env.HIGGSFIELD_API_KEY = 'test-key'
  process.env.HIGGSFIELD_POLL_MS = '1'
  process.env.HIGGSFIELD_POLL_ATTEMPTS = '2'
  try {
    await withFetch(
      (async (input: unknown) =>
        new Response(
          JSON.stringify(
            String(input).includes('job-sets')
              ? { jobs: [{ status: 'in_progress' }] }
              : { id: 'job-set-1' },
          ),
          { status: 200 },
        )) as unknown as typeof globalThis.fetch,
      async () => {
        const result = await higgsfieldVideo.render({ brief: 'Leads go cold. We answer. Book a demo.', locale: 'en' })
        assert.equal(result.status, 'storyboarded')
        assert.equal(result.externalId, 'job-set-1', 'the provider job id is kept so the owner can collect it')
        assert.equal(result.reason, 'higgsfield:still_rendering')
        assert.ok(result.storyboard!.shots.length >= 3)
        assert.equal(result.url, undefined)
      },
    )

    await withFetch(
      (async () => {
        throw new Error('network down')
      }) as typeof globalThis.fetch,
      async () => {
        const result = await higgsfieldVideo.render({ brief: 'Leads go cold. We answer. Book a demo.', locale: 'en' })
        assert.equal(result.status, 'storyboarded')
        assert.equal(result.reason, 'higgsfield:unavailable')
      },
    )
  } finally {
    delete process.env.HIGGSFIELD_API_KEY
    delete process.env.HIGGSFIELD_POLL_MS
    delete process.env.HIGGSFIELD_POLL_ATTEMPTS
  }
})

test('a finished higgsfield job is reported as rendered with its url', async () => {
  process.env.HIGGSFIELD_API_KEY = 'test-key'
  process.env.HIGGSFIELD_POLL_MS = '1'
  try {
    await withFetch(
      (async (input: unknown) =>
        new Response(
          JSON.stringify(
            String(input).includes('job-sets')
              ? { jobs: [{ status: 'completed', results: { raw: { url: 'https://example.test/ad.mp4' } } }] }
              : { id: 'job-set-2' },
          ),
          { status: 200 },
        )) as unknown as typeof globalThis.fetch,
      async () => {
        const result = await higgsfieldVideo.render({ brief: 'Leads go cold. We answer. Book a demo.', locale: 'en' })
        assert.equal(result.status, 'rendered')
        assert.equal(result.url, 'https://example.test/ad.mp4')
        assert.equal(result.externalId, 'job-set-2')
      },
    )
  } finally {
    delete process.env.HIGGSFIELD_API_KEY
    delete process.env.HIGGSFIELD_POLL_MS
  }
})

// ── the recorded job ─────────────────────────────────────────────────────

test('a voiceover run is recorded with its artefact and counted on the board', async () => {
  const before = q.gatherFacts().voiceovers
  const job = await renderVoiceover({ script: 'اول این را ببین. بعد تصمیم بگیر.', locale: 'fa', voice: 'Rachel' })

  assert.equal(job.kind, 'voice')
  assert.equal(job.status, 'scripted')
  assert.equal(job.adapter, 'script-only')
  assert.equal(job.locale, 'fa')
  assert.equal((job.input as { voice: string }).voice, 'Rachel')
  assert.ok(job.durationSec! > 0)
  assert.equal(job.url, null)

  const output = job.output as { script?: { lines: unknown[] } }
  assert.ok(output.script!.lines.length >= 2, 'the artefact is stored, not just the status')
  assert.equal(q.gatherFacts().voiceovers, before + 1, 'the ELEVENLABS node counts a real artefact')
})

test('an ad-video run is recorded with its storyboard and counted on the board', async () => {
  const before = q.gatherFacts().videos
  const job = await renderAdVideo({ brief: 'Leads go cold. We answer first. Book a demo.', locale: 'en', style: 'ugc' })

  assert.equal(job.kind, 'video')
  assert.equal(job.status, 'storyboarded')
  assert.equal(job.adapter, 'brief-only')
  const output = job.output as { storyboard?: { shots: unknown[]; style: string } }
  assert.ok(output.storyboard!.shots.length >= 3)
  assert.equal(output.storyboard!.style, 'ugc')
  assert.equal(q.gatherFacts().videos, before + 1, 'the HIGGSFIELD node counts a real artefact')
})

test('an adapter that throws leaves a failed job rather than an exception', async () => {
  process.env.ELEVENLABS_API_KEY = 'test-key'
  const original = elevenLabsVoice.render
  Object.defineProperty(elevenLabsVoice, 'render', {
    value: async () => {
      throw new Error('boom')
    },
    configurable: true,
  })
  try {
    const job = await renderVoiceover({ script: 'anything', locale: 'en' })
    assert.equal(job.status, 'failed')
    assert.equal(job.adapter, 'elevenlabs')
  } finally {
    Object.defineProperty(elevenLabsVoice, 'render', { value: original, configurable: true })
    delete process.env.ELEVENLABS_API_KEY
  }
})

test('jobs come back newest first, and the limit is clamped rather than trusted', async () => {
  const all = listMediaJobs(1000)
  assert.ok(all.length >= 3)
  assert.ok(all[0]!.id > all[1]!.id, 'newest first')
  assert.equal(listMediaJobs(1).length, 1)
  assert.equal(listMediaJobs(Number.NaN).length, Math.min(all.length, 20))
  assert.ok(listMediaJobs(50, 'video').every((job) => job.kind === 'video'))
})

// ── the routes ───────────────────────────────────────────────────────────

test('bad input comes back as field:code, never as a sentence', async () => {
  const missing = await post('/api/media/voice', {})
  assert.equal(missing.statusCode, 400)
  assert.deepEqual(missing.json().errors, ['script:required'])

  assert.deepEqual((await post('/api/media/voice', { script: 12 })).json().errors, ['script:not_text'])
  assert.deepEqual((await post('/api/media/voice', { script: '   ' })).json().errors, ['script:required'])
  assert.deepEqual((await post('/api/media/voice', { script: 'x'.repeat(5001) })).json().errors, [
    'script:too_long:5000',
  ])
  assert.deepEqual((await post('/api/media/voice', { script: 'ok', locale: 'de' })).json().errors, [
    'locale:not_an_option',
  ])
  assert.deepEqual((await post('/api/media/video', {})).json().errors, ['brief:required'])
  assert.deepEqual((await post('/api/media/video', { brief: 'ok', style: 'x'.repeat(81) })).json().errors, [
    'style:too_long:80',
  ])
})

test('the routes produce a job, list it, serve nothing it did not write, and delete it', async () => {
  const created = await post('/api/media/voice', { script: 'Watch this first. Then decide.', locale: 'en' })
  assert.equal(created.statusCode, 201)
  const job = created.json().job as { id: number; status: string }
  assert.equal(job.status, 'scripted')

  const listed = await app.inject({ method: 'GET', url: '/api/media?limit=5' })
  assert.equal(listed.statusCode, 200)
  const body = listed.json() as { jobs: { id: number }[]; adapters: { voiceover: string; adVideo: string } }
  assert.equal(body.jobs[0]!.id, job.id)
  assert.deepEqual(body.adapters, { voiceover: 'script-only', adVideo: 'brief-only' })

  const video = await post('/api/media/video', { brief: 'Leads go cold. We answer. Book a demo.' })
  assert.equal(video.statusCode, 201)
  assert.equal(video.json().job.kind, 'video')

  assert.equal((await app.inject({ method: 'GET', url: '/api/media/file/../../etc/passwd' })).statusCode, 404)
  assert.equal((await app.inject({ method: 'GET', url: '/api/media/file/nope.mp3' })).statusCode, 404)

  assert.equal((await app.inject({ method: 'DELETE', url: `/api/media/${job.id}` })).statusCode, 200)
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/media/${job.id}` })).statusCode, 404)
  assert.equal((await app.inject({ method: 'DELETE', url: '/api/media/abc' })).statusCode, 404)
})
