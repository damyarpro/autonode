import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DESTINATION_LIMIT,
  businessBrief,
  checkDestination,
  destinationFor,
  emptyBusiness,
  emptyDestinations,
  isUsable,
  missingFields,
  normalizeDestinations,
} from './business.ts'

const filled = () => ({
  ...emptyBusiness(),
  name: 'استودیو نور',
  whatWeSell: 'ساخت ویدیوی تبلیغاتی برای فروشگاه‌های کوچک',
  audience: 'صاحبان فروشگاه‌های کوچک',
  priceToman: 12_000_000,
  channels: ['instagram' as const],
})

test('a profile is usable once it says what is sold and to whom', () => {
  assert.equal(isUsable(emptyBusiness()), false)
  assert.equal(isUsable({ ...emptyBusiness(), whatWeSell: 'x' }), false)
  assert.equal(isUsable({ ...emptyBusiness(), whatWeSell: 'x', audience: 'y' }), true)
  assert.equal(isUsable({ ...emptyBusiness(), whatWeSell: '  ', audience: 'y' }), false)
})

test('missing fields are reported as machine-readable codes', () => {
  assert.deepEqual(missingFields(emptyBusiness()), [
    'name:required',
    'whatWeSell:required',
    'audience:required',
  ])
  assert.deepEqual(missingFields(filled()), [])
})

test('an unfilled profile tells the model to stay general rather than invent', () => {
  const brief = businessBrief(emptyBusiness(), 'en')
  assert.match(brief, /has not filled in/)
  assert.doesNotMatch(brief, /Sells:/)
})

test('a filled profile carries the offer, the audience and the price', () => {
  const brief = businessBrief(filled(), 'en')
  assert.match(brief, /استودیو نور/)
  assert.match(brief, /ساخت ویدیوی تبلیغاتی/)
  assert.match(brief, /12,000,000 Toman/)
  assert.match(brief, /instagram/)
})

test('a zero price is left out rather than shown as free', () => {
  const brief = businessBrief({ ...filled(), priceToman: 0 }, 'en')
  assert.doesNotMatch(brief, /Typical price/)
})

test('a destination is trimmed, and blank means not set rather than an empty address', () => {
  assert.deepEqual(checkDestination('telegram', '  @mychannel  '), { ok: true, value: '@mychannel' })
  assert.deepEqual(checkDestination('telegram', '   '), { ok: true, value: null })
  assert.deepEqual(checkDestination('telegram', ''), { ok: true, value: null })
  assert.deepEqual(checkDestination('telegram', undefined), { ok: true, value: null })
  assert.deepEqual(checkDestination('telegram', null), { ok: true, value: null })
})

test('a destination too long or not text comes back as a field:code the client can read', () => {
  assert.deepEqual(checkDestination('linkedin', 'x'.repeat(DESTINATION_LIMIT + 1)), {
    ok: false,
    code: `linkedin:too_long:${DESTINATION_LIMIT}`,
  })
  assert.deepEqual(checkDestination('instagram', 42), { ok: false, code: 'instagram:not_text' })
  // Exactly at the cap is allowed; the code only fires past it.
  assert.equal(checkDestination('linkedin', 'x'.repeat(DESTINATION_LIMIT)).ok, true)
})

test('no shape rule: an address is whatever the platform accepts', () => {
  const odd = ['urn:li:organization:123', '-1001234567890', 'UCabc_123', 'https://site.ir/api/posts', '17841400000000000']
  for (const value of odd) {
    assert.deepEqual(checkDestination('website', value), { ok: true, value }, `${value} is left alone`)
  }
})

test('a profile stored before destinations existed reads back as every channel unset', () => {
  assert.deepEqual(normalizeDestinations(undefined), emptyDestinations())
  assert.deepEqual(normalizeDestinations('{}'), emptyDestinations())
  assert.deepEqual(normalizeDestinations([]), emptyDestinations())
  assert.deepEqual(normalizeDestinations(null), emptyDestinations())
})

test('a hand-edited blob keeps what it can and drops the rest', () => {
  const parsed = normalizeDestinations({ telegram: ' @ch ', linkedin: 7, mastodon: 'x', youtube: '' })
  assert.deepEqual(parsed, { ...emptyDestinations(), telegram: '@ch' })
})

test('a channel with no destination reads as null rather than throwing', () => {
  const profile = { ...emptyBusiness(), destinations: { ...emptyDestinations(), telegram: '@ch' } }
  assert.equal(destinationFor(profile, 'telegram'), '@ch')
  assert.equal(destinationFor(profile, 'youtube'), null)
  // A profile object from before the field existed still answers.
  const legacy = { ...emptyBusiness(), destinations: undefined } as unknown as ReturnType<typeof emptyBusiness>
  assert.equal(destinationFor(legacy, 'telegram'), null)
})
