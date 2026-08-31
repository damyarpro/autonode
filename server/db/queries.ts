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
import {
  emptyBusiness,
  emptyDestinations,
  normalizeDestinations,
  TONES,
  type BusinessProfile,
  type ChannelDestinations,
  type Tone,
} from '../domain/business.ts'
import type { ToolRun, ToolRunResult } from '../../shared/aiToolSpecs.ts'
import { emptyGraph, type Bi, type BoardGraph, type BoardVisibility } from '../../shared/boardGraph.ts'
import type { CallBrief } from '../domain/booking.ts'
import { isStatus, type ContentKind, type ContentRecord, type ContentStatus } from '../domain/content.ts'

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

  facts.publishedByChannel = publishedContentByChannel()

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
  facts.callsPrepared = count('SELECT COUNT(*) AS n FROM calls')
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

// ── business profile ─────────────────────────────────────────────────────

type BusinessRow = {
  name: string
  what_we_sell: string
  audience: string
  tone: string
  price_toman: number
  channels_json: string
  cta_url: string | null
  notes: string | null
}

/** Reads the single row, creating it on first access. */
export function getBusiness(): BusinessProfile {
  run('INSERT OR IGNORE INTO business_profile (id) VALUES (1)')
  const found = row<BusinessRow>('SELECT * FROM business_profile WHERE id = 1')
  if (!found) return emptyBusiness()

  let channels: Channel[] = []
  try {
    const parsed: unknown = JSON.parse(found.channels_json)
    if (Array.isArray(parsed)) channels = parsed.filter((c): c is Channel => CHANNELS.includes(c as Channel))
  } catch {
    // A hand-edited row should not take the whole profile down.
  }

  return {
    name: found.name,
    whatWeSell: found.what_we_sell,
    audience: found.audience,
    tone: TONES.includes(found.tone as Tone) ? (found.tone as Tone) : 'friendly',
    priceToman: Number(found.price_toman) || 0,
    channels,
    ctaUrl: found.cta_url,
    notes: found.notes,
    destinations: readDestinations(),
  }
}

export function saveBusiness(patch: Partial<BusinessProfile>): BusinessProfile {
  const current = getBusiness()
  const next = { ...current, ...patch }
  run(
    `UPDATE business_profile SET name = ?, what_we_sell = ?, audience = ?, tone = ?,
       price_toman = ?, channels_json = ?, cta_url = ?, notes = ?, updated_at = datetime('now')
     WHERE id = 1`,
    next.name,
    next.whatWeSell,
    next.audience,
    next.tone,
    Math.max(0, Math.round(next.priceToman)),
    JSON.stringify(next.channels),
    next.ctaUrl,
    next.notes,
  )
  writeDestinations(next.destinations)
  return getBusiness()
}

// ── content ──────────────────────────────────────────────────────────────

type ContentRow = {
  id: number
  kind: string
  channel: string | null
  title: string
  body: string
  locale: string
  angle: string | null
  target: string | null
  status: string
  due_at: string
  published_at: string | null
  produced_by: string
  note: string | null
  created_at: string
}

const CONTENT_SELECT = `SELECT p.id, p.kind, p.channel, p.title, p.created_at,
         s.body, s.locale, s.angle, s.target, s.status, s.due_at, s.published_at,
         s.produced_by, s.note
    FROM content_pieces p JOIN content_schedule s ON s.content_piece_id = p.id`

/** A seeded piece has no schedule row, so it never reaches the publisher. */
const toContent = (record: ContentRow): ContentRecord => ({
  id: record.id,
  kind: record.kind as ContentKind,
  channel: (record.channel ?? 'website') as Channel,
  title: record.title,
  body: record.body,
  locale: record.locale,
  angle: record.angle,
  target: record.target,
  status: (isStatus(record.status) ? record.status : 'pending') as ContentStatus,
  dueAt: record.due_at,
  publishedAt: record.published_at,
  producedBy: record.produced_by,
  note: record.note,
  createdAt: record.created_at,
})

export type NewContentPiece = {
  kind: ContentKind
  channel: Channel
  title: string
  body: string
  locale: string
  angle: string | null
  dueAt: Date
  target?: string | null
  producedBy: string
}

