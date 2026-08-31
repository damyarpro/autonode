import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dialableNumber } from './vapi.ts'
import type { Lead } from '../../types.ts'

const lead = (handle: string | null): Lead => ({ handle } as Lead)

test('a username is not a number, so there is nothing to dial', () => {
  assert.equal(dialableNumber(lead('@sara_dev')), null)
  assert.equal(dialableNumber(lead('sara')), null)
  assert.equal(dialableNumber(lead('')), null)
  assert.equal(dialableNumber(lead(null)), null)
})

test('a number written the local way gets the country code, not a bare plus', () => {
  // The defect this pins: `09123456789` used to become `+09123456789`, which
  // is not E.164 and which every carrier refuses.
  assert.equal(dialableNumber(lead('09123456789')), '+989123456789')
  assert.equal(dialableNumber(lead('0912 345 6789')), '+989123456789')
  assert.equal(dialableNumber(lead('0912-345-6789')), '+989123456789')
})

test('a number that already carries its country code is left alone', () => {
  assert.equal(dialableNumber(lead('+989123456789')), '+989123456789')
  assert.equal(dialableNumber(lead('+98 912 345 6789')), '+989123456789')
  assert.equal(dialableNumber(lead('989123456789')), '+989123456789')
  assert.equal(dialableNumber(lead('00989123456789')), '+989123456789')
})

test('the default calling code is configurable', () => {
  process.env.DEFAULT_CALLING_CODE = '44'
  try {
    assert.equal(dialableNumber(lead('07700900123')), '+447700900123')
  } finally {
    delete process.env.DEFAULT_CALLING_CODE
  }
})
