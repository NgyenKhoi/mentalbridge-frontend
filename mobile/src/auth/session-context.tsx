import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'

import type {
  AuthenticatedSession,
  SessionService,
} from './identity-session-service'
import type { AppSession } from './session'

export type SessionStatus =
  'restoring' | 'authenticated' | 'unauthenticated' | 'unavailable'

type SessionContextValue = Readonly<{
  session: AppSession | null
  status: SessionStatus
  notice: string | null
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  retryRestore(): Promise<void>
  registerUser(
    email: string,
    password: string,
    idempotencyKey: string,
  ): Promise<void>
  verifyEmail(challenge: string): Promise<void>
  requestEmailVerification(email: string): Promise<void>
}>

const SessionContext = createContext<SessionContextValue | null>(null)
const REFRESH_EARLY_MS = 60_000

export function SessionProvider({
  children,
  service,
  initialSession,
}: Readonly<{
  children: ReactNode
  service: SessionService
  initialSession?: AppSession | null
}>) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<AppSession | null>(
    initialSession ?? null,
  )
  const [status, setStatus] = useState<SessionStatus>(
    initialSession ? 'authenticated' : 'restoring',
  )
  const [notice, setNotice] = useState<string | null>(null)
  const accessExpiresAt = useRef<string | null>(null)

  const applyAuthenticated = useCallback((value: AuthenticatedSession) => {
    accessExpiresAt.current = value.accessExpiresAt
    setSession(value.session)
    setStatus('authenticated')
  }, [])

  const applyUnauthenticated = useCallback(() => {
    accessExpiresAt.current = null
    queryClient.clear()
    setSession(null)
    setStatus('unauthenticated')
  }, [queryClient])

  const retryRestore = useCallback(async () => {
    setSession(null)
    setStatus('restoring')
    try {
      const restored = await service.restore()
      if (restored) applyAuthenticated(restored)
      else applyUnauthenticated()
    } catch {
      setSession(null)
      setStatus('unavailable')
    }
  }, [applyAuthenticated, applyUnauthenticated, service])

  useEffect(() => {
    if (initialSession) return
    const timer = setTimeout(() => void retryRestore(), 0)
    return () => clearTimeout(timer)
  }, [initialSession, retryRestore])

  useEffect(() => {
    if (status !== 'authenticated' || !accessExpiresAt.current) return

    const delay = Math.max(
      0,
      Date.parse(accessExpiresAt.current) - Date.now() - REFRESH_EARLY_MS,
    )
    const timer = setTimeout(() => {
      void service
        .refresh()
        .then((refreshed) => {
          if (refreshed) applyAuthenticated(refreshed)
          else applyUnauthenticated()
        })
        .catch(() => {
          setSession(null)
          setStatus('unavailable')
        })
    }, delay)

    return () => clearTimeout(timer)
  }, [applyAuthenticated, applyUnauthenticated, service, session, status])

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      status,
      notice,
      async signIn(email, password) {
        setNotice(null)
        const authenticated = await service.signIn(email, password)
        applyAuthenticated(authenticated)
      },
      async signOut() {
        try {
          await service.logout()
          setNotice(null)
        } catch {
          setNotice(
            'Phiên đã được xóa khỏi thiết bị nhưng chưa thể xác nhận thu hồi trên máy chủ.',
          )
        } finally {
          applyUnauthenticated()
        }
      },
      retryRestore,
      registerUser: (email, password, idempotencyKey) =>
        service.registerUser(email, password, idempotencyKey),
      verifyEmail: (challenge) => service.verifyEmail(challenge),
      requestEmailVerification: (email) =>
        service.requestEmailVerification(email),
    }),
    [
      applyAuthenticated,
      applyUnauthenticated,
      notice,
      retryRestore,
      service,
      session,
      status,
    ],
  )

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext)

  if (!value) throw new Error('SessionProvider is missing')
  return value
}
