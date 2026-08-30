import { test } from 'node:test'
import assert from 'node:assert/strict'
import { advanceStage, routeForScore } from './routing.ts'

test('route bands have no gap between them', () => {
  assert.equal(routeForScore(100), 'hot')
  assert.equal(routeForScore(80), 'hot')
  assert.equal(routeForScore(79), 'warm')
  assert.equal(routeForScore(55), 'warm')
  assert.equal(routeForScore(54), 'cold')
  assert.equal(routeForScore(0), 'cold')
})

test('stages only move forward', () => {
  assert.equal(advanceStage('new', 'engaged'), 'engaged')
  assert.equal(advanceStage('paid', 'engaged'), 'paid', 'a late signal never demotes a paid lead')
  assert.equal(advanceStage('meeting', 'meeting'), 'meeting')
})

test('lost is reachable from anywhere and sticks', () => {
  assert.equal(advanceStage('meeting', 'lost'), 'lost')
  assert.equal(advanceStage('lost', 'paid'), 'lost')
})
