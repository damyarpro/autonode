import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * HTTP-level tests for every route the app actually calls. The server is built
 * in-process and driven through `app.inject()`, so nothing binds a port.
 *
 * The environment is prepared before `server/` is imported at all: `env.ts`
 * reads `process.env` once at module load, so a later assignment is invisible.
 * It is also deliberately emptied of credentials, which is what pins the
 * adapter assertions in the health test — every channel simulated, template
 * copy, mock payments.
 */

const workdir = mkdtempSync(join(tmpdir(), 'autonode-routes-'))
process.env.DB_FILE = join(workdir, 'routes.db')
process.env.SEQUENCE_SPEED = '0'
process.env.WORKER_ENABLED = 'false'
process.env.PORT = '0'
delete process.env.ANTHROPIC_API_KEY
delete process.env.TELEGRAM_BOT_TOKEN
delete process.env.WEBHOOK_SIGNING_SECRET

const { buildServer } = await import('../index.ts')

const app = await buildServer()

after(async () => {
  await app.close()
  rmSync(workdir, { recursive: true, force: true })
})

const JSON_HEADERS = { 'content-type': 'application/json' }

const send = (method: 'POST' | 'PATCH', url: string, payload?: unknown) =>
  app.inject({
    method,
    url,
    headers: JSON_HEADERS,
    payload: payload === undefined ? undefined : JSON.stringify(payload),
  })

const get = (url: string) => app.inject({ method: 'GET', url })

type Lead = { id: number; score: number; route: string; stage: string }

/** Every case that needs a lead makes one through the API, never through SQL. */
let leadSeq = 0
const createLead = async (overrides: Record<string, unknown> = {}) => {
  leadSeq += 1
  const response = await send('POST', '/api/leads', {
    source: 'telegram',
    externalId: `routes-test-${leadSeq}`,
    name: 'Sara',
    handle: 'sara',
    message: 'سلام، قیمت این سرویس چنده؟',
    ...overrides,
  })
  assert.equal(response.statusCode, 201)
  return (response.json() as { lead: Lead }).lead
}

test('health reports every adapter honestly on an empty environment', async () => {
  const response = await get('/api/health')
  assert.equal(response.statusCode, 200)

  const body = response.json() as {
    ok: boolean
    adapters: { channels: Record<string, string>; ai: string; payments: string }
    telegramWebhookPath: string | null
  }
  assert.equal(body.ok, true)
  assert.equal(body.adapters.ai, 'template', 'no ANTHROPIC_API_KEY means template copy')
  assert.equal(body.adapters.payments, 'mock', 'payments are a local mock and say so')
  assert.deepEqual(body.adapters.channels, {
    instagram: 'simulated',
    telegram: 'simulated',
    linkedin: 'simulated',
    youtube: 'simulated',
    website: 'simulated',
  })
  assert.equal(body.telegramWebhookPath, null, 'no bot token means no webhook path to advertise')
})

test('capturing a lead returns 201 with a scored, routed lead', async () => {
  const response = await send('POST', '/api/leads', {
    source: 'instagram',
    externalId: 'capture-201',
    name: 'Reza',
    handle: 'reza',
    message: 'قیمتش چنده؟',
  })
  assert.equal(response.statusCode, 201)

  const { lead } = response.json() as { lead: Lead }
  assert.equal(lead.stage, 'new')
  assert.ok(lead.score > 0, 'a captured lead carries a score')
  assert.ok(['hot', 'warm', 'cold'].includes(lead.route), 'and a route')
})

test('capturing a lead from an unknown source is rejected with 400', async () => {
  const response = await send('POST', '/api/leads', { source: 'carrier-pigeon', message: 'hi' })
  assert.equal(response.statusCode, 400)
  assert.match((response.json() as { error: string }).error, /source must be one of/)
})

