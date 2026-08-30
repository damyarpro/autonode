import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoreLead } from './scoring.ts'
import type { ScorableEvent } from './scoring.ts'

const NOW = new Date('2026-08-30T12:00:00Z')
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000)

test('channel intent sets the floor for a lead with no activity', () => {
  const web = scoreLead({ source: 'website', hasName: false, hasHandle: false, events: [] }, NOW)
  const tube = scoreLead({ source: 'youtube', hasName: false, hasHandle: false, events: [] }, NOW)
  assert.equal(web, 18)
  assert.equal(tube, 8)
  assert.ok(web > tube, 'website intent outranks youtube')
})

test('a filled-in profile adds a small bonus', () => {
  const bare = scoreLead({ source: 'telegram', hasName: false, hasHandle: false, events: [] }, NOW)
  const full = scoreLead({ source: 'telegram', hasName: true, hasHandle: true, events: [] }, NOW)
  assert.equal(full - bare, 6)
})

test('the same events count for less as they age', () => {
  const events = (at: Date): ScorableEvent[] => [{ type: 'call_booked', at }]
  const fresh = scoreLead({ source: 'telegram', hasName: false, hasHandle: false, events: events(NOW) }, NOW)
  const old = scoreLead(
    { source: 'telegram', hasName: false, hasHandle: false, events: events(daysAgo(10)) },
    NOW,
  )
  // One half-life is ten days, so the event's own 25 points should halve.
  assert.equal(fresh, 37)
  assert.equal(old, 25)
})

test('unsubscribing zeroes the score whatever else happened', () => {
  const score = scoreLead(
    {
      source: 'website',
      hasName: true,
      hasHandle: true,
      events: [
        { type: 'paid', at: NOW },
        { type: 'call_booked', at: NOW },
        { type: 'unsubscribed', at: NOW },
      ],
    },
    NOW,
  )
  assert.equal(score, 0)
})

test('the score is clamped to 0..100', () => {
  const events: ScorableEvent[] = Array.from({ length: 30 }, () => ({ type: 'paid', at: NOW }))
  assert.equal(scoreLead({ source: 'website', hasName: true, hasHandle: true, events }, NOW), 100)
})

test('SQLite timestamps without a zone are read as UTC', () => {
  const viaString = scoreLead(
    { source: 'telegram', hasName: false, hasHandle: false, events: [{ type: 'reply', at: '2026-08-30 12:00:00' }] },
    NOW,
  )
  const viaDate = scoreLead(
    { source: 'telegram', hasName: false, hasHandle: false, events: [{ type: 'reply', at: NOW }] },
    NOW,
  )
  assert.equal(viaString, viaDate)
})