/** Writes both halves — what the piece is, and when it goes out. */
export function insertContentPiece(piece: NewContentPiece): ContentRecord {
  const id = Number(
    run(
      "INSERT INTO content_pieces (kind, channel, title, status) VALUES (?, ?, ?, 'pending')",
      piece.kind,
      piece.channel,
      piece.title,
    ).lastInsertRowid,
  )
  run(
    `INSERT INTO content_schedule (content_piece_id, body, locale, angle, target, due_at, produced_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    piece.body,
    piece.locale,
    piece.angle,
    piece.target ?? null,
    piece.dueAt.toISOString(),
    piece.producedBy,
  )
  return getContentPiece(id)!
}

export const getContentPiece = (id: number): ContentRecord | undefined => {
  const found = row<ContentRow>(`${CONTENT_SELECT} WHERE p.id = ?`, id)
  return found ? toContent(found) : undefined
}

export function listContent(
  filter: { status?: ContentStatus; channel?: Channel; limit?: number } = {},
): ContentRecord[] {
  const where: string[] = []
  const params: unknown[] = []
  if (filter.status) (where.push('s.status = ?'), params.push(filter.status))
  if (filter.channel) (where.push('p.channel = ?'), params.push(filter.channel))
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''
  params.push(filter.limit ?? 50)
  return rows<ContentRow>(
    `${CONTENT_SELECT} ${clause} ORDER BY s.due_at DESC, p.id DESC LIMIT ?`,
    ...params,
  ).map(toContent)
}

/** Everything still pending whose hour has come. Oldest first. */
export const dueContent = (now = new Date(), limit = 25): ContentRecord[] =>
  rows<ContentRow>(
    `${CONTENT_SELECT} WHERE s.status = 'pending' AND s.due_at <= ? ORDER BY s.due_at ASC, p.id ASC LIMIT ?`,
    now.toISOString(),
    limit,
  ).map(toContent)

/** The outcome of one publish attempt, mirrored onto the piece itself. */
export function markContentStatus(id: number, status: ContentStatus, note: string | null = null): void {
  run(
    `UPDATE content_schedule SET status = ?, note = ?,
       published_at = CASE WHEN ? = 'pending' THEN NULL ELSE datetime('now') END
     WHERE content_piece_id = ?`,
    status,
    note,
    status,
    id,
  )
  run('UPDATE content_pieces SET status = ? WHERE id = ?', status, id)
}

export const countContent = (status: ContentStatus): number =>
  count('SELECT COUNT(*) AS n FROM content_schedule WHERE status = ?', status)

/** The schedule row goes with it, through the foreign key. */
export const deleteContentPiece = (id: number): boolean =>
  Number(run('DELETE FROM content_pieces WHERE id = ?', id).changes) > 0

/** What each channel node's publish hop has actually put out. */
export function publishedContentByChannel(): Record<Channel, number> {
  const totals = Object.fromEntries(CHANNELS.map((channel) => [channel, 0])) as Record<Channel, number>
  for (const entry of rows<{ channel: Channel; n: number }>(
    `SELECT p.channel AS channel, COUNT(*) AS n
       FROM content_pieces p JOIN content_schedule s ON s.content_piece_id = p.id
      WHERE s.status IN ('sent', 'simulated') GROUP BY p.channel`,
  )) {
    if (CHANNELS.includes(entry.channel)) totals[entry.channel] = Number(entry.n)
  }
  return totals
}

// ── media ────────────────────────────────────────────────────────────────
// The import sits here rather than at the top because this section is appended
// as a block; TypeScript reads it the same either way.

import type {
  AdVideoResult,
  MediaJob,
  MediaKind,
  MediaStatus,
  VoiceoverResult,
} from '../adapters/media/types.ts'

type MediaJobRow = {
  id: number
  kind: string
  status: string
  adapter: string
  locale: string
  input_json: string
  output_json: string
  external_id: string | null
  url: string | null
  duration_sec: number | null
  at: string
}

/** A hand-edited or half-written row must not take the media list down. */
const parse = <T>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json) as T
  } catch {
    return fallback
  }
}

const toMediaJob = (row: MediaJobRow): MediaJob => ({
  id: row.id,
  kind: row.kind as MediaKind,
  status: row.status as MediaStatus,
  adapter: row.adapter,
  locale: row.locale,
  input: parse<Record<string, unknown>>(row.input_json, {}),
  output: parse<VoiceoverResult | AdVideoResult>(row.output_json, { status: 'failed' as const }),
  externalId: row.external_id,
  url: row.url,
  durationSec: row.duration_sec === null ? null : Number(row.duration_sec),
  at: row.at,
})

export type SaveMediaJobInput = {
  kind: MediaKind
  status: MediaStatus
  adapter: string
  locale: string
  input: Record<string, unknown>
  output: VoiceoverResult | AdVideoResult
  externalId?: string | null
  url?: string | null
  durationSec?: number | null
}

export function saveMediaJob(job: SaveMediaJobInput): MediaJob {
  const id = Number(
    run(
      `INSERT INTO media_jobs (kind, status, adapter, locale, input_json, output_json, external_id, url, duration_sec)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      job.kind,
      job.status,
      job.adapter,
      job.locale,
      JSON.stringify(job.input),
      JSON.stringify(job.output),
      job.externalId ?? null,
      job.url ?? null,
      job.durationSec ?? null,
    ).lastInsertRowid,
  )
  return toMediaJob(row<MediaJobRow>('SELECT * FROM media_jobs WHERE id = ?', id)!)
}

