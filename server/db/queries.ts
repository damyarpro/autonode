import { db } from './index.ts'
import { CHANNELS } from '../types.ts'
import type {
  Channel,
  Lead,
  LeadEvent,
  LeadEventType,
  Message,
  Route,
  SequenceStep,
  Stage,
} from '../types.ts'
import { emptyFacts, type PipelineFacts } from '../domain/pipeline-view.ts'
import type { ToolRun, ToolRunResult } from '../../shared/aiToolSpecs.ts'

const rows = <T>(sql: string, ...params: unknown[]): T[] =>
  db().prepare(sql).all(...(params as never[])) as T[]

const row = <T>(sql: string, ...params: unknown[]): T | undefined =>
  db().prepare(sql).get(...(params as never[])) as T | undefined

const run = (sql: string, ...params: unknown[]) => db().prepare(sql).run(...(params as never[]))

const count = (sql: string, ...params: unknown[]): number =>
  Number((row<{ n: number }>(sql, ...params) ?? { n: 0 }).n ?? 0)

// ── leads ────────────────────────────────────────────────────────────────

export type CaptureInput = {
  source: Channel
  externalId?: string | null
  handle?: string | null
  name?: string | null
  locale?: string
}

/** Idempotent on (source, externalId) so a replayed webhook updates one lead. */
export function captureLead(input: CaptureInput): { lead: Lead; created: boolean } {
  const existing = input.externalId
    ? row<Lead>('SELECT * FROM leads WHERE source = ? AND external_id = ?', input.source, input.externalId)
    : undefined

  if (existing) {
    run(
      `UPDATE leads SET handle = COALESCE(?, handle), name = COALESCE(?, name),
       updated_at = datetime('now') WHERE id = ?`,
      input.handle ?? null,
      input.name ?? null,
      existing.id,
    )
    return { lead: getLead(existing.id)!, created: false }
  }

  const result = run(
    `INSERT INTO leads (source, external_id, handle, name, locale) VALUES (?, ?, ?, ?, ?)`,
    input.source,
    input.externalId ?? null,
    input.handle ?? null,
    input.name ?? null,
    input.locale ?? 'fa',
  )
  return { lead: getLead(Number(result.lastInsertRowid))!, created: true }
}

export const getLead = (id: number) => row<Lead>('SELECT * FROM leads WHERE id = ?', id)

