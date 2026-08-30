import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planSteps, SEQUENCES, stepDef } from './sequences.ts'

const FROM = new Date('2026-08-30T12:00:00Z')

test('every route plans one step per definition, in order', () => {
  for (const route of ['hot', 'warm', 'cold'] as const) {
    const planned = planSteps(route, FROM)
    assert.equal(planned.length, SEQUENCES[route].length)
    assert.deepEqual(
      planned.map((step) => step.stepIndex),
      SEQUENCES[route].map((_, index) => index),
    )
    for (let i = 1; i < planned.length; i += 1) {
      assert.ok(planned[i].dueAt >= planned[i - 1].dueAt, 'due times never go backwards')
    }
  }
})

test('the first step of every route is due immediately', () => {
  for (const route of ['hot', 'warm', 'cold'] as const) {
    assert.equal(planSteps(route, FROM)[0].dueAt.getTime(), FROM.getTime())
  }
})

test('speed scales the delays and zero makes the whole run due now', () => {
  const [, second] = planSteps('hot', FROM, 2)
  assert.equal(second.dueAt.getTime(), FROM.getTime() + 20 * 2 * 60_000)

  for (const step of planSteps('warm', FROM, 0)) {
    assert.equal(step.dueAt.getTime(), FROM.getTime())
  }
})

test('the hot route stops as soon as the lead replies', () => {
  assert.ok(SEQUENCES.hot.every((step) => step.stopOnReply))
  assert.equal(stepDef('hot', 0)?.template, 'hot_intro')
  assert.equal(stepDef('hot', 99), undefined)
})
