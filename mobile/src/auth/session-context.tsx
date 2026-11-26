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
import { AppState } from 'react-native'
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
const REFRESH_RETRY_MS = 15_000

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
  const [accessExpiresAt, setAccessExpiresAt] = useState<string | null>(null)
  const operationVersion = useRef(0)
  const restoreInFlight = useRef<Promise<void> | null>(null)

  const applyAuthenticated = useCallback((value: AuthenticatedSession) => {
    setAccessExpiresAt(value.accessExpiresAt)
    setSession(value.session)
    setStatus('authenticated')
  }, [])

  const applyUnauthenticated = useCallback(() => {
    setAccessExpiresAt(null)
    resetCompanionSessionPreferences()
    queryClient.clear()
    setSession(null)
    setStatus('unauthenticated')
  }, [queryClient])

  const retryRestore = useCallback(() => {
    if (restoreInFlight.current) return restoreInFlight.current
    const version = operationVersion.current
    const operation = service
      .restore()
      .then((restored) => {
        if (version !== operationVersion.current) return
        if (restored) applyAuthenticated(restored)
        else applyUnauthenticated()
      })
      .catch(() => {
        if (version !== operationVersion.current) return
        setSession(null)
        setStatus('unavailable')
      })
      .finally(() => {
        if (restoreInFlight.current === operation)
          restoreInFlight.current = null
      })
    restoreInFlight.current = operation
    return operation
  }, [applyAuthenticated, applyUnauthenticated, service])

  useEffect(() => {
    if (initialSession) return
    const timer = setTimeout(() => void retryRestore(), 0)
    return () => clearTimeout(timer)
  }, [initialSession, retryRestore])

  useEffect(() => {
    if (status !== 'authenticated' && status !== 'unavailable') return
    if (status === 'authenticated' && !accessExpiresAt) return

    const expiresAt = accessExpiresAt ? Date.parse(accessExpiresAt) : 0
    const version = operationVersion.current
    let timer: ReturnType<typeof setTimeout> | undefined
    let inFlight = false
    let disposed = false

    function schedule(delay: number) {
      clearTimeout(timer)
      timer = setTimeout(attempt, delay)
    }

    async function attempt() {
      if (
        disposed ||
        inFlight ||
        version !== operationVersion.current ||
        AppState.currentState === 'background' ||
        AppState.currentState === 'inactive'
      )
        return
      inFlight = true
      try {
        if (status === 'unavailable') {
          await retryRestore()
          if (!disposed) schedule(REFRESH_RETRY_MS)
          return
        }
        const restored = await service.restore()
        if (disposed || version !== operationVersion.current) return
        if (restored) applyAuthenticated(restored)
        else applyUnauthenticated()
      } catch {
        if (disposed || version !== operationVersion.current) return
        if (Date.now() >= expiresAt) {
          setSession(null)
          setStatus('unavailable')
        } else {
          schedule(Math.min(REFRESH_RETRY_MS, expiresAt - Date.now()))
        }
      } finally {
        inFlight = false
      }
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (
        state === 'active' &&
        (status === 'unavailable' || Date.now() >= expiresAt - REFRESH_EARLY_MS)
      ) {
        void attempt()
      }
    })
    schedule(
      status === 'unavailable'
        ? REFRESH_RETRY_MS
        : Math.max(0, expiresAt - Date.now() - REFRESH_EARLY_MS),
    )
    return () => {
      disposed = true
      clearTimeout(timer)
      subscription.remove()
    }
  }, [
    accessExpiresAt,
    applyAuthenticated,
    applyUnauthenticated,
    retryRestore,
    service,
    status,
  ])

  const value = useMemo<SessionContextValue>(
    () => ({
      session,
      status,
      notice,
      async signIn(email, password) {
        setNotice(null)
        const version = ++operationVersion.current
        const authenticated = await service.signIn(email, password)
        if (version === operationVersion.current)
          applyAuthenticated(authenticated)
      },
      async signOut() {
        const version = ++operationVersion.current
        try {
          await service.logout()
          setNotice(null)
        } catch {
          setNotice(
            'Phiên đã được xóa khỏi thiết bị nhưng chưa thể xác nhận thu hồi trên máy chủ.',
          )
        } finally {
          if (version === operationVersion.current) applyUnauthenticated()
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
        operationVersion.current += 1
        setNotice(null)
        applyUnauthenticated()
      },
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
