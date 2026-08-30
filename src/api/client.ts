/** Same-origin in dev via the Vite proxy; override for a split deployment. */
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export const apiUrl = (path: string) => `${BASE}${path}`

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  })
  if (!response.ok) throw new Error(`${init?.method ?? 'GET'} ${path} → ${response.status}`)
  return (await response.json()) as T
}

export const getJson = <T,>(path: string) => json<T>(path)
export const postJson = <T,>(path: string, body?: unknown) =>
  json<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) })
export const patchJson = <T,>(path: string, body: unknown) =>
  json<T>(path, { method: 'PATCH', body: JSON.stringify(body) })
export const deleteJson = <T,>(path: string) => json<T>(path, { method: 'DELETE' })

export type AppProfile = {
  displayName: string
  fullName: string | null
  phone: string | null
  headline: string
  plan: string
  planExpires: string | null
  points: number
  bot: { id: string; username: string | null } | null
  level: number
}

export type Progress = {
  levels: { levelId: number; stagesDone: number; stages: number }[]
  totalStages: number
  stagesDone: number
  percent: number
  currentLevel: number
}

export type CoachMessage = { id: number; role: 'user' | 'assistant'; content: string; at: string }

export type ApiLead = {
  id: number
  source: string
  external_id: string | null
  handle: string | null
  name: string | null
  locale: string
  score: number
  route: 'hot' | 'warm' | 'cold'
  stage: string
  value_toman: number
  created_at: string
  updated_at: string
}

export type ApiEvent = { id: number; lead_id: number; type: string; payload_json: string | null; at: string }
export type ApiMessage = {
  id: number
  lead_id: number
  channel: string
  direction: 'in' | 'out'
  body: string
  status: string
  at: string
}
export type ApiConversation = ApiLead & { last_body: string; last_at: string; unread: number }

export type StreamEvent = {
  type: string
  leadId?: number
  edgeId?: string
  nodeId?: string
  at: string
}
