import { rmSync } from 'node:fs'
import { env } from '../server/env.ts'
import { closeDatabase } from '../server/db/index.ts'
import * as q from '../server/db/queries.ts'
import {
  bookMeeting,
  capture,
  capturePayment,
  completeCall,
  DEFAULT_DEAL_TOMAN,
  handleInbound,
  recordReferral,
  runDueSteps,
  startCheckout,
} from '../server/service.ts'
import type { Channel } from '../server/types.ts'

/**
 * Fills a fresh database with a plausible month so the board has something to
 * show before any real lead arrives. Everything goes through the same service
 * functions the live path uses — no rows are hand-written.
 */

const NAMES = ['سارا', 'مهدی', 'نگین', 'Amir', 'Parisa', 'رضا', 'Nika', 'حامد', 'Bahar', 'Kian']
const CHANNEL_MIX: Channel[] = [
  ...Array<Channel>(9).fill('instagram'),
  ...Array<Channel>(6).fill('telegram'),
  ...Array<Channel>(5).fill('linkedin'),
  ...Array<Channel>(3).fill('youtube'),
  ...Array<Channel>(7).fill('website'),
]

// Deterministic, so two seeded databases look the same.
let state = 20260830
const random = () => ((state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296)
const pick = <T,>(items: T[]): T => items[Math.floor(random() * items.length)]

if (process.argv.includes('--fresh') && env.dbFile !== ':memory:') {
  for (const suffix of ['', '-wal', '-shm']) rmSync(`${env.dbFile}${suffix}`, { force: true })
}

const CONTENT: [string, string, number][] = [
  ['voice', 'برند وویس — نسخه فارسی', 9],
  ['voice', 'برند وویس — لحن رسمی', 9],
  ['video', 'تیزر محصول ۱۵ ثانیه', 6],
  ['video', 'آواتار معرفی سرویس', 5],
  ['copy', 'کارزار مطالعه موردی', 8],
]
for (const [kind, title, times] of CONTENT) {
  for (let i = 0; i < times; i += 1) q.addContentPiece(kind, `${title} #${i + 1}`)
}

const leads = []
for (let i = 0; i < 34; i += 1) {
  const source = pick(CHANNEL_MIX)
  const lead = capture({
    source,
    externalId: `seed-${source}-${i}`,
    name: pick(NAMES),
    handle: `user${i}`,
    locale: random() > 0.25 ? 'fa' : 'en',
    message: random() > 0.55 ? 'سلام، درباره این سرویس بیشتر توضیح می‌دید؟' : undefined,
  })
  leads.push(lead)

  const heat = random()
  if (heat > 0.45) q.addEvent(lead.id, 'link_click')
  if (heat > 0.6) q.addEvent(lead.id, 'content_view')
  if (heat > 0.72) q.addEvent(lead.id, 'form_submit')
}

await runDueSteps()

// Spread the sample leads across the last month so score decay and the
// cycle-length KPI have something real to measure.
leads.forEach((lead, index) => q.backdateLead(lead.id, 2 + Math.round((index / leads.length) * 26)))

// A slice of the leads walks the rest of the funnel.
for (const lead of leads.slice(0, 14)) handleInbound(lead.id, 'بله، برام مهمه. جزئیات بفرستید.')
for (const lead of leads.slice(0, 9)) {
  bookMeeting(lead.id)
  completeCall(lead.id)
}
for (const lead of leads.slice(0, 5)) {
  const checkout = await startCheckout(lead.id, DEFAULT_DEAL_TOMAN + Math.round(random() * 8_000_000))
  if (checkout) {
    capturePayment({
      leadId: lead.id,
      dealId: checkout.dealId,
      ref: checkout.ref,
      amountToman: checkout.amountToman,
    })
  }
}
// Four more reach checkout without paying, so the pipeline has open value.
for (const lead of leads.slice(6, 10)) {
  await startCheckout(lead.id, DEFAULT_DEAL_TOMAN + Math.round(random() * 12_000_000))
}

for (const lead of leads.slice(0, 2)) recordReferral(lead.id)

const facts = q.gatherFacts()
console.log(
  `seeded → ${facts.totalLeads} leads · ${facts.paymentCount} payments · ` +
    `${facts.allocatedToman.toLocaleString('en-US')} toman reinvested · db ${env.dbFile}`,
)
closeDatabase()
