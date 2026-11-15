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
const BEFORE_SIGN_OUT_TIMEOUT_MS = 3_000

// Best effort and bounded: a slow or failing hook never blocks sign-out.
async function runBeforeSignOut(hook: (() => Promise<void>) | undefined) {
  if (!hook) return
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      Promise.resolve()
        .then(hook)
        .catch(() => undefined),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, BEFORE_SIGN_OUT_TIMEOUT_MS)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

export function SessionProvider({
  children,
  service,
  initialSession,
  initialAccessExpiresAt,
  beforeSignOut,
}: Readonly<{
  children: ReactNode
  service: SessionService
  initialSession?: AppSession | null
  initialAccessExpiresAt?: string | null
  // Runs while the access token is still valid, e.g. to revoke this phone's push device.
  beforeSignOut?: () => Promise<void>
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
  const lastLogoutGenerationRef = useRef(0)
  const pendingBeforeSignOutRef = useRef<Promise<void> | null>(null)

  const nextGeneration = useCallback(() => {
    const next = generationRef.current + 1
    generationRef.current = next
    return next
  }, [])

  const applyNewSession = useCallback(
    (value: AuthenticatedSession, generation = nextGeneration()) => {
      setSessionGeneration(generation)
      resetCompanionSessionPreferences()
      queryClient.clear()
      accessExpiresAt.current = value.accessExpiresAt
      setSession(value.session)
      setStatus('authenticated')
    },
    [nextGeneration, queryClient],
  )

  const applyUnauthenticated = useCallback(
    (generation = generationRef.current) => {
      setSessionGeneration(generation)
      accessExpiresAt.current = null
      resetCompanionSessionPreferences()
      queryClient.clear()
      setSession(null)
      setStatus('unauthenticated')
    },
    [queryClient],
  )

  const retryRestore = useCallback(async () => {
    const restoreGeneration = nextGeneration()
    setSession(null)
    setStatus('restoring')
    try {
      const restored = await service.restore()
      if (generationRef.current !== restoreGeneration) return
      if (restored) {
        applyNewSession(restored, restoreGeneration)
      } else {
        lastLogoutGenerationRef.current = restoreGeneration
        applyUnauthenticated(restoreGeneration)
      }
    } catch {
      if (generationRef.current !== restoreGeneration) return
      setSession(null)
      setStatus('unavailable')
    }
  }, [applyNewSession, applyUnauthenticated, nextGeneration, service])

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
            const unauthGen = nextGeneration()
            lastLogoutGenerationRef.current = unauthGen
            applyUnauthenticated(unauthGen)
          }
        })
        .catch(() => {
          if (generationRef.current !== expectedGeneration) return
          nextGeneration()
          setSession(null)
          setStatus('unavailable')
        })
    }, delay)

    return () => clearTimeout(timer)
  }, [
    applyNewSession,
    applyUnauthenticated,
    nextGeneration,
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
        const signInGeneration = nextGeneration()
        setNotice(null)
        if (pendingBeforeSignOutRef.current) {
          await pendingBeforeSignOutRef.current
          if (generationRef.current !== signInGeneration) return
        }
        try {
          const authenticated = await service.signIn(email, password)
          if (generationRef.current !== signInGeneration) {
            if (generationRef.current === lastLogoutGenerationRef.current) {
              await service.logout().catch(() => undefined)
            }
            return
          }
          applyNewSession(authenticated, signInGeneration)
        } catch (error) {
          if (generationRef.current !== signInGeneration) {
            return
          }
          throw error
        }
      },
      async signOut() {
        const logoutGeneration = nextGeneration()
        lastLogoutGenerationRef.current = logoutGeneration
        setNotice(null)
        applyUnauthenticated(logoutGeneration)
        if (beforeSignOut) {
          const hookPromise = runBeforeSignOut(beforeSignOut)
          pendingBeforeSignOutRef.current = hookPromise
          try {
            await hookPromise
          } finally {
            if (pendingBeforeSignOutRef.current === hookPromise) {
              pendingBeforeSignOutRef.current = null
            }
          }
        }
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
        const unauthGen = nextGeneration()
        lastLogoutGenerationRef.current = unauthGen
        setNotice(null)
        applyUnauthenticated(unauthGen)
      },
    }),
    [
      applyNewSession,
      applyUnauthenticated,
      beforeSignOut,
      nextGeneration,
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
