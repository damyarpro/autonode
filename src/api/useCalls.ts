import { useCallback, useEffect, useState } from 'react'
import { ApiError, getJson, postJson, type ApiLead } from './client'

/**
 * The call desk: the brief, the calendar, the log and the due-work pass.
 *
 * The server's shapes are restated here rather than imported — the app build
 * only sees `src/` and `shared/`, and none of this is a contract both halves
 * share, so it stays a local mirror of `server/routes/calls.ts`.
 */

export type CallObjection = { objection: string; answer: string }

/** Written per lead, from that lead's own event log. Content, not chrome: it
 *  arrives in one language and is rendered raw, like a message body. */
export type CallBrief = {
  opening: string
  objections: CallObjection[]
  ask: string
  producedBy: 'claude' | 'template'
}

export type CallRecord = {
  id: number
  lead_id: number
  provider: string
  status: string
  external_id: string | null
  produced_by: string
  at: string
  brief: CallBrief
}

export type Booking = {
  id: number
  lead_id: number
  /** UTC ISO — an instant, not a wall-clock reading. */
  start_at: string
  minutes: number
  status: string
  note: string | null
  created_at: string
}

export type CallSlot = { start: string; end: string }

/** The owner's bookable day: minutes from local midnight, plus the offset that
 *  turns them back into instants. Rendering a slot without this would guess. */
export type WorkingHours = {
  start: number
  end: number
  offsetMinutes: number
  /** Local weekdays that accept meetings, 0 = Sunday … 6 = Saturday. */
  days: number[]
}

export type CallCounts = { calls: number; meetings: number; referralAsks: number }

export type PreparedCall = {
  brief: CallBrief
  call: CallRecord
  /** The voice adapter that handled it — `brief-only` when nothing dials. */
  adapter: string
  /** False when the brief is prepared and the owner dials it themselves. */
  live: boolean
}

export type BookedMeeting = { booking: Booking; reminders: string[] }
export type DueWork = { reminders: number; referrals: number }

/**
 * Why an action failed. `messages` are the server's `field:code` strings, which
 * the page turns into sentences — the server never writes user-facing prose.
 */
export type CallsFailure = {
  kind: 'validation' | 'unavailable' | 'not_found' | 'offline' | 'server'
  messages: string[]
}

export type CallsState = {
  leads: ApiLead[]
  calls: CallRecord[]
  bookings: Booking[]
  counts: CallCounts
  /** Null until the API has said which voice adapter is selected. */
  adapter: string | null
  slots: CallSlot[]
  /** Null until the API has answered; never assumed. */
  slotMinutes: number | null
  hours: WorkingHours | null
  online: boolean
  loading: boolean
  preparing: boolean
  booking: boolean
  running: boolean
  prepared: PreparedCall | null
  lastBooking: BookedMeeting | null
  lastRun: DueWork | null
  error: CallsFailure | null
  prepare: (leadId: number) => Promise<boolean>
  book: (leadId: number, slotStart: string) => Promise<boolean>
  runDue: () => Promise<boolean>
  refresh: () => Promise<void>
  clearError: () => void
}

type SlotsResponse = { slots: CallSlot[]; slotMinutes: number; hours: WorkingHours }
type CallsResponse = { calls: CallRecord[]; bookings: Booking[]; counts: CallCounts; adapter: string }

const EMPTY_COUNTS: CallCounts = { calls: 0, meetings: 0, referralAsks: 0 }

/** How far ahead the slot list looks. The route caps it either way. */
const SLOT_DAYS = 7
const POLL_MS = 20_000

function failureOf(cause: unknown): CallsFailure {
  if (!(cause instanceof ApiError)) return { kind: 'offline', messages: [] }
  if (cause.status === 400) return { kind: 'validation', messages: cause.messages }
  // A 404 carries no `errors` array, so the code the page explains is made here.
  if (cause.status === 404) return { kind: 'not_found', messages: ['leadId:unknown_lead'] }
  if (cause.status === 409) return { kind: 'unavailable', messages: cause.messages }
  return { kind: 'server', messages: cause.messages }
}

/**
 * Everything the call desk reads and does, for one selected lead. An
 * unreachable API leaves the lists empty and flips `online`, so the page
 * renders a calm empty state instead of throwing (rule 8).
 */
