import { test } from 'node:test'
import assert from 'node:assert/strict'
import { businessBrief, emptyBusiness, isUsable, missingFields } from './business.ts'

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
