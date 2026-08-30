import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyBusiness } from './business.ts'
import {
  angleFor,
  briefsFor,
  draftErrors,
  kindFor,
  mergeDrafts,
  normalizeRequest,
  planSchedule,
  templateContent,
  CONTENT_ANGLES,
  MAX_COUNT,
  type ContentBrief,
  type ContentDraft,
} from './content.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const FROM = new Date('2026-01-01T08:00:00.000Z')

const filled = () => ({
  ...emptyBusiness(),
  name: 'استودیو نور',
  whatWeSell: 'ساخت ویدیوی تبلیغاتی برای فروشگاه‌های کوچک',
  audience: 'صاحبان فروشگاه‌های کوچک',
  priceToman: 12_000_000,
  ctaUrl: 'https://example.com/start',
  channels: ['instagram' as const, 'telegram' as const],
})

const draft = (over: Partial<ContentDraft> = {}): ContentDraft => ({
  channel: 'instagram',
  kind: 'video',
  angle: 'problem',
  title: 'قلاب مشکل',
  body: 'یک متن واقعی',
  ...over,
})

// ── schedule ─────────────────────────────────────────────────────────────

test('two a day lands twelve hours apart and rolls into the next day', () => {
  const planned = planSchedule([draft(), draft(), draft()], FROM, 2)
  const offsets = planned.map((piece) => piece.dueAt.getTime() - FROM.getTime())
  assert.deepEqual(offsets, [0, 12 * HOUR, 24 * HOUR])
})

test('one a day is a day apart, four a day is six hours apart', () => {
  const day = planSchedule([draft(), draft()], FROM, 1)
  assert.equal(day[1].dueAt.getTime() - day[0].dueAt.getTime(), 24 * HOUR)

  const six = planSchedule([draft(), draft()], FROM, 4)
  assert.equal(six[1].dueAt.getTime() - six[0].dueAt.getTime(), 6 * HOUR)
})

test('speed scales the spacing the way a nurture sequence does', () => {
  const half = planSchedule([draft(), draft()], FROM, 2, 0.5)
  assert.equal(half[1].dueAt.getTime() - half[0].dueAt.getTime(), 6 * HOUR)
})

test('speed 0 makes every piece due immediately', () => {
  const now = planSchedule([draft(), draft(), draft()], FROM, 2, 0)
  assert.deepEqual(
    now.map((piece) => piece.dueAt.toISOString()),
    [FROM.toISOString(), FROM.toISOString(), FROM.toISOString()],
  )
})

test('the schedule keeps the order it was given and never goes backwards', () => {
  const planned = planSchedule([draft({ title: 'a' }), draft({ title: 'b' }), draft({ title: 'c' })], FROM, 3)
  assert.deepEqual(planned.map((piece) => piece.title), ['a', 'b', 'c'])
  for (let index = 1; index < planned.length; index += 1) {
    assert.ok(planned[index].dueAt.getTime() > planned[index - 1].dueAt.getTime())
  }
})

test('a nonsense rate falls back instead of producing an invalid date', () => {
  for (const perDay of [0, -3, Number.NaN]) {
    const planned = planSchedule([draft(), draft()], FROM, perDay)
    assert.ok(Number.isFinite(planned[1].dueAt.getTime()))
    assert.ok(planned[1].dueAt.getTime() > planned[0].dueAt.getTime())
  }
})

test('a negative speed is treated as due-now rather than scheduled in the past', () => {
  const planned = planSchedule([draft(), draft()], FROM, 2, -1)
  assert.equal(planned[1].dueAt.getTime(), FROM.getTime())
})

// ── briefs ───────────────────────────────────────────────────────────────

test('every requested channel gets a brief before any channel gets a second', () => {
  const briefs = briefsFor(['instagram', 'telegram', 'linkedin'], 3)
  assert.deepEqual(briefs.map((brief) => brief.channel), ['instagram', 'telegram', 'linkedin'])
})

test('a channel only gets a kind it can carry, and rotates through them', () => {
  assert.equal(kindFor('linkedin', 0), 'copy')
  assert.equal(kindFor('linkedin', 7), 'copy')
  assert.equal(kindFor('youtube', 0), 'video')
  assert.equal(kindFor('youtube', 1), 'voice')
  assert.equal(kindFor('youtube', 2), 'video')
})

test('the angle rotates so a batch does not repeat one frame', () => {
  const seen = new Set(briefsFor(['website'], CONTENT_ANGLES.length).map((brief) => brief.angle))
  assert.equal(seen.size, CONTENT_ANGLES.length)
  assert.equal(angleFor(CONTENT_ANGLES.length), CONTENT_ANGLES[0])
})

test('no channels means all of them rather than nothing', () => {
  assert.equal(briefsFor([], 5).length, 5)
  assert.equal(briefsFor([], 0).length, 0)
})

// ── validation ───────────────────────────────────────────────────────────

test('a piece must carry a body, a title, a real channel and a real kind', () => {
  assert.deepEqual(draftErrors(draft()), [])
  assert.deepEqual(draftErrors(draft({ body: '   ' })), ['body:required'])
  assert.deepEqual(draftErrors(draft({ title: '' })), ['title:required'])
  assert.deepEqual(draftErrors(draft({ channel: 'tiktok' as never })), ['channel:not_an_option'])
  assert.deepEqual(draftErrors(draft({ kind: 'poem' as never })), ['kind:not_an_option'])
})

