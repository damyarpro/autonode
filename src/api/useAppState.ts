import { useCallback, useEffect, useState } from 'react'
import { getJson, type AppProfile, type Progress } from './client'

export type AppState = {
  profile: AppProfile | null
  progress: Progress | null
  online: boolean
  loading: boolean
  refresh: () => Promise<void>
}

/**
 * Profile and learning-path progress, both served by the API. When it is
 * unreachable the pages fall back to their empty state rather than breaking.
 */
export function useAppState(): AppState {
  const [profile, setProfile] = useState<AppProfile | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [online, setOnline] = useState(true)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const [profileResponse, progressResponse] = await Promise.all([
        getJson<{ profile: AppProfile }>('/api/profile'),
        getJson<Progress>('/api/progress'),
      ])
      setProfile(profileResponse.profile)
      setProgress(progressResponse)
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

  return { profile, progress, online, loading, refresh }
}
