import { createContext, useContext } from 'react'
import type { TeamsSession } from '../services/teams.ts'

export const SessionContext = createContext<TeamsSession | null>(null)

export const useSession = (): TeamsSession => {
  const session = useContext(SessionContext)
  if (!session) {
    throw new Error('useSession must be used inside SessionProvider')
  }
  return session
}
