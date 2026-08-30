import { createContext, useContext, type ReactNode } from 'react'
import { useSession, type Session } from './useSession'

/**
 * One session for the whole app. The gate in `App.tsx` and the sign-out button
 * on the profile page have to agree about who is signed in — two independent
 * `useSession()` calls would not, and signing out in one would leave the other
 * still showing the app.
 */
const SessionContext = createContext<Session | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const session = useSession()
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}

export function useSessionContext(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('useSessionContext must be used inside <SessionProvider>')
  return session
}
