import { useCallback, useEffect, useState } from 'react'
import {
  BUSINESS_CHANNELS,
  BUSINESS_LIMITS,
  TONES,
  emptyBusiness,
  type BusinessChannel,
  type BusinessProfile,
  type Tone,
} from '../../shared/business'
import { ApiError, getJson, patchJson } from './client'

// The contract itself lives in shared/, next to the server that stores it.
// Re-exported so the form has one import for the shape and its hook.
export { BUSINESS_CHANNELS, BUSINESS_LIMITS, emptyBusiness }
export type { BusinessChannel, BusinessProfile }

// The names the form already uses for the tone list.
export const BUSINESS_TONES = TONES
export type BusinessTone = Tone

/**
 * Why a save failed. `messages` are the server's `field:code` strings, which the
 * page turns into sentences — the server never writes user-facing prose.
 */
export type BusinessFailure = {
  kind: 'validation' | 'offline' | 'server'
  messages: string[]
}

export type BusinessState = {
  business: BusinessProfile
  /** `field:required` codes for the fields the stored profile still lacks. */
  missing: string[]
  loading: boolean
  saving: boolean
  /** `Date.now()` of the last accepted save, for the transient "saved" line. */
  savedAt: number | null
  online: boolean
  error: BusinessFailure | null
  save: (patch: Partial<BusinessProfile>) => Promise<boolean>
  refresh: () => Promise<void>
  clearError: () => void
}

type BusinessResponse = { business: BusinessProfile; missing: string[] }

function failureOf(cause: unknown): BusinessFailure {
  if (!(cause instanceof ApiError)) return { kind: 'offline', messages: [] }
  if (cause.status === 400) return { kind: 'validation', messages: cause.messages }
  return { kind: 'server', messages: cause.messages }
}

/**
 * The business profile and its save action. An unreachable API leaves an empty
 * profile behind and flips `online`, so the page renders a blank form instead
 * of throwing.
 */
export function useBusiness(): BusinessState {
  const [business, setBusiness] = useState<BusinessProfile>(emptyBusiness)
  const [missing, setMissing] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [online, setOnline] = useState(true)
  const [error, setError] = useState<BusinessFailure | null>(null)

  const refresh = useCallback(async () => {
    try {
      const data = await getJson<BusinessResponse>('/api/business')
      setBusiness(data.business)
      setMissing(data.missing)
      setOnline(true)
    } catch {
      setOnline(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const save = useCallback(async (patch: Partial<BusinessProfile>) => {
    setSaving(true)
    setError(null)
    try {
      const data = await patchJson<BusinessResponse>('/api/business', patch)
      setBusiness(data.business)
      setMissing(data.missing)
      setOnline(true)
      setSavedAt(Date.now())
      return true
    } catch (cause) {
      const failure = failureOf(cause)
      setError(failure)
      if (failure.kind === 'offline') setOnline(false)
      return false
    } finally {
      setSaving(false)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])

  return { business, missing, loading, saving, savedAt, online, error, save, refresh, clearError }
}