test('capturing the same source and externalId twice reuses the first lead', async () => {
  const first = await send('POST', '/api/leads', {
    source: 'linkedin',
    externalId: 'duplicate-1',
    name: 'Mina',
  })
  const second = await send('POST', '/api/leads', {
    source: 'linkedin',
    externalId: 'duplicate-1',
    name: 'Mina',
  })
  assert.equal(first.statusCode, 201)
  assert.equal(second.statusCode, 201)

  const firstLead = (first.json() as { lead: Lead }).lead
  const secondLead = (second.json() as { lead: Lead }).lead
  assert.equal(secondLead.id, firstLead.id, 'the unique index keeps this one lead')

  const listed = (await get('/api/leads?q=Mina')).json() as { leads: Lead[] }
  assert.equal(listed.leads.length, 1, 'and only one row exists to list')
})

test('a lead detail carries its lead, its events and its messages', async () => {
  const lead = await createLead()
  const response = await get(`/api/leads/${lead.id}`)
  assert.equal(response.statusCode, 200)

  const body = response.json() as {
    lead: Lead
    events: { type: string }[]
    messages: { direction: string; body: string }[]
  }
  assert.equal(body.lead.id, lead.id)
  assert.ok(Array.isArray(body.events) && body.events.length > 0, 'capture is on the event log')
  assert.ok(
    body.messages.some((message) => message.direction === 'in'),
    'the capture message was recorded inbound',
  )
})

test('a lead that does not exist is a 404, not an empty 200', async () => {
  const response = await get('/api/leads/999999')
  assert.equal(response.statusCode, 404)
})

test('a manual reply with an empty body is rejected with 400', async () => {
  const lead = await createLead()
  const empty = await send('POST', `/api/leads/${lead.id}/messages`, { body: '   ' })
  assert.equal(empty.statusCode, 400)
  assert.equal((empty.json() as { error: string }).error, 'body is required')
})

test('a manual reply is delivered through the adapter and recorded outbound', async () => {
  const lead = await createLead()
  const response = await send('POST', `/api/leads/${lead.id}/messages`, { body: 'سلام، در خدمتم' })
  assert.equal(response.statusCode, 200)

  const body = response.json() as { ok: boolean; status: string; messages: { direction: string }[] }
  assert.equal(body.ok, true)
  assert.equal(body.status, 'simulated', 'with no credentials the message is stored, not sent')
  assert.ok(body.messages.some((message) => message.direction === 'out'))
})

test('an action the dashboard does not have is a 404', async () => {
  const lead = await createLead()
  const response = await send('POST', `/api/leads/${lead.id}/unknown-action`)
  assert.equal(response.statusCode, 404)
  assert.equal((response.json() as { error: string }).error, 'unknown action')
})

test('progress reports the seven levels and the twenty-three stages', async () => {
  const response = await get('/api/progress')
  assert.equal(response.statusCode, 200)

  const body = response.json() as {
    levels: { levelId: number; stagesDone: number; stages: number }[]
    totalStages: number
    stagesDone: number
    percent: number
    currentLevel: number
  }
  assert.equal(body.totalStages, 23)
  assert.equal(body.levels.length, 7)
  assert.equal(
    body.levels.reduce((sum, level) => sum + level.stages, 0),
    23,
    'the per-level stage counts add up to the total',
  )
  assert.ok(Number.isFinite(body.percent))
})

test('posting a level with no body advances it by exactly one stage', async () => {
  const levelId = 2
  const before = (await get('/api/progress')).json() as { levels: { levelId: number; stagesDone: number }[] }
  const was = before.levels.find((level) => level.levelId === levelId)!.stagesDone

  const response = await send('POST', `/api/progress/${levelId}`)
  assert.equal(response.statusCode, 200)

  const body = response.json() as { levels: { levelId: number; stagesDone: number }[]; percent: number }
  assert.equal(body.levels.find((level) => level.levelId === levelId)!.stagesDone, was + 1)
})

test('an absurd stage count is clamped to the level maximum', async () => {
  const response = await send('POST', '/api/progress/1', { stagesDone: 9_999 })
  assert.equal(response.statusCode, 200)

  const body = response.json() as { levels: { levelId: number; stagesDone: number; stages: number }[] }
  const level = body.levels.find((entry) => entry.levelId === 1)!
  assert.equal(level.stagesDone, level.stages)
  assert.equal(level.stagesDone, 5)
})

test('a level that does not exist is a 404', async () => {
  const response = await send('POST', '/api/progress/99', { stagesDone: 1 })
  assert.equal(response.statusCode, 404)
  assert.equal((response.json() as { error: string }).error, 'unknown level')
})

