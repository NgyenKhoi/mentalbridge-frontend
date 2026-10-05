import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from 'react'

import type { AppSession } from './session'

type SessionContextValue = Readonly<{
  session: AppSession | null
  setSession: (session: AppSession | null) => void
}>

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({
  children,
  initialSession = null,
}: Readonly<{
  children: ReactNode
  initialSession?: AppSession | null
}>) {
  const [session, setSession] = useState<AppSession | null>(initialSession)
  const value = useMemo(() => ({ session, setSession }), [session])

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)

  if (!value) {
    throw new Error('SessionProvider is missing')
  }

  return value
}
