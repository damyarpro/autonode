import { test, after, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * The factory talks to the database and the adapters, so the environment is
 * prepared before anything under `server/` is imported at all — `env.ts` reads
 * `process.env` once, at module load, and a later assignment is invisible.
 *
 * Claude is deliberately absent, which pins the producer to the templates. A
 * Telegram token is deliberately present: it is the one live channel available
 * with no network, and it is what proves a live channel with nowhere to put a
 * piece fails that piece instead of quietly counting it.
 */
const workdir = mkdtempSync(join(tmpdir(), 'autonode-content-'))
process.env.DB_FILE = join(workdir, 'content.db')
process.env.SEQUENCE_SPEED = '0'
process.env.WORKER_ENABLED = 'false'
process.env.TELEGRAM_BOT_TOKEN = 'test-token'
delete process.env.ANTHROPIC_API_KEY

const { emptyDestinations } = await import('../domain/business.ts')
const q = await import('../db/queries.ts')
const { persistPlan, produce, publishDue } = await import('./factory.ts')
const { closeDatabase } = await import('../db/index.ts')

after(() => {
  closeDatabase()
  rmSync(workdir, { recursive: true, force: true })
})

const clear = () => {
  for (const piece of q.listContent({ limit: 500 })) q.deleteContentPiece(piece.id)
}

const fillProfile = () =>
  q.saveBusiness({
    name: 'استودیو نور',
    whatWeSell: 'ساخت ویدیوی تبلیغاتی برای فروشگاه‌های کوچک',
    audience: 'صاحبان فروشگاه‌های کوچک',
    priceToman: 12_000_000,
    channels: ['instagram', 'website'],
    // No destinations by default: the publish tests below turn on the one they
    // are about, so no test depends on what an earlier one left behind.
    destinations: emptyDestinations(),
  })

const emptyProfile = () =>
  q.saveBusiness({ name: '', whatWeSell: '', audience: '', priceToman: 0, channels: [], ctaUrl: null })

before(clear)

test('an unusable profile yields an empty plan and says which fields are missing', async () => {
  emptyProfile()
  const plan = await produce({ count: 3, channels: ['instagram'] })

  assert.deepEqual(plan.pieces, [])
  assert.equal(plan.producedBy, 'none')
  assert.deepEqual(plan.blockedBy, ['name:required', 'whatWeSell:required', 'audience:required'])
  assert.deepEqual(persistPlan(plan), [], 'an empty plan stores nothing')
  assert.equal(q.listContent().length, 0)
})

test('the template producer writes one piece per requested channel, from the profile', async () => {
  fillProfile()
  const channels = ['instagram', 'telegram', 'linkedin', 'youtube', 'website'] as const
  const plan = await produce({ count: channels.length, channels: [...channels] })

  assert.equal(plan.producedBy, 'template', 'no ANTHROPIC_API_KEY means the templates wrote it')
  assert.deepEqual(plan.pieces.map((piece) => piece.channel), [...channels])
  for (const piece of plan.pieces) {
    assert.ok(piece.body.trim().length > 40, `${piece.channel} carries real copy`)
    assert.ok(piece.title.trim().length > 0)
  }
  assert.ok(plan.pieces.some((piece) => piece.body.includes('ساخت ویدیوی تبلیغاتی')))
  assert.ok(plan.pieces.some((piece) => piece.body.includes('صاحبان فروشگاه‌های کوچک')))
})

test('with no channels asked for, the plan follows the profile’s own channels', async () => {
  fillProfile()
  const plan = await produce({ count: 2 })
  assert.deepEqual(plan.pieces.map((piece) => piece.channel), ['instagram', 'website'])
})

test('a persisted plan comes back pending, with its schedule and its body', async () => {
  clear()
  fillProfile()
  const plan = await produce({ count: 2, channels: ['website'], perDay: 1, speed: 1, from: new Date() })
  const stored = persistPlan(plan)

  assert.equal(stored.length, 2)
  assert.equal(stored[0].status, 'pending')
  assert.equal(stored[0].producedBy, 'template')
  assert.equal(stored[0].body, plan.pieces[0].body)
  assert.equal(stored[0].dueAt, plan.pieces[0].dueAt.toISOString())
  assert.equal(q.countContent('pending'), 2)

  // A day apart at one a day, so only the first is ever due right now.
  assert.equal(q.dueContent(new Date()).length, 1)
})

test('a due piece goes out through its channel and is only counted once', async () => {
  clear()
  fillProfile()
  persistPlan(await produce({ count: 3, channels: ['website', 'instagram'], speed: 0 }))

  const published = await publishDue(new Date())
  assert.equal(published, 3)
  assert.equal(await publishDue(new Date()), 0, 'a second pass has nothing left to send')

  const pieces = q.listContent({ limit: 10 })
  assert.deepEqual([...new Set(pieces.map((piece) => piece.status))], ['simulated'])
  assert.ok(pieces.every((piece) => piece.publishedAt !== null))
  assert.equal(q.countContent('pending'), 0)

  const byChannel = q.publishedContentByChannel()
  assert.equal(byChannel.website + byChannel.instagram, 3)
  assert.equal(byChannel.linkedin, 0)
})

test('a piece whose hour has not come is left alone', async () => {
  clear()
  fillProfile()
  persistPlan(await produce({ count: 1, channels: ['website'], perDay: 1, speed: 1, from: new Date() }))

  const later = new Date(Date.now() + 60_000)
  assert.equal(await publishDue(new Date(Date.now() - 60_000)), 0)
  assert.equal(q.countContent('pending'), 1)
  assert.equal(await publishDue(later), 1)
})

test('a live channel with nowhere to put a piece fails it and the pass carries on', async () => {
  clear()
  fillProfile()
  persistPlan(await produce({ count: 2, channels: ['telegram', 'website'], speed: 0 }))

  const published = await publishDue(new Date())
  assert.equal(published, 1, 'the website piece still went out')

  const failed = q.listContent({ status: 'failed' })
  assert.equal(failed.length, 1)
  assert.equal(failed[0].channel, 'telegram')
  assert.equal(failed[0].note, 'target:required')
  assert.equal(q.listContent({ status: 'simulated' })[0].channel, 'website')
})

test('deleting a piece takes its schedule with it', async () => {
  clear()
  fillProfile()
  const [piece] = persistPlan(await produce({ count: 1, channels: ['website'], speed: 0 }))

  assert.equal(q.deleteContentPiece(piece.id), true)
  assert.equal(q.deleteContentPiece(piece.id), false)
  assert.equal(q.getContentPiece(piece.id), undefined)
  assert.equal(q.listContent().length, 0)
})

test('a non-live channel records the destination the profile names for it', async () => {
  clear()
  fillProfile()
  persistPlan(await produce({ count: 1, channels: ['website'], speed: 0 }))

  // Filled in after the batch was written, which is the whole reason the
  // address is resolved when the piece publishes rather than when it is made.
  q.saveBusiness({ destinations: { ...emptyDestinations(), website: 'https://noor.example/api/posts' } })

  assert.equal(await publishDue(new Date()), 1)
  const [piece] = q.listContent({ limit: 1 })
  assert.equal(piece.status, 'simulated', 'the website adapter only records; it does not deliver')
  assert.equal(piece.target, 'https://noor.example/api/posts', 'the row remembers where it went')
})

test('a live channel with a destination delivers to exactly that address', async () => {
  clear()
  fillProfile()
  q.saveBusiness({ destinations: { ...emptyDestinations(), telegram: '@wave-tools' } })
  persistPlan(await produce({ count: 1, channels: ['telegram'], speed: 0 }))

  // The one live channel available offline, so the network is the stub: what
  // matters is that the owner's destination is what the adapter is handed.
  const realFetch = globalThis.fetch
  let sentTo: unknown = null
  globalThis.fetch = (async (_url: unknown, init: { body: string }) => {
    sentTo = (JSON.parse(init.body) as { chat_id: unknown }).chat_id
    return { ok: true, json: async () => ({ ok: true, result: { message_id: 77 } }) }
  }) as unknown as typeof fetch

  try {
    assert.equal(await publishDue(new Date()), 1, 'the piece now has somewhere to go')
  } finally {
    globalThis.fetch = realFetch
  }

  assert.equal(sentTo, '@wave-tools')
  const [piece] = q.listContent({ limit: 1 })
  assert.equal(piece.status, 'sent')
  assert.equal(piece.target, '@wave-tools')
  assert.equal(q.listContent({ status: 'failed' }).length, 0)
})

test('clearing a destination brings back target:required, reason intact', async () => {
  clear()
  fillProfile()
  q.saveBusiness({ destinations: { ...emptyDestinations(), telegram: '   ' } })
  persistPlan(await produce({ count: 1, channels: ['telegram'], speed: 0 }))

  assert.equal(await publishDue(new Date()), 0)
  const failed = q.listContent({ status: 'failed' })
  assert.equal(failed.length, 1)
  assert.equal(failed[0].note, 'target:required')
  assert.equal(failed[0].target, null, 'a blank destination is not set, not an empty address')
})
