import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BOARD_VERSION_LIMIT,
  FALLBACK_SLUG,
  VERSION_NOTE_LENGTH,
  countGraph,
  nextVersion,
  normalizeName,
  normalizeNote,
  normalizeVisibility,
  parseVersion,
  planRestore,
  pruneCutoff,
  resolveSlug,
  slugSeed,
  visibleTo,
} from './board.ts'
import { emptyGraph } from '../../shared/boardGraph.ts'

const errorsOf = (result: { ok: boolean; errors?: string[] }) => result.errors ?? []

test('a board name is bilingual, and one language given fills the other', () => {
  const both = normalizeName({ fa: 'قیف فروش', en: 'Sales funnel' })
  assert.deepEqual(both, { ok: true, value: { fa: 'قیف فروش', en: 'Sales funnel' } })

  const persianOnly = normalizeName({ fa: 'قیف فروش' })
  assert.deepEqual(persianOnly, { ok: true, value: { fa: 'قیف فروش', en: 'قیف فروش' } })

  const plain = normalizeName('  Funnel  ')
  assert.deepEqual(plain, { ok: true, value: { fa: 'Funnel', en: 'Funnel' } })
})

test('a nameless board is refused with a code, not a sentence', () => {
  assert.deepEqual(errorsOf(normalizeName(undefined)), ['name:required'])
  assert.deepEqual(errorsOf(normalizeName({ fa: '   ', en: '' })), ['name:required'])
  assert.deepEqual(errorsOf(normalizeName({ fa: 7 })), ['name:required'])
  assert.deepEqual(errorsOf(normalizeName({ fa: 'x'.repeat(81) })), ['name:too_long:80'])
})

test('visibility is private unless it says otherwise, and nothing else is an option', () => {
  assert.deepEqual(normalizeVisibility(undefined), { ok: true, value: 'private' })
  assert.deepEqual(normalizeVisibility('public'), { ok: true, value: 'public' })
  assert.deepEqual(normalizeVisibility('private'), { ok: true, value: 'private' })
  assert.deepEqual(errorsOf(normalizeVisibility('unlisted')), ['visibility:not_an_option'])
  assert.deepEqual(errorsOf(normalizeVisibility(true)), ['visibility:not_an_option'])
})

test('a version note is optional, trimmed and capped', () => {
  assert.deepEqual(normalizeNote(undefined), { ok: true, value: null })
  assert.deepEqual(normalizeNote('   '), { ok: true, value: null })
  assert.deepEqual(normalizeNote('  before the rewrite '), { ok: true, value: 'before the rewrite' })
  assert.deepEqual(errorsOf(normalizeNote('n'.repeat(VERSION_NOTE_LENGTH + 1))), [
    `note:too_long:${VERSION_NOTE_LENGTH}`,
  ])
  assert.deepEqual(errorsOf(normalizeNote(12)), ['note:not_text'])
})

test('the slug seed prefers the English name and a Persian-only name has none', () => {
  assert.equal(slugSeed({ fa: 'قیف فروش', en: 'Sales Funnel' }), 'sales-funnel')
  assert.equal(slugSeed({ fa: 'قیف فروش', en: 'قیف فروش' }), '')
  assert.equal(slugSeed({ fa: 'قیف', en: '  ' }), '')
})

test('a taken slug gains a number, and an empty seed falls back to a readable one', () => {
  const taken = new Set(['sales-funnel', 'sales-funnel-2', FALLBACK_SLUG])
  const isTaken = (slug: string) => taken.has(slug)

  assert.equal(resolveSlug('sales-funnel', isTaken), 'sales-funnel-3')
  assert.equal(resolveSlug('untouched', isTaken), 'untouched')
  assert.equal(resolveSlug('', isTaken), 'board-2', 'a Persian-only name still gets a stable, unique slug')
  assert.equal(resolveSlug('', () => false), FALLBACK_SLUG)
})

test('a long slug stays inside its length once it is numbered', () => {
  const long = 'a'.repeat(48)
  const numbered = resolveSlug(long, (slug) => slug === long)
  assert.equal(numbered, `${'a'.repeat(46)}-2`)
  assert.ok(numbered!.length <= 48)
  assert.doesNotMatch(numbered!, /--/)
})

test('resolveSlug gives up rather than looping when everything is taken', () => {
  assert.equal(resolveSlug('busy', () => true, 5), null)
})

test('versions start at one and only ever climb', () => {
  assert.equal(nextVersion(null), 1)
  assert.equal(nextVersion(undefined), 1)
  assert.equal(nextVersion(0), 1)
  assert.equal(nextVersion(1), 2)
  assert.equal(nextVersion(41), 42)
})

test('a restore is a new version that remembers what it copied', () => {
  assert.deepEqual(planRestore(7, 3), { version: 8, restoredFrom: 3 })
  // Restoring the restore is possible precisely because nothing was deleted.
  assert.deepEqual(planRestore(8, 7), { version: 9, restoredFrom: 7 })
})

test('retention keeps the newest window and never prunes the current version', () => {
  assert.equal(pruneCutoff(1), 1, 'a board with one version loses nothing')
  assert.equal(pruneCutoff(BOARD_VERSION_LIMIT), 1, 'a full window still loses nothing')
  assert.equal(pruneCutoff(BOARD_VERSION_LIMIT + 1), 2, 'the oldest drops off once the window is full')
  assert.equal(pruneCutoff(120, 10), 111)
  assert.equal(pruneCutoff(3, 1), 3, 'keeping one keeps the current one')
  assert.ok(pruneCutoff(200) <= 200)
})

test('a version number is read from a URL segment or refused', () => {
  assert.equal(parseVersion('1'), 1)
  assert.equal(parseVersion('42'), 42)
  assert.equal(parseVersion('0'), null)
  assert.equal(parseVersion('-1'), null)
  assert.equal(parseVersion('1.5'), null)
  assert.equal(parseVersion('latest'), null)
  assert.equal(parseVersion(''), null)
  assert.equal(parseVersion(undefined), null)
  assert.equal(parseVersion('1e3'), null)
  assert.equal(parseVersion(' 1'), null)
})

test('a public board is readable without a session and a private one is not', () => {
  assert.equal(visibleTo('public', false), true)
  assert.equal(visibleTo('public', true), true)
  assert.equal(visibleTo('private', true), true)
  assert.equal(visibleTo('private', false), false)
  assert.equal(visibleTo('anything-else', false), false, 'an unknown visibility is treated as private')
})

test('counts are read off the graph rather than stored beside it', () => {
  assert.deepEqual(countGraph(emptyGraph()), { nodes: 0, edges: 0, groups: 0 })
  assert.deepEqual(
    countGraph({
      nodes: [
        { id: 'a', kind: 'plain', x: 0, y: 0, icon: 'router', title: { fa: 'الف', en: 'A' }, group: null, metric: null, note: null },
        { id: 'b', kind: 'plain', x: 0, y: 0, icon: 'router', title: { fa: 'ب', en: 'B' }, group: null, metric: null, note: null },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
      groups: [],
    }),
    { nodes: 2, edges: 1, groups: 0 },
  )
})
