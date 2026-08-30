import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aiToolSpecs, specById, TOOL_IDS, type AiToolSpec } from '../../shared/aiToolSpecs.ts'
import { templateRun } from './templates.ts'
import { runTool, validateInputs } from './runner.ts'
import { hasClaude } from '../env.ts'

const spec = (id: string): AiToolSpec => {
  const found = specById(id)
  assert.ok(found, `spec ${id} is missing`)
  return found
}

const accepted = (id: string, raw: unknown): Record<string, string> => {
  const result = validateInputs(spec(id), raw)
  assert.ok(result.ok, `expected ${id} input to pass, got ${result.ok ? '' : result.errors.join(', ')}`)
  return result.inputs
}

const rejected = (id: string, raw: unknown): string[] => {
  const result = validateInputs(spec(id), raw)
  assert.equal(result.ok, false, `expected ${id} input to fail`)
  return result.ok ? [] : result.errors
}

// ── validateInputs ───────────────────────────────────────────────────────

test('a missing required field is rejected', () => {
  assert.deepEqual(rejected('idea', {}), ['skills:required'])
  assert.deepEqual(rejected('idea', { audience: 'shop owners' }), ['skills:required'])
  assert.deepEqual(rejected('product', { budget: 'low' }), ['business:required'])
})

test('whitespace does not satisfy a required field', () => {
  assert.deepEqual(rejected('idea', { skills: '   \n\t ' }), ['skills:required'])
})

test('an optional field may be left out or left blank', () => {
  assert.deepEqual(accepted('idea', { skills: 'design' }), { skills: 'design' })
  assert.deepEqual(accepted('idea', { skills: 'design', audience: '  ' }), { skills: 'design' })
  assert.deepEqual(accepted('product', { business: 'coaching' }), { business: 'coaching' })
})

test('maxLength is enforced on the trimmed value', () => {
  const skills = spec('idea').fields.find((field) => field.id === 'skills')!
  assert.equal(skills.maxLength, 400)

  assert.deepEqual(rejected('idea', { skills: 'x'.repeat(401) }), ['skills:too_long:400'])
  assert.deepEqual(accepted('idea', { skills: 'x'.repeat(400) }), { skills: 'x'.repeat(400) })
  // Trimming happens first, so surrounding space never pushes a value over.
  assert.deepEqual(accepted('idea', { skills: `  ${'x'.repeat(400)}  ` }), { skills: 'x'.repeat(400) })
})

test('a select only accepts one of its own option values', () => {
  assert.deepEqual(rejected('product', { business: 'coaching', budget: 'huge' }), ['budget:not_an_option'])
  assert.deepEqual(rejected('product', { business: 'coaching', budget: 'Low' }), ['budget:not_an_option'])
  assert.deepEqual(accepted('product', { business: 'coaching', budget: 'medium' }), {
    business: 'coaching',
    budget: 'medium',
  })
  assert.deepEqual(rejected('content', { business: 'coaching', channel: 'tiktok' }), ['channel:not_an_option'])
  assert.deepEqual(accepted('content', { business: 'coaching', channel: 'telegram' }), {
    business: 'coaching',
    channel: 'telegram',
  })
})

test('unknown keys are dropped rather than passed through', () => {
  const inputs = accepted('idea', {
    skills: 'design',
    audience: 'shop owners',
    locale: 'en',
    producedBy: 'claude',
    __proto__: 'nope',
    toolId: 'other',
  })
  assert.deepEqual(Object.keys(inputs).sort(), ['audience', 'skills'])
})

test('a non-string value is rejected instead of being coerced', () => {
  assert.deepEqual(rejected('idea', { skills: 42 }), ['skills:not_text'])
  assert.deepEqual(rejected('idea', { skills: ['design'] }), ['skills:not_text'])
  assert.deepEqual(rejected('idea', { skills: { fa: 'design' } }), ['skills:not_text'])
  // null and undefined read as "absent", which the required check reports.
  assert.deepEqual(rejected('idea', { skills: null }), ['skills:required'])
})

test('a body that is not an object is rejected on the required fields', () => {
  assert.deepEqual(rejected('idea', null), ['skills:required'])
  assert.deepEqual(rejected('idea', 'skills=design'), ['skills:required'])
})

test('every failing field reports, not just the first', () => {
  assert.deepEqual(rejected('content', { business: '', channel: 'tiktok' }), [
    'business:required',
    'channel:not_an_option',
  ])
})

test('a valid payload comes back trimmed and complete', () => {
  assert.deepEqual(accepted('customer', { business: '  I edit podcasts ', audience: ' agencies ' }), {
    business: 'I edit podcasts',
    audience: 'agencies',
  })
})

