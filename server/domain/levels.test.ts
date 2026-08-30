import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clampStages, currentLevel, LEVEL_STAGES, overallPercent, TOTAL_STAGES } from './levels.ts'

const progressWith = (done: Record<number, number> = {}) =>
  Object.entries(LEVEL_STAGES).map(([id, stages]) => ({
    levelId: Number(id),
    stages,
    stagesDone: done[Number(id)] ?? 0,
  }))

test('the seven levels add up to the 23 stages the dashboard counts', () => {
  assert.equal(TOTAL_STAGES, 23)
  assert.equal(Object.keys(LEVEL_STAGES).length, 7)
})

test('stage counts are clamped to the level and never negative', () => {
  assert.equal(clampStages(1, 99), 5)
  assert.equal(clampStages(2, 99), 3)
  assert.equal(clampStages(1, -4), 0)
  assert.equal(clampStages(1, 2.4), 2)
  assert.equal(clampStages(99, 1), 0, 'an unknown level has no stages to fill')
})

test('overall percent spans nothing done to everything done', () => {
  assert.equal(overallPercent(progressWith()), 0)
  assert.equal(overallPercent(progressWith({ 1: 5, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3 })), 100)
  assert.equal(overallPercent(progressWith({ 1: 5 })), 22)
})

test('the current level is the first unfinished one', () => {
  assert.equal(currentLevel(progressWith()), 1)
  assert.equal(currentLevel(progressWith({ 1: 4 })), 1, 'a partly-done level is still current')
  assert.equal(currentLevel(progressWith({ 1: 5 })), 2)
  assert.equal(currentLevel(progressWith({ 1: 5, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 7: 3 })), 7)
})