test('patching the profile is visible on the next read', async () => {
  const response = await send('PATCH', '/api/profile', { headline: 'ساخت درآمد با هوش مصنوعی' })
  assert.equal(response.statusCode, 200)

  const body = (await get('/api/profile')).json() as { profile: { headline: string; level: number } }
  assert.equal(body.profile.headline, 'ساخت درآمد با هوش مصنوعی')
  assert.ok(Number.isFinite(body.profile.level))
})

test('patching the profile with nothing to update is a 400', async () => {
  const response = await send('PATCH', '/api/profile', { nickname: 'not a field' })
  assert.equal(response.statusCode, 400)
  assert.equal((response.json() as { error: string }).error, 'nothing to update')
})

test('the coach rejects an empty message with 400', async () => {
  const response = await send('POST', '/api/coach', { message: '   ' })
  assert.equal(response.statusCode, 400)
  assert.equal((response.json() as { error: string }).error, 'message is required')
})

test('the coach answers and the turn lands in the history', async () => {
  const question = 'چطور برای سرویسم قیمت بگذارم؟'
  const response = await send('POST', '/api/coach', { message: question, locale: 'fa' })
  assert.equal(response.statusCode, 200)

  const body = response.json() as { answer: string; adapter: string }
  assert.equal(typeof body.answer, 'string')
  assert.ok(body.answer.trim().length > 0, 'the fallback adapter still says something useful')
  assert.equal(body.adapter, 'template')

  const history = (await get('/api/coach/history')).json() as {
    messages: { role: string; content: string }[]
    adapter: string
  }
  assert.ok(
    history.messages.some((turn) => turn.role === 'user' && turn.content === question),
    'the question is on the transcript',
  )
  assert.ok(
    history.messages.some((turn) => turn.role === 'assistant' && turn.content === body.answer),
    'and so is the answer',
  )
})

test('a payment webhook missing required fields is a 400', async () => {
  const response = await send('POST', '/api/webhooks/payment', { leadId: 1, ref: 'mock_x' })
  assert.equal(response.statusCode, 400)
  assert.match((response.json() as { error: string }).error, /required/)
})

test('the same payment reference cannot be banked twice', async () => {
  const lead = await createLead()
  const checkoutResponse = await send('POST', `/api/checkout/${lead.id}`)
  assert.equal(checkoutResponse.statusCode, 200)

  const checkout = checkoutResponse.json() as {
    url: string
    ref: string
    dealId: number
    amountToman: number
  }
  assert.ok(checkout.url.includes(checkout.ref), 'the checkout url carries its reference')

  const payload = {
    leadId: lead.id,
    dealId: checkout.dealId,
    ref: checkout.ref,
    amountToman: checkout.amountToman,
  }
  const first = await send('POST', '/api/webhooks/payment', payload)
  assert.equal(first.statusCode, 200)
  assert.equal((first.json() as { ok: boolean }).ok, true)

  const replay = await send('POST', '/api/webhooks/payment', payload)
  assert.equal(replay.statusCode, 409, 'a replayed reference is refused')
  assert.equal((replay.json() as { reason: string }).reason, 'already recorded')
})

test('a checkout for a lead that does not exist is a 404', async () => {
  const response = await send('POST', '/api/checkout/999999')
  assert.equal(response.statusCode, 404)
})

test('every pipeline metric is a finite number', async () => {
  const response = await get('/api/pipeline')
  assert.equal(response.statusCode, 200)

  const body = response.json() as { metrics: Record<string, number>; at: string }
  assert.ok(Object.keys(body.metrics).length > 0, 'the canvas asks for real keys')
  for (const [key, value] of Object.entries(body.metrics)) {
    assert.equal(typeof value, 'number', `${key} is a number`)
    // A NaN here reaches the canvas and renders as "NaN" in a badge.
    assert.ok(Number.isFinite(value), `${key} is finite, got ${value}`)
  }
  assert.ok(body.metrics['sale.badge'] >= 1, 'the captured payment shows up')
  assert.ok(!Number.isNaN(Date.parse(body.at)))
})