test('every spec validates its own required fields and nothing else', () => {
  for (const current of aiToolSpecs) {
    const full = Object.fromEntries(
      current.fields.map((field) => [field.id, field.type === 'select' ? field.options![0].value : 'value']),
    )
    const result = validateInputs(current, { ...full, surprise: 'x' })
    assert.ok(result.ok, `${current.id} rejected its own fields`)
    assert.deepEqual(Object.keys(result.inputs).sort(), current.fields.map((f) => f.id).sort())

    const required = current.fields.filter((field) => field.required)
    assert.ok(required.length > 0, `${current.id} has no required field`)
    assert.deepEqual(
      rejected(current.id, {}).sort(),
      required.map((field) => `${field.id}:required`).sort(),
    )
  }
})

// ── templates ────────────────────────────────────────────────────────────

const sampleInputs = (current: AiToolSpec): Record<string, string> =>
  Object.fromEntries(
    current.fields.map((field) => [
      field.id,
      field.type === 'select'
        ? field.options![0].value
        : field.id === 'audience'
          ? 'small shop owners'
          : field.id === 'skills'
            ? 'graphic design and copywriting'
            : 'I help small businesses grow their Instagram page',
    ]),
  )

test('the template answers every section every spec declares', () => {
  for (const current of aiToolSpecs) {
    for (const locale of ['fa', 'en'] as const) {
      const where = `${current.id}/${locale}`
      const result = templateRun(current, sampleInputs(current), locale)

      assert.equal(result.toolId, current.id, where)
      assert.equal(result.producedBy, 'template', where)
      assert.ok(result.summary.trim().length > 20, `${where} summary is too thin`)

      assert.deepEqual(
        result.sections.map((section) => section.id),
        current.sections.map((section) => section.id),
        `${where} sections do not match the spec`,
      )

      for (const section of result.sections) {
        const declared = current.sections.find((candidate) => candidate.id === section.id)!
        assert.equal(section.kind, declared.kind, `${where}#${section.id} kind`)
        if (declared.kind === 'text') {
          assert.equal(section.items.length, 1, `${where}#${section.id} text takes exactly one item`)
        } else {
          assert.ok(section.items.length >= 3, `${where}#${section.id} needs several entries`)
        }
        for (const item of section.items) {
          assert.ok(item.trim().length > 0, `${where}#${section.id} has an empty entry`)
          assert.ok(!/lorem|coming soon|todo|tbd/i.test(item), `${where}#${section.id} is filler`)
        }
      }
    }
  }
})

test('the template answers with the user own words, not a generic script', () => {
  const idea = templateRun(spec('idea'), { skills: 'voiceover work', audience: 'podcast studios' }, 'en')
  const flat = [idea.summary, ...idea.sections.flatMap((section) => section.items)].join(' ')
  assert.match(flat, /voiceover work/)
  assert.match(flat, /podcast studios/)

  const social = templateRun(spec('social'), { business: 'I repair espresso machines' }, 'en')
  const socialFlat = [social.summary, ...social.sections.flatMap((section) => section.items)].join(' ')
  assert.match(socialFlat, /I repair espresso machines/)
})

test('a blank optional field still produces a complete answer', () => {
  for (const current of aiToolSpecs) {
    const onlyRequired = Object.fromEntries(
      current.fields.filter((field) => field.required).map((field) => [field.id, 'my small business']),
    )
    const result = templateRun(current, onlyRequired, 'fa')
    assert.equal(result.sections.length, current.sections.length, current.id)
    for (const section of result.sections) {
      assert.ok(section.items.every((item) => item.trim().length > 0), `${current.id}#${section.id}`)
    }
  }
})

test('the template is deterministic', () => {
  const inputs = { business: 'I sell handmade candles', budget: 'low' }
  assert.deepEqual(templateRun(spec('product'), inputs, 'fa'), templateRun(spec('product'), inputs, 'fa'))
})

test('the two locales produce different copy', () => {
  const inputs = { business: 'I sell handmade candles' }
  assert.notEqual(
    templateRun(spec('mindmap'), inputs, 'fa').summary,
    templateRun(spec('mindmap'), inputs, 'en').summary,
  )
})

// ── runTool ──────────────────────────────────────────────────────────────

test(
  'runTool answers from the template when there are no credentials',
  { skip: hasClaude() ? 'ANTHROPIC_API_KEY is set' : false },
  async () => {
    for (const id of TOOL_IDS) {
      const current = spec(id)
      const result = await runTool(current, sampleInputs(current), 'en')
      assert.equal(result.producedBy, 'template', id)
      assert.deepEqual(result, templateRun(current, sampleInputs(current), 'en'), id)
    }
  },
)