export function useCalls(leadId: number | null): CallsState {
  const [leads, setLeads] = useState<ApiLead[]>([])
  const [calls, setCalls] = useState<CallRecord[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [counts, setCounts] = useState<CallCounts>(EMPTY_COUNTS)
  const [adapter, setAdapter] = useState<string | null>(null)
  const [slots, setSlots] = useState<CallSlot[]>([])
  const [slotMinutes, setSlotMinutes] = useState<number | null>(null)
  const [hours, setHours] = useState<WorkingHours | null>(null)
  const [online, setOnline] = useState(true)
  const [loading, setLoading] = useState(true)
  const [preparing, setPreparing] = useState(false)
  const [booking, setBooking] = useState(false)
  const [running, setRunning] = useState(false)
  const [prepared, setPrepared] = useState<PreparedCall | null>(null)
  const [lastBooking, setLastBooking] = useState<BookedMeeting | null>(null)
  const [lastRun, setLastRun] = useState<DueWork | null>(null)
  const [error, setError] = useState<CallsFailure | null>(null)

  const loadLeads = useCallback(async () => {
    const data = await getJson<{ leads: ApiLead[] }>('/api/leads')
    setLeads(data.leads)
  }, [])

  const loadCalls = useCallback(async () => {
    const query = leadId === null ? '' : `?leadId=${leadId}`
    const data = await getJson<CallsResponse>(`/api/calls${query}`)
    setCalls(data.calls)
    setBookings(data.bookings)
    setCounts(data.counts)
    setAdapter(data.adapter)
  }, [leadId])

  const loadSlots = useCallback(async () => {
    const data = await getJson<SlotsResponse>(`/api/calls/slots?days=${SLOT_DAYS}`)
    setSlots(data.slots)
    setSlotMinutes(data.slotMinutes)
    setHours(data.hours)
  }, [])

  const refresh = useCallback(async () => {
    try {
      await Promise.all([loadLeads(), loadCalls(), loadSlots()])
      setOnline(true)
    } catch {
      setOnline(false)
    } finally {
      setLoading(false)
    }
  }, [loadCalls, loadLeads, loadSlots])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), POLL_MS)
    return () => window.clearInterval(timer)
  }, [refresh])

  // A brief and a booking belong to the lead they were made for, so switching
  // lead clears them rather than showing one lead's work under another's name.
  useEffect(() => {
    setPrepared(null)
    setLastBooking(null)
    setError(null)
  }, [leadId])

  const fail = useCallback((cause: unknown) => {
    const failure = failureOf(cause)
    setError(failure)
    if (failure.kind === 'offline') setOnline(false)
    return failure
  }, [])

  const prepare = useCallback(
    async (id: number) => {
      setPreparing(true)
      setError(null)
      try {
        const data = await postJson<PreparedCall>(`/api/calls/${id}/prepare`)
        setPrepared(data)
        setAdapter(data.adapter)
        setOnline(true)
        // The call is now in the log, so the list below should show it.
        await loadCalls().catch(() => setOnline(false))
        return true
      } catch (cause) {
        fail(cause)
        return false
      } finally {
        setPreparing(false)
      }
    },
    [fail, loadCalls],
  )

  const book = useCallback(
    async (id: number, slotStart: string) => {
      setBooking(true)
      setError(null)
      try {
        const data = await postJson<BookedMeeting>(`/api/calls/${id}/book`, { slotStart })
        setLastBooking(data)
        setOnline(true)
        await Promise.all([loadSlots(), loadCalls(), loadLeads()]).catch(() => setOnline(false))
        return true
      } catch (cause) {
        const failure = fail(cause)
        // A slot is usually refused because someone else took it, which means
        // the list the owner is looking at is already out of date.
        if (failure.kind === 'unavailable') await loadSlots().catch(() => setOnline(false))
        return false
      } finally {
        setBooking(false)
      }
    },
    [fail, loadCalls, loadLeads, loadSlots],
  )

  const runDue = useCallback(async () => {
    setRunning(true)
    setError(null)
    try {
      const data = await postJson<DueWork>('/api/calls/run-due')
      setLastRun(data)
      setOnline(true)
      await loadCalls().catch(() => setOnline(false))
      return true
    } catch (cause) {
      fail(cause)
      return false
    } finally {
      setRunning(false)
    }
  }, [fail, loadCalls])

  const clearError = useCallback(() => setError(null), [])

  return {
    leads,
    calls,
    bookings,
    counts,
    adapter,
    slots,
    slotMinutes,
    hours,
    online,
    loading,
    preparing,
    booking,
    running,
    prepared,
    lastBooking,
    lastRun,
    error,
    prepare,
    book,
    runDue,
    refresh,
    clearError,
  }
}
