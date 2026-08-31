import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildMetrics, emptyFacts } from './pipeline-view.ts'

test('an empty system produces zeros, not NaN or Infinity', () => {
  const metrics = buildMetrics(emptyFacts())
  for (const [key, value] of Object.entries(metrics)) {
    assert.ok(Number.isFinite(value), `${key} should be finite, got ${value}`)
  }
  assert.equal(metrics['kpi.dealValue'], 0)
  assert.equal(metrics['kpi.closeRate'], 0)
  assert.equal(metrics['kpi.cycleDays'], 0)
})

test('deal value is the mean payment and close rate is payments per completed call', () => {
  const facts = emptyFacts()
  facts.paymentCount = 4
  facts.paidTotalToman = 100_000_000
  facts.callsCompleted = 10

  const metrics = buildMetrics(facts)
  assert.equal(metrics['kpi.dealValue'], 25_000_000)
  assert.equal(metrics['kpi.closeRate'], 40)
})

test('close rate keeps one decimal place', () => {
  const facts = emptyFacts()
  facts.paymentCount = 47
  facts.callsCompleted = 138
  assert.equal(buildMetrics(facts)['kpi.closeRate'], 34.1)
})

test('cycle length is the mean of the samples', () => {
  const facts = emptyFacts()
  facts.cycleDays = [10, 20, 24]
  assert.equal(buildMetrics(facts)['kpi.cycleDays'], 18)
})

test('every canvas node gets a badge metric', () => {
  const metrics = buildMetrics(emptyFacts())
  const nodeIds = [
    'instagram', 'telegram', 'linkedin', 'youtube', 'website',
    'elevenlabs', 'higgsfield', 'factory', 'inbox', 'router',
    'hot', 'warm', 'cold', 'vapi', 'salescall', 'memory',
    'payment', 'sale', 'growth', 'fulfillment', 'support', 'referral',
  ]
  for (const id of nodeIds) {
    assert.ok(`${id}.badge` in metrics, `${id}.badge is missing`)
  }
})

test("a channel's second line counts what it published, not a multiple of touches", () => {
  const facts = emptyFacts()
  facts.touchesByChannel.instagram = 40
  facts.leadsByChannel.instagram = 7
  facts.publishedByChannel.instagram = 3

  const metrics = buildMetrics(facts)
  assert.equal(metrics['instagram.badge'], 7)
  assert.equal(metrics['instagram.stat'], 40)
  assert.equal(metrics['instagram.stat2'], 3, 'the second line is measured, never derived from the first')

  // A channel that published nothing says zero rather than a number implied by
  // its traffic, which is the whole point of the change.
  assert.equal(metrics['telegram.stat2'], 0)
})

test('the voice node separates calls it set up from calls that actually happened', () => {
  const facts = emptyFacts()
  facts.callsPrepared = 12
  facts.callsCompleted = 3

  const metrics = buildMetrics(facts)
  assert.equal(metrics['vapi.badge'], 12)
  assert.equal(metrics['vapi.stat'], 3, 'a dialled call is not a held one until the provider says so')
})