test('a batch that came back short or blank is discarded whole', () => {
  const briefs: ContentBrief[] = briefsFor(['instagram', 'telegram'], 2)
  assert.equal(mergeDrafts(briefs, [{ title: 'a', body: 'b' }]).length, 0)
  assert.equal(mergeDrafts(briefs, [{ title: 'a', body: 'b' }, { title: 'c', body: '  ' }]).length, 0)

  const merged = mergeDrafts(briefs, [
    { title: 'a', body: 'b' },
    { title: 'c', body: 'd' },
  ])
  assert.deepEqual(merged.map((piece) => piece.channel), ['instagram', 'telegram'])
})

test('a producer cannot move a piece to another channel', () => {
  const briefs = briefsFor(['linkedin'], 1)
  const merged = mergeDrafts(briefs, [{ title: 'a', body: 'b', channel: 'youtube' } as never])
  assert.equal(merged[0].channel, 'linkedin')
})

test('a produce request is clamped, and a bad one comes back as codes', () => {
  const ok = normalizeRequest({ count: 999, channels: ['telegram', 'telegram'], locale: 'en' })
  assert.ok(ok.ok)
  assert.equal(ok.request.count, MAX_COUNT)
  assert.deepEqual(ok.request.channels, ['telegram'])
  assert.equal(ok.request.locale, 'en')

  const bad = normalizeRequest({ count: 0, channels: ['tiktok'] })
  assert.ok(!bad.ok)
  assert.deepEqual(bad.errors, ['count:not_a_number', 'channels:not_an_option'])

  const empty = normalizeRequest(undefined)
  assert.ok(empty.ok)
  assert.equal(empty.request.locale, 'fa')
})

// ── the offline copy ─────────────────────────────────────────────────────

test('the template producer answers every brief with the owner’s own words', () => {
  const briefs = briefsFor(['instagram', 'telegram', 'linkedin', 'youtube', 'website'], 5)
  const written = templateContent(filled(), briefs, 'fa')

  assert.equal(written.length, briefs.length)
  for (const piece of written) {
    assert.ok(piece.body.trim().length > 40, 'a piece is real copy, not a stub')
    assert.ok(piece.title.trim().length > 0)
  }
  assert.ok(written.some((piece) => piece.body.includes('ساخت ویدیوی تبلیغاتی')))
  assert.ok(written.some((piece) => piece.body.includes('صاحبان فروشگاه‌های کوچک')))
  assert.ok(written.some((piece) => piece.body.includes('https://example.com/start')))
})

test('each kind comes out in the shape its channel needs', () => {
  const briefs: ContentBrief[] = [
    { channel: 'youtube', kind: 'video', angle: 'problem' },
    { channel: 'instagram', kind: 'voice', angle: 'offer' },
    { channel: 'linkedin', kind: 'copy', angle: 'question' },
  ]
  const [video, voice, copy] = templateContent(filled(), briefs, 'en')

  assert.match(video.body, /0–3s \| hook:/)
  assert.match(voice.body, /Voiceover script/)
  assert.doesNotMatch(copy.body, /0–3s/)
  assert.match(voice.body, /short pause/)
})

test('the price is only quoted when the owner set one', () => {
  const briefs: ContentBrief[] = [{ channel: 'website', kind: 'copy', angle: 'offer' }]
  assert.match(templateContent(filled(), briefs, 'en')[0].body, /12,000,000 Toman/)
  assert.doesNotMatch(
    templateContent({ ...filled(), priceToman: 0 }, briefs, 'en')[0].body,
    /Toman/,
  )
})

test('an unusable profile produces nothing rather than an invented offer', () => {
  const briefs = briefsFor(['instagram', 'telegram'], 2)
  assert.deepEqual(templateContent(emptyBusiness(), briefs, 'fa'), [])
  assert.deepEqual(templateContent({ ...emptyBusiness(), whatWeSell: 'x' }, briefs, 'fa'), [])
  assert.equal(templateContent({ ...emptyBusiness(), whatWeSell: 'x', audience: 'y' }, briefs, 'fa').length, 2)
})

test('both languages are written, and the copy around the offer follows the locale', () => {
  // An English-worded profile, so anything Persian left in the English piece
  // came from the template rather than from the owner.
  const business = {
    ...emptyBusiness(),
    name: 'Noor Studio',
    whatWeSell: 'ad videos for small shops',
    audience: 'small shop owners',
  }
  const briefs: ContentBrief[] = [{ channel: 'website', kind: 'voice', angle: 'problem' }]
  const fa = templateContent(business, briefs, 'fa')[0]
  const en = templateContent(business, briefs, 'en')[0]

  assert.notEqual(fa.body, en.body)
  assert.match(fa.body, /[؀-ۿ]/, 'the Persian piece is in Persian')
  assert.doesNotMatch(en.body, /[؀-ۿ]/, 'the English piece carries no Persian')
})