/** Newest first, optionally one kind only — the board shows the last runs. */
export const listMediaJobRows = (limit = 20, kind?: MediaKind): MediaJob[] =>
  (kind
    ? rows<MediaJobRow>('SELECT * FROM media_jobs WHERE kind = ? ORDER BY id DESC LIMIT ?', kind, limit)
    : rows<MediaJobRow>('SELECT * FROM media_jobs ORDER BY id DESC LIMIT ?', limit)
  ).map(toMediaJob)

export const getMediaJob = (id: number): MediaJob | undefined => {
  const found = row<MediaJobRow>('SELECT * FROM media_jobs WHERE id = ?', id)
  return found ? toMediaJob(found) : undefined
}

/** False when there was no such job to delete. */
export const deleteMediaJob = (id: number): boolean =>
  Number(run('DELETE FROM media_jobs WHERE id = ?', id).changes) > 0

// ── calls ────────────────────────────────────────────────────────────────

/**
 * `lead_events.at` is written by SQLite's own `datetime('now')`, so a cutoff
 * compared against it has to be in the same `YYYY-MM-DD HH:MM:SS` shape. The
 * columns this section owns store full ISO instants instead, because a meeting
 * is an instant and not a wall-clock reading.
 */
const sqlTime = (at: Date) => at.toISOString().slice(0, 19).replace('T', ' ')

export type CallRow = {
  id: number
  lead_id: number
  provider: string
  status: string
  external_id: string | null
  brief_json: string
  produced_by: string
  at: string
}

export type CallRecord = Omit<CallRow, 'brief_json'> & { brief: CallBrief }

export type Booking = {
  id: number
  lead_id: number
  start_at: string
  minutes: number
  status: string
  note: string | null
  created_at: string
}

export type CallReminderRow = {
  id: number
  booking_id: number
  due_at: string
  status: string
  sent_at: string | null
  lead_id: number
  start_at: string
  minutes: number
}

const toCall = (record: CallRow): CallRecord => {
  const { brief_json, ...rest } = record
  return { ...rest, brief: JSON.parse(brief_json) as CallBrief }
}

