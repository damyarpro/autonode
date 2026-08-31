import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signCheckout, verifyCheckout } from './checkout-token.ts'

const facts = { leadId: 7, dealId: 3, ref: 'mock_abc123', amountToman: 27_400_000 }
const secret = 'a-secret-that-only-the-server-knows'

test('a token the server signed verifies against the same facts', () => {
  assert.equal(verifyCheckout(facts, signCheckout(facts, secret), secret), true)
})

test('changing any one fact invalidates the token', () => {
  const token = signCheckout(facts, secret)
  // The amount is the one that matters most: a valid token for a small deal
  // must not confirm a large one.
  assert.equal(verifyCheckout({ ...facts, amountToman: 999_000_000 }, token, secret), false)
  assert.equal(verifyCheckout({ ...facts, leadId: 8 }, token, secret), false)
  assert.equal(verifyCheckout({ ...facts, dealId: 4 }, token, secret), false)
  assert.equal(verifyCheckout({ ...facts, ref: 'mock_other' }, token, secret), false)
})

test('another secret does not produce an accepted token', () => {
  assert.equal(verifyCheckout(facts, signCheckout(facts, 'someone elses secret'), secret), false)
})

test('an empty token or an empty secret is refused, never accepted by default', () => {
  assert.equal(verifyCheckout(facts, '', secret), false)
  assert.equal(verifyCheckout(facts, signCheckout(facts, secret), ''), false)
})

test('a token of the wrong length is refused rather than throwing', () => {
  assert.doesNotThrow(() => verifyCheckout(facts, 'short', secret))
  assert.equal(verifyCheckout(facts, 'short', secret), false)
})

test('the fields are joined unambiguously, so shifting a boundary changes the token', () => {
  // Without a separator, {ref:'a', amount:12} and {ref:'a1', amount:2} would
  // hash the same string and one checkout could confirm another.
  const a = signCheckout({ leadId: 1, dealId: 1, ref: 'a', amountToman: 12 }, secret)
  const b = signCheckout({ leadId: 1, dealId: 1, ref: 'a1', amountToman: 2 }, secret)
  assert.notEqual(a, b)
})
