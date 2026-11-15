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
import { resetCompanionSessionPreferences } from '@/support-plan-companion/companion-session'

export type SessionStatus =
  'restoring' | 'authenticated' | 'unauthenticated' | 'unavailable'

type SessionContextValue = Readonly<{
  session: AppSession | null
  sessionGeneration?: number
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
  requestPasswordRecovery(email: string): Promise<void>
  resetPassword(challenge: string, newPassword: string): Promise<void>
  changePassword(currentPassword: string, newPassword: string): Promise<void>
}>

const SessionContext = createContext<SessionContextValue | null>(null)
const REFRESH_EARLY_MS = 60_000

export function SessionProvider({
  children,
  service,
  initialSession,
  initialAccessExpiresAt,
}: Readonly<{
  children: ReactNode
  service: SessionService
  initialSession?: AppSession | null
  initialAccessExpiresAt?: string | null
}>) {
  const queryClient = useQueryClient()
  const [session, setSession] = useState<AppSession | null>(
    initialSession ?? null,
  )
  const [sessionGeneration, setSessionGeneration] = useState(0)
  const [status, setStatus] = useState<SessionStatus>(
    initialSession ? 'authenticated' : 'restoring',
  )
  const [notice, setNotice] = useState<string | null>(null)
  const accessExpiresAt = useRef<string | null>(initialAccessExpiresAt ?? null)
  const generationRef = useRef(0)

  const advanceGeneration = useCallback(() => {
    const next = generationRef.current + 1
    generationRef.current = next
    setSessionGeneration(next)
    return next
  }, [])

  const applyNewSession = useCallback(
    (value: AuthenticatedSession) => {
      advanceGeneration()
      resetCompanionSessionPreferences()
      queryClient.clear()
      accessExpiresAt.current = value.accessExpiresAt
      setSession(value.session)
      setStatus('authenticated')
    },
    [advanceGeneration, queryClient],
  )

  const applyUnauthenticated = useCallback(() => {
    accessExpiresAt.current = null
    resetCompanionSessionPreferences()
    queryClient.clear()
    setSession(null)
    setStatus('unauthenticated')
  }, [queryClient])

  const retryRestore = useCallback(async () => {
    const restoreGeneration = advanceGeneration()
    setSession(null)
    setStatus('restoring')
    try {
      const restored = await service.restore()
      if (generationRef.current !== restoreGeneration) return
      if (restored) applyNewSession(restored)
      else applyUnauthenticated()
    } catch {
      if (generationRef.current !== restoreGeneration) return
      setSession(null)
      setStatus('unavailable')
    }
  }, [advanceGeneration, applyNewSession, applyUnauthenticated, service])

  useEffect(() => {
    if (initialSession) return
    const timer = setTimeout(() => void retryRestore(), 0)
    return () => clearTimeout(timer)
  }, [initialSession, retryRestore])

  useEffect(() => {
    if (status !== 'authenticated' || !session || !accessExpiresAt.current) {
      return
    }

    const expectedGeneration = generationRef.current
    const expectedSubject = session.subject
    const expectedRole = session.role
    const delay = Math.max(
      0,
      Date.parse(accessExpiresAt.current) - Date.now() - REFRESH_EARLY_MS,
    )
    const timer = setTimeout(() => {
      void service
        .refresh()
        .then((refreshed) => {
          if (generationRef.current !== expectedGeneration) return
          if (refreshed) {
            if (
              refreshed.session.subject === expectedSubject &&
              refreshed.session.role === expectedRole
            ) {
              accessExpiresAt.current = refreshed.accessExpiresAt
              setSession(refreshed.session)
              setStatus('authenticated')
            } else {
              applyNewSession(refreshed)
            }
          } else {
            advanceGeneration()
            applyUnauthenticated()
          }
        })
        .catch(() => {
          if (generationRef.current !== expectedGeneration) return
          advanceGeneration()
          setSession(null)
          setStatus('unavailable')
        })
    }, delay)

    return () => clearTimeout(timer)
  }, [
    advanceGeneration,
    applyNewSession,
    applyUnauthenticated,
    service,
    session,
    status,
  ])

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      sessionGeneration,
      status,
      notice,
      async signIn(email, password) {
        setNotice(null)
        const authenticated = await service.signIn(email, password)
        applyNewSession(authenticated)
      },
      async signOut() {
        const logoutGeneration = advanceGeneration()
        setNotice(null)
        applyUnauthenticated()
        try {
          await service.logout()
        } catch {
          if (generationRef.current === logoutGeneration) {
            setNotice(
              'Phiên đã được xóa khỏi thiết bị nhưng chưa thể xác nhận thu hồi trên máy chủ.',
            )
          }
        }
      },
      retryRestore,
      registerUser: (email, password, idempotencyKey) =>
        service.registerUser(email, password, idempotencyKey),
      verifyEmail: (challenge) => service.verifyEmail(challenge),
      requestEmailVerification: (email) =>
        service.requestEmailVerification(email),
      requestPasswordRecovery: (email) =>
        service.requestPasswordRecovery(email),
      resetPassword: (challenge, newPassword) =>
        service.resetPassword(challenge, newPassword),
      async changePassword(currentPassword, newPassword) {
        await service.changePassword(currentPassword, newPassword)
        advanceGeneration()
        setNotice(null)
        applyUnauthenticated()
      },
    }),
    [
      advanceGeneration,
      applyNewSession,
      applyUnauthenticated,
      notice,
      retryRestore,
      service,
      session,
      sessionGeneration,
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