export function recordCall(input: {
  leadId: number
  provider: string
  status: string
  externalId?: string | null
  brief: CallBrief
}): CallRecord {
  const id = Number(
    run(
      `INSERT INTO calls (lead_id, provider, status, external_id, brief_json, produced_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      input.leadId,
      input.provider,
      input.status,
      input.externalId ?? null,
      JSON.stringify(input.brief),
      input.brief.producedBy,
    ).lastInsertRowid,
  )
  return toCall(row<CallRow>('SELECT * FROM calls WHERE id = ?', id)!)
}

export const listCalls = (limit = 20): CallRecord[] =>
  rows<CallRow>('SELECT * FROM calls ORDER BY id DESC LIMIT ?', limit).map(toCall)

export const leadCalls = (leadId: number, limit = 10): CallRecord[] =>
  rows<CallRow>('SELECT * FROM calls WHERE lead_id = ? ORDER BY id DESC LIMIT ?', leadId, limit).map(toCall)

export function createBooking(leadId: number, startAt: Date, minutes: number, note?: string): Booking {
  const id = Number(
    run(
      'INSERT INTO bookings (lead_id, start_at, minutes, note) VALUES (?, ?, ?, ?)',
      leadId,
      startAt.toISOString(),
      minutes,
      note ?? null,
    ).lastInsertRowid,
  )
  return row<Booking>('SELECT * FROM bookings WHERE id = ?', id)!
}

/** Everything still on the calendar from `from` on — the input to slot maths. */
export const bookingsFrom = (from: Date, limit = 500): Booking[] =>
  rows<Booking>(
    "SELECT * FROM bookings WHERE status = 'booked' AND start_at >= ? ORDER BY start_at ASC LIMIT ?",
    from.toISOString(),
    limit,
  )

export const listBookings = (limit = 20): Booking[] =>
  rows<Booking>('SELECT * FROM bookings ORDER BY start_at DESC LIMIT ?', limit)

export const scheduleReminder = (bookingId: number, dueAt: Date) =>
  run('INSERT INTO call_reminders (booking_id, due_at) VALUES (?, ?)', bookingId, dueAt.toISOString())

/** Pending reminders whose meeting has not already happened. */
export const dueCallReminders = (now: Date, limit = 50): CallReminderRow[] =>
  rows<CallReminderRow>(
    `SELECT r.*, b.lead_id AS lead_id, b.start_at AS start_at, b.minutes AS minutes
       FROM call_reminders r JOIN bookings b ON b.id = r.booking_id
      WHERE r.status = 'pending' AND r.due_at <= ? AND b.status = 'booked' AND b.start_at > ?
      ORDER BY r.due_at ASC LIMIT ?`,
    now.toISOString(),
    now.toISOString(),
    limit,
  )

export const markReminderSent = (id: number, status: 'sent' | 'cancelled' = 'sent') =>
  run("UPDATE call_reminders SET status = ?, sent_at = datetime('now') WHERE id = ?", status, id)

/** Reminders for a meeting that is no longer going ahead are not sent. */
export const cancelRemindersFor = (bookingId: number) =>
  run("UPDATE call_reminders SET status = 'cancelled' WHERE booking_id = ? AND status = 'pending'", bookingId)

export const remindersFor = (bookingId: number) =>
  rows<{ id: number; due_at: string; status: string }>(
    'SELECT id, due_at, status FROM call_reminders WHERE booking_id = ? ORDER BY due_at ASC',
    bookingId,
  )

/**
 * Customers who took delivery before `before` and have never been asked for a
 * referral. The `NOT EXISTS` is the read half of ask-once; `claimReferralAsk`
 * is the write half.
 */
export const leadsAwaitingReferralAsk = (before: Date, limit = 25): Lead[] =>
  rows<Lead>(
    `SELECT l.* FROM leads l
      WHERE l.stage IN ('delivered', 'advocate')
        AND NOT EXISTS (SELECT 1 FROM referral_asks r WHERE r.lead_id = l.id)
        AND EXISTS (SELECT 1 FROM lead_events e
                     WHERE e.lead_id = l.id AND e.type = 'delivered' AND e.at <= ?)
      ORDER BY l.id ASC LIMIT ?`,
    sqlTime(before),
    limit,
  )

/**
 * Claims the one referral ask this lead will ever get. False means someone —
 * an earlier pass, a concurrent one — already has it, and nothing should be
 * sent. Claiming before sending is what makes a repeated pass a no-op.
 */
export const claimReferralAsk = (leadId: number): boolean =>
  Number(run('INSERT OR IGNORE INTO referral_asks (lead_id) VALUES (?)', leadId).changes) > 0

export const setReferralAskStatus = (leadId: number, status: string) =>
  run('UPDATE referral_asks SET status = ? WHERE lead_id = ?', status, leadId)

export const referralAskFor = (leadId: number) =>
  row<{ lead_id: number; status: string; at: string }>('SELECT * FROM referral_asks WHERE lead_id = ?', leadId)

/** The three numbers the vapi, salescall and referral nodes can now measure. */
export const callCounts = () => ({
  calls: count('SELECT COUNT(*) AS n FROM calls'),
  meetings: count("SELECT COUNT(*) AS n FROM bookings WHERE status = 'booked'"),
  referralAsks: count('SELECT COUNT(*) AS n FROM referral_asks'),
})

/**
 * The deal a payment claims to be for. The payment webhook reads it so a token
 * that was valid for one checkout cannot confirm a different amount.
 */
export function dealById(dealId: number): { id: number; lead_id: number; amount_toman: number; stage: string } | undefined {
  return db()
    .prepare('SELECT id, lead_id, amount_toman, stage FROM deals WHERE id = ?')
    .get(dealId) as { id: number; lead_id: number; amount_toman: number; stage: string } | undefined
}


// ── publishing destinations ──────────────────────────────────────────────
// A satellite of business_profile, read and written as part of the profile so
// callers only ever see one shape. Kept here at the end because the table came
// after the row it belongs to.

/** Reads the destinations blob, creating the single row on first access. */
function readDestinations(): ChannelDestinations {
  run('INSERT OR IGNORE INTO business_destinations (id) VALUES (1)')
  const found = row<{ destinations_json: string }>(
    'SELECT destinations_json FROM business_destinations WHERE id = 1',
  )
  if (!found) return emptyDestinations()

  try {
    // `normalizeDestinations` drops anything that is not a channel we know, so
    // a profile saved before this existed reads back as every channel unset.
    return normalizeDestinations(JSON.parse(found.destinations_json))
  } catch {
    // A hand-edited row should not take the whole profile down.
    return emptyDestinations()
  }
}

/** Writes them back normalized, so nothing reaches the column we cannot read. */
function writeDestinations(destinations: ChannelDestinations): void {
  run('INSERT OR IGNORE INTO business_destinations (id) VALUES (1)')
  run(
    "UPDATE business_destinations SET destinations_json = ?, updated_at = datetime('now') WHERE id = 1",
    JSON.stringify(normalizeDestinations(destinations)),
  )
}

/**
 * Records where a piece actually went. The address is resolved when the piece
 * publishes, not when it is written, so this is history rather than derived
 * state: the profile may name a different address tomorrow and this row must
 * still say where this piece was delivered.
 */
export const setContentTarget = (id: number, target: string | null): void => {
  run('UPDATE content_schedule SET target = ? WHERE content_piece_id = ?', target, id)
}

// ── call outcomes ────────────────────────────────────────────────────────

export type CallOutcomeRow = {
  call_id: number
  status: string
  ended_reason: string | null
  seconds: number | null
  recording_url: string | null
  transcript: string | null
  summary: string | null
  raw_json: string
  at: string
}

/**
 * The call a provider's report is about. Newest first: an id is the provider's
 * to reuse, and the most recent row is the one that was just on the phone.
 */
export const callByExternalId = (externalId: string): CallRecord | undefined => {
  const found = row<CallRow>('SELECT * FROM calls WHERE external_id = ? ORDER BY id DESC LIMIT 1', externalId)
  return found ? toCall(found) : undefined
}

export const callOutcomeFor = (callId: number): CallOutcomeRow | undefined =>
  row<CallOutcomeRow>('SELECT * FROM call_outcomes WHERE call_id = ?', callId)

export type SaveCallOutcomeInput = {
  callId: number
  status: string
  endedReason?: string | null
  seconds?: number | null
  recordingUrl?: string | null
  transcript?: string | null
  summary?: string | null
  raw: unknown
}

/** Upsert, because a provider that gets no answer sends the report again. */
export function saveCallOutcome(input: SaveCallOutcomeInput): CallOutcomeRow {
  run(
    `INSERT INTO call_outcomes (call_id, status, ended_reason, seconds, recording_url, transcript, summary, raw_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (call_id) DO UPDATE SET
       status = excluded.status,
       ended_reason = excluded.ended_reason,
       seconds = excluded.seconds,
       recording_url = excluded.recording_url,
       transcript = excluded.transcript,
       summary = excluded.summary,
       raw_json = excluded.raw_json,
       at = datetime('now')`,
    input.callId,
    input.status,
    input.endedReason ?? null,
    input.seconds ?? null,
    input.recordingUrl ?? null,
    input.transcript ?? null,
    input.summary ?? null,
    JSON.stringify(input.raw ?? null),
  )
  return callOutcomeFor(input.callId)!
}

// ── boards ───────────────────────────────────────────────────────────────

export type BoardRow = {
  id: number
  slug: string
  name_fa: string
  name_en: string
  visibility: string
  created_at: string
  updated_at: string
}

/** What a version says about itself in a history list — never its graph. */
export type BoardVersionEntry = {
  version: number
  note: string | null
  restoredFrom: number | null
  at: string
  nodes: number
  edges: number
  groups: number
}

export type BoardVersionRecord = BoardVersionEntry & { graph: BoardGraph }

/** A board as a list row: the current version and what it holds. */
export type BoardSummary = {
  slug: string
  name: Bi
  visibility: string
  version: number
  nodes: number
  edges: number
  groups: number
  createdAt: string
  updatedAt: string
}

type VersionRow = {
  version: number
  note: string | null
  restored_from: number | null
  at: string
  graph_json: string
}

/**
 * Only normalized graphs are ever written, so a parse failure means the row was
 * damaged outside this file. An empty board reads better than a thrown request.
 */
function readGraph(json: string | null | undefined): BoardGraph {
  if (!json) return emptyGraph()
  try {
    const parsed = JSON.parse(json) as Partial<BoardGraph>
    return {
      nodes: Array.isArray(parsed?.nodes) ? parsed.nodes : [],
      edges: Array.isArray(parsed?.edges) ? parsed.edges : [],
      groups: Array.isArray(parsed?.groups) ? parsed.groups : [],
    }
  } catch {
    return emptyGraph()
  }
}

const toVersion = (row: VersionRow): BoardVersionRecord => {
  const graph = readGraph(row.graph_json)
  return {
    version: row.version,
    note: row.note,
    restoredFrom: row.restored_from,
    at: row.at,
    nodes: graph.nodes.length,
    edges: graph.edges.length,
    groups: graph.groups.length,
    graph,
  }
}

export const boardBySlug = (slug: string): BoardRow | undefined =>
  row<BoardRow>('SELECT * FROM boards WHERE slug = ?', slug)

export const boardSlugTaken = (slug: string): boolean =>
  count('SELECT COUNT(*) AS n FROM boards WHERE slug = ?', slug) > 0

/**
 * Newest first, each row carrying the current version and its counts. A private
 * board is in the answer only when the caller asked for one, which is what
 * keeps it out of a signed-out list.
 */
export function listBoards(includePrivate: boolean): BoardSummary[] {
  const found = rows<BoardRow & { version: number | null; graph_json: string | null }>(
    `SELECT b.*, v.version AS version, v.graph_json AS graph_json
       FROM boards b
       LEFT JOIN board_versions v
         ON v.board_id = b.id
        AND v.version = (SELECT MAX(version) FROM board_versions WHERE board_id = b.id)
      WHERE ? = 1 OR b.visibility = 'public'
      ORDER BY b.id DESC`,
    includePrivate ? 1 : 0,
  )

  return found.map((entry) => {
    const graph = readGraph(entry.graph_json)
    return {
      slug: entry.slug,
      name: { fa: entry.name_fa, en: entry.name_en },
      visibility: entry.visibility,
      version: entry.version ?? 0,
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      groups: graph.groups.length,
      createdAt: entry.created_at,
      updatedAt: entry.updated_at,
    }
  })
}

export const boardSummary = (board: BoardRow, version: number, graph: BoardGraph): BoardSummary => ({
  slug: board.slug,
  name: { fa: board.name_fa, en: board.name_en },
  visibility: board.visibility,
  version,
  nodes: graph.nodes.length,
  edges: graph.edges.length,
  groups: graph.groups.length,
  createdAt: board.created_at,
  updatedAt: board.updated_at,
})

export type CreateBoardInput = { slug: string; name: Bi; visibility: BoardVisibility }

/**
 * Creates the board and nothing else. A board with no version yet reads back as
 * an empty graph at version 0 — the honest answer for something that has never
 * been saved, rather than a version 1 nobody wrote.
 */
export function createBoard(input: CreateBoardInput): BoardRow {
  const result = run(
    'INSERT INTO boards (slug, name_fa, name_en, visibility) VALUES (?, ?, ?, ?)',
    input.slug,
    input.name.fa,
    input.name.en,
    input.visibility,
  )
  return row<BoardRow>('SELECT * FROM boards WHERE id = ?', Number(result.lastInsertRowid))!
}

export const currentBoardVersion = (boardId: number): BoardVersionRecord | undefined => {
  const found = row<VersionRow>(
    'SELECT version, note, restored_from, at, graph_json FROM board_versions WHERE board_id = ? ORDER BY version DESC LIMIT 1',
    boardId,
  )
  return found ? toVersion(found) : undefined
}

export const boardVersion = (boardId: number, version: number): BoardVersionRecord | undefined => {
  const found = row<VersionRow>(
    'SELECT version, note, restored_from, at, graph_json FROM board_versions WHERE board_id = ? AND version = ?',
    boardId,
    version,
  )
  return found ? toVersion(found) : undefined
}

/** The history, newest first, without the graphs — that list would be enormous. */
export function listBoardVersions(boardId: number): BoardVersionEntry[] {
  return rows<VersionRow>(
    'SELECT version, note, restored_from, at, graph_json FROM board_versions WHERE board_id = ? ORDER BY version DESC',
    boardId,
  ).map((entry) => {
    const { graph: _graph, ...summary } = toVersion(entry)
    return summary
  })
}

/**
 * Appends one version. The number is the caller's — `nextVersion` in
 * `server/domain/board.ts` owns that rule — and the unique index on
 * (board_id, version) is what makes a wrong one fail loudly instead of
 * overwriting history. `restoredFrom` is the version this graph was copied
 * from, as a number rather than a sentence: the server writes no prose (rule 11).
 */
export function addBoardVersion(
  boardId: number,
  version: number,
  graph: BoardGraph,
  note: string | null,
  restoredFrom: number | null,
): BoardVersionRecord {
  const result = run(
    `INSERT INTO board_versions (board_id, version, graph_json, note, restored_from)
     VALUES (?, ?, ?, ?, ?)`,
    boardId,
    version,
    JSON.stringify(graph),
    note,
    restoredFrom,
  )
  run("UPDATE boards SET updated_at = datetime('now') WHERE id = ?", boardId)

  const written = row<VersionRow>(
    'SELECT version, note, restored_from, at, graph_json FROM board_versions WHERE id = ?',
    Number(result.lastInsertRowid),
  )!
  return toVersion(written)
}

/** Retention: everything older than the cutoff goes. Returns how many rows went. */
export function dropBoardVersionsBelow(boardId: number, cutoff: number): number {
  const result = run('DELETE FROM board_versions WHERE board_id = ? AND version < ?', boardId, cutoff)
  return Number(result.changes ?? 0)
}

/** Rename and re-visibility. The slug is not here: a shared URL does not move. */
export function updateBoard(id: number, patch: { name?: Bi; visibility?: BoardVisibility }): BoardRow {
  if (patch.name) {
    run('UPDATE boards SET name_fa = ?, name_en = ? WHERE id = ?', patch.name.fa, patch.name.en, id)
  }
  if (patch.visibility) run('UPDATE boards SET visibility = ? WHERE id = ?', patch.visibility, id)
  run("UPDATE boards SET updated_at = datetime('now') WHERE id = ?", id)
  return row<BoardRow>('SELECT * FROM boards WHERE id = ?', id)!
}

/** The versions go with it, by the cascade the schema declares. */
export function deleteBoard(id: number): boolean {
  return Number(run('DELETE FROM boards WHERE id = ?', id).changes ?? 0) > 0
}