export function listLeads(filter: { route?: Route; stage?: Stage; q?: string; limit?: number } = {}): Lead[] {
  const where: string[] = []
  const params: unknown[] = []
  if (filter.route) (where.push('route = ?'), params.push(filter.route))
  if (filter.stage) (where.push('stage = ?'), params.push(filter.stage))
  if (filter.q) {
    where.push("(COALESCE(name, '') LIKE ? OR COALESCE(handle, '') LIKE ?)")
    params.push(`%${filter.q}%`, `%${filter.q}%`)
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  params.push(filter.limit ?? 200)
  return rows<Lead>(`SELECT * FROM leads ${clause} ORDER BY updated_at DESC LIMIT ?`, ...params)
}

export function updateLead(id: number, patch: Partial<Pick<Lead, 'score' | 'route' | 'stage' | 'owner' | 'value_toman'>>) {
  const sets = Object.keys(patch).map((key) => `${key} = ?`)
  if (sets.length === 0) return
  run(
    `UPDATE leads SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`,
    ...Object.values(patch),
    id,
  )
}

// ── events ───────────────────────────────────────────────────────────────

export function addEvent(leadId: number, type: LeadEventType, payload?: unknown): void {
  run(
    'INSERT INTO lead_events (lead_id, type, payload_json) VALUES (?, ?, ?)',
    leadId,
    type,
    payload === undefined ? null : JSON.stringify(payload),
  )
}

export const leadEvents = (leadId: number) =>
  rows<LeadEvent>('SELECT * FROM lead_events WHERE lead_id = ? ORDER BY at ASC, id ASC', leadId)

// ── messages ─────────────────────────────────────────────────────────────

export function addMessage(message: Omit<Message, 'id' | 'at'>): void {
  run(
    `INSERT INTO messages (lead_id, channel, direction, body, status, external_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    message.lead_id,
    message.channel,
    message.direction,
    message.body,
    message.status,
    message.external_id ?? null,
  )
}

export const leadMessages = (leadId: number) =>
  rows<Message>('SELECT * FROM messages WHERE lead_id = ? ORDER BY at ASC, id ASC', leadId)

export const conversations = (limit = 60) =>
  rows<Lead & { last_body: string; last_at: string; unread: number }>(
    `SELECT l.*,
            m.body AS last_body,
            m.at   AS last_at,
            (SELECT COUNT(*) FROM messages x
              WHERE x.lead_id = l.id AND x.direction = 'in') AS unread
       FROM leads l
       JOIN messages m ON m.id = (
            SELECT id FROM messages WHERE lead_id = l.id ORDER BY at DESC, id DESC LIMIT 1)
      ORDER BY m.at DESC LIMIT ?`,
    limit,
  )

// ── sequence steps ───────────────────────────────────────────────────────

export function cancelPendingSteps(leadId: number): void {
  run("UPDATE sequence_steps SET status = 'cancelled' WHERE lead_id = ? AND status = 'pending'", leadId)
}

export function scheduleStep(leadId: number, sequence: Route, stepIndex: number, dueAt: Date): void {
  run(
    'INSERT INTO sequence_steps (lead_id, sequence, step_index, due_at) VALUES (?, ?, ?, ?)',
    leadId,
    sequence,
    stepIndex,
    dueAt.toISOString(),
  )
}

export const stepCount = (leadId: number): number =>
  count('SELECT COUNT(*) AS n FROM sequence_steps WHERE lead_id = ?', leadId)

export const dueSteps = (now = new Date(), limit = 50) =>
  rows<SequenceStep>(
    "SELECT * FROM sequence_steps WHERE status = 'pending' AND due_at <= ? ORDER BY due_at ASC LIMIT ?",
    now.toISOString(),
    limit,
  )

export const markStepSent = (id: number) =>
  run("UPDATE sequence_steps SET status = 'sent', sent_at = datetime('now') WHERE id = ?", id)

// ── commerce ─────────────────────────────────────────────────────────────

export function openDeal(leadId: number, amountToman: number): number {
  const existing = row<{ id: number }>(
    "SELECT id FROM deals WHERE lead_id = ? AND stage = 'open' ORDER BY id DESC LIMIT 1",
    leadId,
  )
  if (existing) return existing.id
  return Number(run('INSERT INTO deals (lead_id, amount_toman) VALUES (?, ?)', leadId, amountToman).lastInsertRowid)
}

export const dealForLead = (leadId: number) =>
  row<{ id: number; amount_toman: number; stage: string }>(
    'SELECT id, amount_toman, stage FROM deals WHERE lead_id = ? ORDER BY id DESC LIMIT 1',
    leadId,
  )

/** Returns null when this provider reference was already recorded. */
export function recordPayment(dealId: number, provider: string, providerRef: string, amountToman: number): number | null {
  const seen = row<{ id: number }>('SELECT id FROM payments WHERE provider_ref = ?', providerRef)
  if (seen) return null
  const id = Number(
    run(
      "INSERT INTO payments (deal_id, provider, provider_ref, amount_toman, status) VALUES (?, ?, ?, ?, 'captured')",
      dealId,
      provider,
      providerRef,
      amountToman,
    ).lastInsertRowid,
  )
  run("UPDATE deals SET stage = 'won', closed_at = datetime('now') WHERE id = ?", dealId)
  return id
}

export const recordAllocation = (paymentId: number, channel: Channel, amountToman: number) =>
  run('INSERT INTO allocations (source_payment_id, channel, amount_toman) VALUES (?, ?, ?)', paymentId, channel, amountToman)

/**
 * Shifts a lead and its events into the past. Only the seed script uses this —
 * live leads are never rewritten — but without it every sample lead looks like
 * it arrived in the same second and the cycle-length KPI reads zero.
 */
export function backdateLead(leadId: number, days: number): void {
  run(`UPDATE leads SET created_at = datetime(created_at, ?), updated_at = datetime(updated_at, ?) WHERE id = ?`,
    `-${days} days`, `-${days} days`, leadId)
  run(`UPDATE lead_events SET at = datetime(at, ?) WHERE lead_id = ?`, `-${days} days`, leadId)
  run(`UPDATE messages SET at = datetime(at, ?) WHERE lead_id = ?`, `-${days} days`, leadId)
}

export const addContentPiece = (kind: string, title: string, channel?: Channel) =>
  run('INSERT INTO content_pieces (kind, channel, title) VALUES (?, ?, ?)', kind, channel ?? null, title)

// ── aggregates for the canvas ────────────────────────────────────────────

export function gatherFacts(): PipelineFacts {
  const facts = emptyFacts()

  for (const entry of rows<{ source: Channel; n: number }>(
    'SELECT source, COUNT(*) AS n FROM leads GROUP BY source',
  )) {
    if (CHANNELS.includes(entry.source)) facts.leadsByChannel[entry.source] = Number(entry.n)
  }

  for (const entry of rows<{ source: Channel; n: number }>(
    `SELECT l.source AS source, COUNT(e.id) AS n
       FROM leads l JOIN lead_events e ON e.lead_id = l.id GROUP BY l.source`,
  )) {
    if (CHANNELS.includes(entry.source)) facts.touchesByChannel[entry.source] = Number(entry.n)
  }

  facts.totalLeads = count('SELECT COUNT(*) AS n FROM leads')
  facts.identified = count(
    `SELECT COUNT(*) AS n FROM leads WHERE COALESCE(name, '') <> '' OR COALESCE(handle, '') <> ''`,
  )

  for (const entry of rows<{ route: Route; n: number }>('SELECT route, COUNT(*) AS n FROM leads GROUP BY route')) {
    facts.byRoute[entry.route] = Number(entry.n)
  }

  facts.activeConversations = count(
    "SELECT COUNT(DISTINCT lead_id) AS n FROM messages WHERE direction = 'in'",
  )
  facts.inSequence = count("SELECT COUNT(DISTINCT lead_id) AS n FROM sequence_steps WHERE status = 'pending'")
  facts.crmRecords = count('SELECT COUNT(*) AS n FROM lead_events')
  facts.meetingsBooked = count("SELECT COUNT(*) AS n FROM lead_events WHERE type = 'call_booked'")
  facts.callsCompleted = count("SELECT COUNT(*) AS n FROM lead_events WHERE type = 'call_completed'")
  facts.voiceCalls = count("SELECT COUNT(*) AS n FROM lead_events WHERE type IN ('call_booked','call_completed')")

  facts.openDealValueToman = count(
    "SELECT COALESCE(SUM(amount_toman), 0) AS n FROM deals WHERE stage = 'open'",
  )
  facts.paidTotalToman = count(
    "SELECT COALESCE(SUM(amount_toman), 0) AS n FROM payments WHERE status = 'captured'",
  )
  facts.paymentCount = count("SELECT COUNT(*) AS n FROM payments WHERE status = 'captured'")
  facts.allocatedToman = count('SELECT COALESCE(SUM(amount_toman), 0) AS n FROM allocations')

  facts.deliveries = count("SELECT COUNT(*) AS n FROM leads WHERE stage IN ('delivered','advocate')")
  facts.activeAccounts = count("SELECT COUNT(*) AS n FROM leads WHERE stage IN ('paid','delivered','advocate')")
  facts.referrals = count("SELECT COUNT(*) AS n FROM lead_events WHERE type = 'referred'")

  facts.contentPieces = count('SELECT COUNT(*) AS n FROM content_pieces')
  facts.voiceovers = count("SELECT COUNT(*) AS n FROM content_pieces WHERE kind = 'voice'")
  facts.videos = count("SELECT COUNT(*) AS n FROM content_pieces WHERE kind = 'video'")

  facts.cycleDays = rows<{ days: number }>(
    `SELECT (julianday(p.at) - julianday(l.created_at)) AS days
       FROM payments p JOIN deals d ON d.id = p.deal_id JOIN leads l ON l.id = d.lead_id
      WHERE p.status = 'captured'`,
  ).map((entry) => Number(entry.days))

  return facts
}

// ── ai tool runs ─────────────────────────────────────────────────────────

type ToolRunRow = {
  id: number
  tool_id: string
  inputs_json: string
  result_json: string
  produced_by: string
  at: string
}

/** The two JSON columns come back as the shapes shared/aiToolSpecs.ts declares. */
const toToolRun = (record: ToolRunRow): ToolRun => ({
  id: record.id,
  toolId: record.tool_id,
  inputs: JSON.parse(record.inputs_json) as Record<string, string>,
  result: JSON.parse(record.result_json) as ToolRunResult,
  at: record.at,
})

export function saveToolRun(
  toolId: string,
  inputs: Record<string, string>,
  result: ToolRunResult,
): ToolRun {
  const id = Number(
    run(
      'INSERT INTO tool_runs (tool_id, inputs_json, result_json, produced_by) VALUES (?, ?, ?, ?)',
      toolId,
      JSON.stringify(inputs),
      JSON.stringify(result),
      result.producedBy,
    ).lastInsertRowid,
  )
  return toToolRun(row<ToolRunRow>('SELECT * FROM tool_runs WHERE id = ?', id)!)
}

/** Newest first — the tool page shows the last run above the older ones. */
export const listToolRuns = (toolId: string, limit = 10): ToolRun[] =>
  rows<ToolRunRow>(
    'SELECT * FROM tool_runs WHERE tool_id = ? ORDER BY id DESC LIMIT ?',
    toolId,
    limit,
  ).map(toToolRun)

/** False when there was no such run to delete. */
export const deleteToolRun = (id: number): boolean =>
  Number(run('DELETE FROM tool_runs WHERE id = ?', id).changes) > 0
