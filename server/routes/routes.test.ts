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
    token: string
  }
  assert.ok(checkout.url.includes(checkout.ref), 'the checkout url carries its reference')

  const facts = {
    leadId: lead.id,
    dealId: checkout.dealId,
    ref: checkout.ref,
    amountToman: checkout.amountToman,
  }

  // Anyone can reach this endpoint, so an unsigned claim must not write a sale.
  const forged = await send('POST', '/api/webhooks/payment', facts)
  assert.equal(forged.statusCode, 401, 'a payment claimed without the token is refused')

  // Nor may a real token confirm a bigger amount than the deal it was signed for.
  const inflated = await send('POST', '/api/webhooks/payment', {
    ...facts,
    amountToman: facts.amountToman * 10,
    token: checkout.token,
  })
  assert.equal(inflated.statusCode, 401, 'the amount is part of what was signed')

  const payload = { ...facts, token: checkout.token }
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

test('publishing destinations are validated per channel and patched one at a time', async () => {
  type Body = { business: { destinations: Record<string, string | null> }; errors?: string[] }

  const bad = await send('PATCH', '/api/business', {
    destinations: { linkedin: 'x'.repeat(201), instagram: 12 },
  })
  assert.equal(bad.statusCode, 400)
  // Every bad field at once, as codes rather than prose (rule 11).
  assert.deepEqual((bad.json() as Body).errors, ['instagram:not_text', 'linkedin:too_long:200'])

  const saved = await send('PATCH', '/api/business', {
    destinations: { linkedin: '  urn:li:organization:42  ', instagram: '17841400000000000' },
  })
  assert.equal(saved.statusCode, 200)
  const stored = (saved.json() as Body).business.destinations
  assert.equal(stored.linkedin, 'urn:li:organization:42', 'trimmed, and no shape rule was guessed')
  assert.equal(stored.telegram, null, 'a channel never named stays unset')

  // A channel left out keeps what it has; a blank one is cleared to null.
  const patched = await send('PATCH', '/api/business', { destinations: { instagram: '   ' } })
  const after = (patched.json() as Body).business.destinations
  assert.equal(after.instagram, null, 'blank means not set, never a stored empty string')
  assert.equal(after.linkedin, 'urn:li:organization:42', 'the untouched channel is left alone')

  const reread = (await get('/api/business')).json() as Body
  assert.equal(reread.business.destinations.linkedin, 'urn:li:organization:42')
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

test('the vapi webhook records the call outcome, and only behind its secret', async () => {
  // The secret is read on the first request to the route, not at import, so it
  // can be set here rather than at the top of this file with the rest.
  process.env.VAPI_WEBHOOK_SECRET = 'routes-test-vapi-secret'
  const path = `/api/webhooks/vapi/${process.env.VAPI_WEBHOOK_SECRET}`

  const lead = await createLead()
  const prepared = await send('POST', `/api/calls/${lead.id}/prepare`)
  assert.equal(prepared.statusCode, 200)
  const { brief } = prepared.json() as { brief: import('../domain/booking.ts').CallBrief }

  // With no VAPI_API_KEY nothing was dialled, so there is no provider id to
  // report against. This is the row a credentialed dialler would have written.
  const q = await import('../db/queries.ts')
  const call = q.recordCall({
    leadId: lead.id,
    provider: 'vapi',
    status: 'dialled',
    externalId: 'routes-test-call-1',
    brief,
  })

  const stranger = await send('POST', '/api/webhooks/vapi/not-the-secret', {
    message: { type: 'end-of-call-report', call: { id: 'routes-test-call-1' }, endedReason: 'customer-ended-call' },
  })
  assert.equal(stranger.statusCode, 404, 'an unauthenticated report never reaches the funnel')
  assert.equal(q.callOutcomeFor(call.id), undefined, 'and writes nothing on its way out')

  const midCall = await send('POST', path, { message: { type: 'transcript', call: { id: 'routes-test-call-1' } } })
  assert.equal(midCall.statusCode, 200, 'live messages are acknowledged so nothing retries')
  assert.equal((midCall.json() as { ignored?: boolean }).ignored, true)
  assert.equal(q.callOutcomeFor(call.id), undefined)

  const unknown = await send('POST', path, {
    message: { type: 'end-of-call-report', call: { id: 'never-placed' }, endedReason: 'customer-ended-call' },
  })
  assert.equal(unknown.statusCode, 404, 'a report for a call we never placed is a clean 404, not a 500')

  const report = await send('POST', path, {
    message: {
      type: 'end-of-call-report',
      call: { id: 'routes-test-call-1' },
      endedReason: 'customer-ended-call',
      durationSeconds: 187,
      recordingUrl: 'https://example.invalid/routes-test.mp3',
      analysis: { summary: 'Asked for a proposal.' },
    },
  })
  assert.equal(report.statusCode, 200)
  const body = report.json() as { status: string; seconds: number; advanced: boolean; reason: string }
  assert.deepEqual(
    { status: body.status, seconds: body.seconds, advanced: body.advanced, reason: body.reason },
    { status: 'completed', seconds: 187, advanced: true, reason: 'answered' },
  )

  const stored = q.callOutcomeFor(call.id)!
  assert.equal(stored.status, 'completed')
  assert.equal(stored.ended_reason, 'customer-ended-call')
  assert.equal(stored.recording_url, 'https://example.invalid/routes-test.mp3')
  assert.equal(stored.summary, 'Asked for a proposal.')
  assert.ok(stored.raw_json.includes('end-of-call-report'), 'the payload is kept whole')

  const after = await get(`/api/leads/${lead.id}`)
  assert.equal((after.json() as { lead: { stage: string } }).lead.stage, 'qualified')

  // The provider retries; the lead is not logged as having spoken to us twice.
  const replay = await send('POST', path, {
    message: {
      type: 'end-of-call-report',
      call: { id: 'routes-test-call-1' },
      endedReason: 'customer-ended-call',
      durationSeconds: 187,
    },
  })
  assert.equal(replay.statusCode, 200)
  assert.equal((replay.json() as { advanced: boolean }).advanced, false)

  const events = await get(`/api/leads/${lead.id}`)
  const logged = (events.json() as { events: { type: string }[] }).events.filter((e) => e.type === 'call_completed')
  assert.equal(logged.length, 1)
})

// ── boards ───────────────────────────────────────────────────────────────

/**
 * `server/index.ts` registers the board plugin, but this agent does not own
 * that file, so these cases mount it on their own instance — prepared exactly
 * the way `buildServer()` prepares one: the same empty-body JSON parser, the
 * same guard, and the same database this file already opened. Once
 * `boardRoutes` is in `buildServer()` they can move onto the shared `app`
 * unchanged.
 */
const Fastify = (await import('fastify')).default
const { registerAuth, isPublicPath, createSession, destroySession, SESSION_COOKIE } = await import('../auth.ts')
const boardRoutes = (await import('./boards.ts')).default

const buildBoardApp = async () => {
  const instance = Fastify({ logger: false })
  instance.addContentTypeParser('application/json', { parseAs: 'string' }, (_request, body, done) => {
    const raw = typeof body === 'string' ? body.trim() : ''
    if (raw === '') return done(null, {})
    try {
      done(null, JSON.parse(raw))
    } catch (error) {
      const parseError = error as Error & { statusCode?: number }
      parseError.statusCode = 400
      done(parseError, undefined)
    }
  })
  // Directly, not through register: a plugin body would encapsulate the hook.
  registerAuth(instance)
  await instance.register(boardRoutes)
  await instance.ready()
  return instance
}

type BoardApp = Awaited<ReturnType<typeof buildBoardApp>>
type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

const hit = (instance: BoardApp, method: Method, url: string, payload?: unknown, token?: string) =>
  instance.inject({
    method,
    url,
    headers: token ? { ...JSON_HEADERS, cookie: `${SESSION_COOKIE}=${token}` } : JSON_HEADERS,
    payload: payload === undefined ? undefined : JSON.stringify(payload),
  })

const boardNode = (id: string, x = 0) => ({
  id,
  kind: 'plain',
  x,
  y: 0,
  icon: 'router',
  title: { fa: `گره ${id}`, en: `Node ${id}` },
})

type PostedGraph = { nodes: unknown[]; edges: unknown[]; groups: unknown[] }
const boardGraph = (ids: string[], edges: { id: string; source: string; target: string }[] = []): PostedGraph => ({
  nodes: ids.map((id, index) => boardNode(id, index * 200)),
  edges,
  groups: [],
})

type BoardView = {
  board: { slug: string; name: { fa: string; en: string }; visibility: string; version: number; nodes: number; edges: number }
  graph: { nodes: { id: string }[]; edges: { id: string }[] }
  version?: number
  restoredFrom?: number | null
}
type VersionList = { versions: { version: number; note: string | null; restoredFrom: number | null; nodes: number; edges: number }[] }

test('a board is created, saved twice, and restored without losing what came after', async () => {
  const boards = await buildBoardApp()
  try {
    const created = await hit(boards, 'POST', '/api/boards', { name: { fa: 'قیف فروش', en: 'Sales funnel' } })
    assert.equal(created.statusCode, 201)
    const fresh = created.json() as BoardView
    assert.equal(fresh.board.slug, 'sales-funnel')
    assert.equal(fresh.board.visibility, 'private', 'a new board is private until it is published')
    assert.deepEqual(fresh.board.name, { fa: 'قیف فروش', en: 'Sales funnel' })
    assert.equal(fresh.board.version, 0, 'a board nobody has saved yet has no version')
    assert.deepEqual(fresh.graph.nodes, [])

    const first = await hit(boards, 'PUT', '/api/boards/sales-funnel', {
      graph: boardGraph(['inbox', 'score'], [{ id: 'e1', source: 'inbox', target: 'score' }]),
      note: 'the first pass',
    })
    assert.equal(first.statusCode, 200)
    assert.equal((first.json() as BoardView).version, 1)

    const second = await hit(boards, 'PUT', '/api/boards/sales-funnel', {
      graph: boardGraph(['inbox', 'score', 'route'], [{ id: 'e1', source: 'inbox', target: 'score' }]),
    })
    assert.equal(second.statusCode, 200)
    assert.equal((second.json() as BoardView).version, 2)

    const history = await hit(boards, 'GET', '/api/boards/sales-funnel/versions')
    assert.equal(history.statusCode, 200)
    const two = (history.json() as VersionList).versions
    assert.deepEqual(two.map((entry) => entry.version), [2, 1], 'newest first')
    assert.deepEqual(two.map((entry) => entry.nodes), [3, 2])
    assert.equal(two[1].note, 'the first pass')
    assert.equal(JSON.stringify(two).includes('"graph"'), false, 'a history list carries counts, never graphs')

    const preview = await hit(boards, 'GET', '/api/boards/sales-funnel/versions/1')
    assert.equal(preview.statusCode, 200)
    const old = preview.json() as { version: number; nodes: number; graph: { nodes: unknown[] } }
    assert.equal(old.version, 1)
    assert.equal(old.nodes, 2)
    assert.equal(old.graph.nodes.length, 2, 'the graph sits where a board read keeps it')

    const restored = await hit(boards, 'POST', '/api/boards/sales-funnel/restore/1', {})
    assert.equal(restored.statusCode, 201)
    const back = restored.json() as BoardView
    assert.equal(back.version, 3, 'a restore is a new version, not a rewind')
    assert.equal(back.restoredFrom, 1)
    assert.deepEqual(back.graph.nodes.map((node) => node.id), ['inbox', 'score'])

    const after = (await hit(boards, 'GET', '/api/boards/sales-funnel/versions')).json() as VersionList
    assert.deepEqual(after.versions.map((entry) => entry.version), [3, 2, 1], 'history stays append-only')

    // The accidental restore is itself undoable, because version 2 is still there.
    const undone = await hit(boards, 'POST', '/api/boards/sales-funnel/restore/2')
    assert.equal(undone.statusCode, 201)
    assert.equal((undone.json() as BoardView).board.nodes, 3)

    assert.equal((await hit(boards, 'GET', '/api/boards/sales-funnel/versions/99')).statusCode, 404)
    const notANumber = await hit(boards, 'GET', '/api/boards/sales-funnel/versions/latest')
    assert.equal(notANumber.statusCode, 400)
    assert.deepEqual((notANumber.json() as { errors: string[] }).errors, ['version:not_a_number'])
    assert.equal((await hit(boards, 'GET', '/api/boards/no-such-board')).statusCode, 404)
  } finally {
    await boards.close()
  }
})

test('a saved graph drops the edges that lead nowhere and refuses one over the cap', async () => {
  const boards = await buildBoardApp()
  try {
    await hit(boards, 'POST', '/api/boards', { name: { fa: 'لبه‌ها', en: 'Edges' } })

    const saved = await hit(boards, 'PUT', '/api/boards/edges', {
      graph: {
        nodes: [boardNode('a'), boardNode('b')],
        edges: [
          { id: 'kept', source: 'a', target: 'b' },
          { id: 'dangling', source: 'a', target: 'ghost' },
          { id: 'itself', source: 'a', target: 'a' },
        ],
        groups: [],
      },
    })
    assert.equal(saved.statusCode, 200, 'an editor that just deleted a node can still save')
    const graph = (saved.json() as BoardView).graph
    assert.deepEqual(graph.edges.map((edge) => edge.id), ['kept'])

    const tooBig = await hit(boards, 'PUT', '/api/boards/edges', {
      graph: boardGraph(Array.from({ length: 201 }, (_, index) => `n${index}`)),
    })
    assert.equal(tooBig.statusCode, 400)
    assert.deepEqual((tooBig.json() as { errors: string[] }).errors, ['nodes:too_many:200'])

    const notAList = await hit(boards, 'PUT', '/api/boards/edges', { graph: { nodes: 'lots' } })
    assert.deepEqual((notAList.json() as { errors: string[] }).errors, ['nodes:not_a_list'])

    // The failed saves wrote nothing: the board is still on the version it was.
    assert.equal(((await hit(boards, 'GET', '/api/boards/edges')).json() as BoardView).board.version, 1)
  } finally {
    await boards.close()
  }
})

test('two boards with the same name get different slugs, and a Persian-only name still gets one', async () => {
  const boards = await buildBoardApp()
  try {
    const name = { fa: 'رشد', en: 'Growth loop' }
    const first = await hit(boards, 'POST', '/api/boards', { name })
    const second = await hit(boards, 'POST', '/api/boards', { name })
    assert.equal(first.statusCode, 201)
    assert.equal(second.statusCode, 201)
    assert.equal((first.json() as BoardView).board.slug, 'growth-loop')
    assert.equal((second.json() as BoardView).board.slug, 'growth-loop-2')

    const persian = await hit(boards, 'POST', '/api/boards', { name: { fa: 'تخته‌ی من' } })
    assert.equal(persian.statusCode, 201)
    const only = (persian.json() as BoardView).board
    assert.match(only.slug, /^board(-\d+)?$/, 'a name that transliterates to nothing still gets a typeable slug')
    assert.equal(only.name.en, 'تخته‌ی من', 'one language given fills the other rather than storing a blank')

    const nameless = await hit(boards, 'POST', '/api/boards', { name: { fa: '  ' } })
    assert.equal(nameless.statusCode, 400)
    assert.deepEqual((nameless.json() as { errors: string[] }).errors, ['name:required'])

    const wrongVisibility = await hit(boards, 'POST', '/api/boards', { name, visibility: 'unlisted' })
    assert.equal(wrongVisibility.statusCode, 400)
    assert.deepEqual((wrongVisibility.json() as { errors: string[] }).errors, ['visibility:not_an_option'])
  } finally {
    await boards.close()
  }
})

test('renaming keeps the slug, and deleting takes the history with it', async () => {
  const boards = await buildBoardApp()
  try {
    await hit(boards, 'POST', '/api/boards', { name: { fa: 'موقت', en: 'Temporary' } })
    await hit(boards, 'PUT', '/api/boards/temporary', { graph: boardGraph(['a']) })

    const renamed = await hit(boards, 'PATCH', '/api/boards/temporary', {
      name: { fa: 'ماندگار', en: 'Permanent' },
      visibility: 'public',
    })
    assert.equal(renamed.statusCode, 200)
    const board = (renamed.json() as BoardView).board
    assert.equal(board.slug, 'temporary', 'a shared link does not move when the board is renamed')
    assert.equal(board.name.en, 'Permanent')
    assert.equal(board.visibility, 'public')

    const nothing = await hit(boards, 'PATCH', '/api/boards/temporary', {})
    assert.equal(nothing.statusCode, 400)
    assert.deepEqual((nothing.json() as { errors: string[] }).errors, ['board:no_changes'])

    const removed = await hit(boards, 'DELETE', '/api/boards/temporary')
    assert.equal(removed.statusCode, 200)
    assert.equal((await hit(boards, 'GET', '/api/boards/temporary')).statusCode, 404)
    assert.equal((await hit(boards, 'DELETE', '/api/boards/temporary')).statusCode, 404)

    const db = (await import('../db/index.ts')).db()
    const left = db
      .prepare('SELECT COUNT(*) AS n FROM board_versions WHERE board_id NOT IN (SELECT id FROM boards)')
      .get() as { n: number }
    assert.equal(Number(left.n), 0, 'the cascade takes the versions with the board')
  } finally {
    await boards.close()
  }
})

test('only the single-board read is public, and no crafted path widens that', () => {
  assert.equal(isPublicPath('GET', '/api/boards/sales-funnel'), true)
  assert.equal(isPublicPath('GET', '/api/boards/sales-funnel?from=share'), true)

  assert.equal(isPublicPath('GET', '/api/boards'), false, 'the list is not public')
  assert.equal(isPublicPath('GET', '/api/boards/'), false)
  assert.equal(isPublicPath('GET', '/api/boards/x/'), false, 'a trailing slash is a second segment')
  assert.equal(isPublicPath('GET', '/api/boards/x/versions'), false)
  assert.equal(isPublicPath('GET', '/api/boards/x/versions/1'), false)
  assert.equal(isPublicPath('GET', '/api/boards/x/../leads'), false)
  assert.equal(isPublicPath('GET', '/api/boards/../../api/leads'), false)
  assert.equal(isPublicPath('GET', '/api/boardsx'), false)
  assert.equal(isPublicPath('GET', '/api/boards/x/y'), false)
  assert.equal(isPublicPath('PUT', '/api/boards/x'), false)
  assert.equal(isPublicPath('PATCH', '/api/boards/x'), false)
  assert.equal(isPublicPath('DELETE', '/api/boards/x'), false)
  assert.equal(isPublicPath('POST', '/api/boards'), false)
  assert.equal(isPublicPath('POST', '/api/boards/x/restore/1'), false)
  assert.equal(isPublicPath('HEAD', '/api/boards/x'), false)
})

test('a private board is invisible without a session and a public one is readable', async () => {
  // auth.ts reads its variables at call time, deliberately, so a test can
  // switch authentication on around the cases that need it.
  process.env.APP_PASSWORD = 'boards-test-password'
  const boards = await buildBoardApp()
  const { token } = createSession()

  try {
    const secret = await hit(boards, 'POST', '/api/boards', { name: { fa: 'خصوصی', en: 'Secret board' } }, token)
    assert.equal(secret.statusCode, 201)
    const shared = await hit(
      boards,
      'POST',
      '/api/boards',
      { name: { fa: 'عمومی', en: 'Shared board' }, visibility: 'public' },
      token,
    )
    assert.equal(shared.statusCode, 201)
    await hit(boards, 'PUT', '/api/boards/shared-board', { graph: boardGraph(['a', 'b']) }, token)

    assert.equal((await hit(boards, 'POST', '/api/boards', { name: { fa: 'ب', en: 'No session' } })).statusCode, 401)

    const stranger = await hit(boards, 'GET', '/api/boards/secret-board')
    assert.equal(stranger.statusCode, 404, 'a private board answers exactly as a missing one does')
    assert.deepEqual((stranger.json() as { errors: string[] }).errors, ['slug:unknown_board'])
    assert.deepEqual(
      (await hit(boards, 'GET', '/api/boards/never-existed')).json(),
      stranger.json(),
      'and the two answers are indistinguishable',
    )

    assert.equal((await hit(boards, 'GET', '/api/boards/secret-board', undefined, token)).statusCode, 200)

    const anyone = await hit(boards, 'GET', '/api/boards/shared-board')
    assert.equal(anyone.statusCode, 200, 'a public board is readable with no session')
    assert.equal((anyone.json() as BoardView).graph.nodes.length, 2)

    // Everything but that one read stays behind the guard, public board or not.
    assert.equal((await hit(boards, 'GET', '/api/boards')).statusCode, 401)
    assert.equal((await hit(boards, 'GET', '/api/boards/shared-board/versions')).statusCode, 401)
    assert.equal((await hit(boards, 'GET', '/api/boards/shared-board/versions/1')).statusCode, 401)
    assert.equal((await hit(boards, 'PUT', '/api/boards/shared-board', { graph: boardGraph(['x']) })).statusCode, 401)
    assert.equal((await hit(boards, 'PATCH', '/api/boards/shared-board', { visibility: 'private' })).statusCode, 401)
    assert.equal((await hit(boards, 'DELETE', '/api/boards/shared-board')).statusCode, 401)
    assert.equal((await hit(boards, 'POST', '/api/boards/shared-board/restore/1')).statusCode, 401)

    // An encoded slash is still one segment to the allowlist, and decodes to a
    // slug no board can hold — it reaches the read handler and finds nothing.
    assert.equal((await hit(boards, 'GET', '/api/boards/shared-board%2Fversions')).statusCode, 404)
    assert.equal((await hit(boards, 'GET', '/api/boards/%2E%2E%2Fleads')).statusCode, 404)
    assert.notEqual((await hit(boards, 'GET', '/api/boards/shared-board/')).statusCode, 200)

    const listed = await hit(boards, 'GET', '/api/boards', undefined, token)
    assert.equal(listed.statusCode, 200)
    const slugs = (listed.json() as { boards: { slug: string }[] }).boards.map((entry) => entry.slug)
    assert.ok(slugs.includes('secret-board'), 'the owner sees their own private boards')
    assert.ok(slugs.includes('shared-board'))

    const queries = await import('../db/queries.ts')
    const signedOut = queries.listBoards(false).map((entry) => entry.slug)
    assert.equal(signedOut.includes('secret-board'), false, 'the list never leaks a private board')
    assert.ok(signedOut.includes('shared-board'))
  } finally {
    destroySession(token)
    delete process.env.APP_PASSWORD
    await boards.close()
  }
})

test('history is bounded: the oldest versions fall off once the window is full', async () => {
  const boards = await buildBoardApp()
  try {
    const { BOARD_VERSION_LIMIT } = await import('../domain/board.ts')
    await hit(boards, 'POST', '/api/boards', { name: { fa: 'دراز', en: 'Long history' } })

    const saves = BOARD_VERSION_LIMIT + 5
    for (let n = 1; n <= saves; n += 1) {
      const saved = await hit(boards, 'PUT', '/api/boards/long-history', { graph: boardGraph([`n${n}`]) })
      assert.equal(saved.statusCode, 200)
    }

    const history = (await hit(boards, 'GET', '/api/boards/long-history/versions')).json() as VersionList
    assert.equal(history.versions.length, BOARD_VERSION_LIMIT, 'the window holds and no further')
    assert.equal(history.versions[0].version, saves, 'the newest save is the current version')
    assert.equal(history.versions.at(-1)!.version, saves - BOARD_VERSION_LIMIT + 1)
    assert.equal((await hit(boards, 'GET', '/api/boards/long-history/versions/1')).statusCode, 404)
  } finally {
    await boards.close()
  }
})