test('the telegram webhook is invisible behind a wrong secret', async () => {
  const response = await send('POST', '/api/webhooks/telegram/not-the-secret', {
    message: { message_id: 1, text: 'hi', chat: { id: 42 } },
  })
  assert.equal(response.statusCode, 404, 'a wrong secret must not reveal that the route exists')
})

test('a json post with no body at all is treated as an empty object', async () => {
  const lead = await createLead()
  // The custom content-type parser exists for exactly this: action endpoints and
  // webhook senders that set the header and send nothing.
  const response = await app.inject({
    method: 'POST',
    url: `/api/leads/${lead.id}/book-meeting`,
    headers: JSON_HEADERS,
  })
  assert.equal(response.statusCode, 200)
  assert.equal((response.json() as { lead: Lead }).lead.stage, 'meeting')

  // The same again with an explicitly empty payload, which is the shape that
  // reaches the parser as an empty string rather than as no body at all.
  const blank = await app.inject({
    method: 'POST',
    url: `/api/leads/${lead.id}/complete-call`,
    headers: JSON_HEADERS,
    payload: '',
  })
  assert.equal(blank.statusCode, 200)
})

test('a json post with a malformed body is rejected without killing the server', async () => {
  const lead = await createLead()
  const response = await app.inject({
    method: 'POST',
    url: `/api/leads/${lead.id}/book-meeting`,
    headers: JSON_HEADERS,
    payload: '{not json',
  })

  // The parser in server/index.ts stamps the SyntaxError with a statusCode,
  // the way Fastify's own JSON parser does; without that stamp Fastify reports
  // a malformed client request as a 500.
  assert.equal(response.statusCode, 400)

  // What must hold regardless: the process survives and keeps serving.
  assert.equal((await get('/api/health')).statusCode, 200)
})

// ── the business profile, and the three halves that read it ──────────────
//
// These run in file order after the cases above, so the profile written here
// is the one the content and call cases rely on. That is deliberate: a produce
// call before it would 409, which is itself the first assertion.

test('producing content before the business profile is filled in is refused', async () => {
  const response = await send('POST', '/api/content/produce', { count: 2 })

  assert.equal(response.statusCode, 409)
  const body = response.json() as { errors: string[] }
  assert.deepEqual(body.errors, ['name:required', 'whatWeSell:required', 'audience:required'])
})

test('the business profile round-trips and reports what is still missing', async () => {
  const blank = await get('/api/business')
  assert.equal(blank.statusCode, 200)
  assert.equal((blank.json() as { missing: string[] }).missing.length, 3)

  const bad = await send('PATCH', '/api/business', { ctaUrl: 'not-a-link' })
  assert.equal(bad.statusCode, 400)
  assert.deepEqual((bad.json() as { errors: string[] }).errors, ['ctaUrl:not_a_url'])

  const saved = await send('PATCH', '/api/business', {
    name: 'کارگاه رشد',
    whatWeSell: 'دوره‌ی فروش برای فریلنسرها',
    audience: 'فریلنسرهای فارسی‌زبان',
    priceToman: 4_900_000,
    channels: ['telegram', 'website', 'not-a-channel'],
  })
  assert.equal(saved.statusCode, 200)

  const body = saved.json() as { business: { name: string; channels: string[] }; missing: string[] }
  assert.equal(body.business.name, 'کارگاه رشد')
  assert.deepEqual(body.business.channels, ['telegram', 'website'], 'an unknown channel is dropped, not stored')
  assert.deepEqual(body.missing, [])
})

