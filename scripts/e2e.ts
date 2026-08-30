import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Drives one lead through the entire funnel against a real server on a throwaway
 * database, asserting the outcome at every stage. Run with `npm run e2e`.
 */

const workdir = mkdtempSync(join(tmpdir(), 'monitiez-e2e-'))
process.env.DB_FILE = join(workdir, 'e2e.db')
process.env.SEQUENCE_SPEED = '0' // every nurture step is due immediately
process.env.WORKER_ENABLED = 'false' // this script drives the worker itself
process.env.PORT = '0'

// Imported after the environment is set, since env.ts reads it once.
const { buildServer } = await import('../server/index.ts')
const { runDueSteps } = await import('../server/service.ts')
const { gatherFacts } = await import('../server/db/queries.ts')

const app = await buildServer()
await app.listen({ port: 0, host: '127.0.0.1' })
const base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`

const call = async <T,>(method: string, path: string, body?: unknown): Promise<T> => {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status} ${text}`)
  return text ? (JSON.parse(text) as T) : (undefined as T)
}

const step = (label: string) => console.log(`  ✓ ${label}`)

type LeadResponse = { lead: { id: number; score: number; route: string; stage: string } }

console.log('\ne2e: one lead, capture to reinvested budget\n')

// 1. capture
const captured = await call<LeadResponse>('POST', '/api/leads', {
  source: 'telegram',
  externalId: 'e2e-1',
  name: 'Sara',
  handle: 'sara',
  message: 'سلام، قیمت این سرویس چنده؟',
})
const leadId = captured.lead.id
assert.equal(captured.lead.stage, 'new')
assert.ok(captured.lead.score > 0, 'a captured lead has a score')
step(`captured lead ${leadId} · score ${captured.lead.score} · route ${captured.lead.route}`)

// 2. the nurture worker delivers the first step of the routed sequence
const sent = await runDueSteps()
assert.ok(sent >= 1, 'the first nurture step goes out')
const afterNurture = await call<{ messages: { direction: string }[] }>('GET', `/api/leads/${leadId}`)
assert.ok(
  afterNurture.messages.some((message) => message.direction === 'out'),
  'an outbound message was recorded',
)
step(`worker delivered ${sent} nurture step(s)`)

// 3. the lead replies, which re-scores them
const replied = await call<LeadResponse>('POST', `/api/leads/${leadId}/inbound`, {
  body: 'بله جدی می‌خوام، جزئیات بفرستید',
})
assert.ok(replied.lead.score > captured.lead.score, 'replying raises the score')
assert.equal(replied.lead.stage, 'engaged')
step(`reply raised the score to ${replied.lead.score}`)

// 4. meeting booked and completed
await call('POST', `/api/leads/${leadId}/book-meeting`)
const qualified = await call<LeadResponse>('POST', `/api/leads/${leadId}/complete-call`)
assert.equal(qualified.lead.stage, 'meeting')
assert.equal(qualified.lead.route, 'hot', 'a lead this engaged lands on the hot route')
step(`meeting booked and completed · route ${qualified.lead.route}`)

// 5. checkout
const checkout = await call<{ url: string; ref: string; dealId: number; amountToman: number }>(
  'POST',
  `/api/checkout/${leadId}`,
)
assert.ok(checkout.url.includes(checkout.ref), 'the checkout url carries its reference')
step(`checkout created for ${checkout.amountToman.toLocaleString('en-US')} toman`)

// 6. payment, which closes the growth loop
const paid = await call<{ ok: boolean; reinvest: number }>('POST', '/api/webhooks/payment', {
  leadId,
  dealId: checkout.dealId,
  ref: checkout.ref,
  amountToman: checkout.amountToman,
})
assert.equal(paid.ok, true)
assert.ok(paid.reinvest > 0, 'part of the payment is reinvested')
step(`payment captured · ${paid.reinvest.toLocaleString('en-US')} toman reinvested`)

// 7. the same reference cannot be banked twice
const replay = await fetch(`${base}/api/webhooks/payment`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ leadId, dealId: checkout.dealId, ref: checkout.ref, amountToman: checkout.amountToman }),
})
assert.equal(replay.status, 409, 'a replayed payment is rejected')
step('replayed payment rejected with 409')

// 8. final state
const final = await call<LeadResponse>('GET', `/api/leads/${leadId}`)
assert.equal(final.lead.stage, 'delivered', 'payment starts delivery')

const facts = gatherFacts()
assert.equal(facts.paymentCount, 1)
assert.equal(facts.allocatedToman, paid.reinvest)
assert.equal(facts.totalLeads, 1)

const pipeline = await call<{ metrics: Record<string, number> }>('GET', '/api/pipeline')
assert.equal(pipeline.metrics['telegram.badge'], 1)
assert.equal(pipeline.metrics['sale.badge'], 1)
assert.equal(pipeline.metrics['growth.badge'], paid.reinvest)
step('pipeline metrics reflect the run')

console.log(`\ne2e passed · stage ${final.lead.stage} · score ${final.lead.score}\n`)

await app.close()
rmSync(workdir, { recursive: true, force: true })