test('content is produced, listed, published and deleted', async () => {
  const produced = await send('POST', '/api/content/produce', {
    count: 3,
    perDay: 24,
    channels: ['telegram', 'website'],
  })
  assert.equal(produced.statusCode, 201)

  const { pieces, producedBy } = produced.json() as {
    pieces: { id: number; channel: string; status: string }[]
    producedBy: string
  }
  assert.equal(pieces.length, 3)
  // No ANTHROPIC_API_KEY in this environment, so the flag must say template.
  assert.equal(producedBy, 'template')
  assert.ok(pieces.every((piece) => ['telegram', 'website'].includes(piece.channel)))

  const published = await send('POST', '/api/content/publish')
  assert.equal(published.statusCode, 200)
  assert.equal((published.json() as { published: number }).published, 3)

  const listed = await get('/api/content?channel=telegram')
  const list = listed.json() as { pieces: { id: number; channel: string; status: string }[] }
  assert.ok(list.pieces.length > 0)
  assert.ok(list.pieces.every((piece) => piece.channel === 'telegram'))
  // With no bot token the piece is recorded, never claimed as delivered.
  assert.ok(list.pieces.every((piece) => piece.status === 'simulated'))

  const removed = await app.inject({ method: 'DELETE', url: `/api/content/${pieces[0].id}` })
  assert.equal(removed.statusCode, 200)
  assert.equal((await app.inject({ method: 'DELETE', url: `/api/content/${pieces[0].id}` })).statusCode, 404)
})

test('a bad produce request answers with codes, not prose', async () => {
  const response = await send('POST', '/api/content/produce', { count: 0, channels: 'telegram' })

  assert.equal(response.statusCode, 400)
  const { errors } = response.json() as { errors: string[] }
  assert.ok(errors.includes('count:not_a_number'))
  assert.ok(errors.includes('channels:not_a_list'))
})

test('a call brief is written even with no voice credentials', async () => {
  const lead = await createLead()
  const response = await send('POST', `/api/calls/${lead.id}/prepare`)

  assert.equal(response.statusCode, 200)
  const body = response.json() as {
    brief: { opening: string; objections: { objection: string; answer: string }[]; ask: string; producedBy: string }
    live: boolean
  }
  assert.equal(body.live, false, 'no VAPI_API_KEY, so nothing was dialled')
  assert.equal(body.brief.producedBy, 'template')
  assert.ok(body.brief.opening.length > 0)
  assert.equal(body.brief.objections.length, 2)
  assert.ok(body.brief.ask.length > 0)

  const missing = await send('POST', '/api/calls/999999/prepare')
  assert.equal(missing.statusCode, 404)
  assert.deepEqual((missing.json() as { errors: string[] }).errors, ['leadId:unknown_lead'])
})

test('a meeting is booked once, and the same slot is refused after', async () => {
  const lead = await createLead()

  const slots = await get('/api/calls/slots?days=3')
  assert.equal(slots.statusCode, 200)
  const { slots: free, slotMinutes } = slots.json() as { slots: { start: string }[]; slotMinutes: number }
  assert.ok(free.length > 0, 'the working-hours window should offer at least one slot')
  assert.ok(slotMinutes > 0)

  const booked = await send('POST', `/api/calls/${lead.id}/book`, { slotStart: free[0].start })
  assert.equal(booked.statusCode, 201)

  const twice = await send('POST', `/api/calls/${lead.id}/book`, { slotStart: free[0].start })
  assert.equal(twice.statusCode, 409)
  assert.deepEqual((twice.json() as { errors: string[] }).errors, ['slotStart:taken'])

  const past = await send('POST', `/api/calls/${lead.id}/book`, { slotStart: '2020-01-01T09:00:00.000Z' })
  assert.equal(past.statusCode, 409)
  assert.deepEqual((past.json() as { errors: string[] }).errors, ['slotStart:past'])

  assert.equal((await send('POST', `/api/calls/${lead.id}/book`, {})).statusCode, 400)

  const listed = await get(`/api/calls?leadId=${lead.id}`)
  const { counts } = listed.json() as { counts: { meetings: number } }
  assert.equal(counts.meetings, 1)
})

test('a voice job with no credentials returns a timed script, not a failure', async () => {
  const response = await send('POST', '/api/media/voice', {
    script: 'سلام. اگر فریلنسر هستی و فروش برایت سخت است، این را گوش کن.',
    locale: 'fa',
  })

  assert.equal(response.statusCode, 201)
  const { job } = response.json() as {
    job: { status: string; adapter: string; output: { script: { lines: unknown[]; durationSec: number } } }
  }
  assert.equal(job.status, 'scripted')
  assert.equal(job.adapter, 'script-only')
  assert.ok(job.output.script.lines.length > 0)
  assert.ok(job.output.script.durationSec > 0)
})
