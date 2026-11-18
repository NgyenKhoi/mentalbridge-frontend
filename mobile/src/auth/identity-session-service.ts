import { ApiError } from '@/api/api-error'
import type {
  CredentialStore,
  StoredCredentials,
} from '@/security/credential-store'

import type { IdentityApi } from './identity-api'
import type { AccountDetail, TokenPair } from './identity-contract'
import type { AppSession } from './session'

const ACCESS_EXPIRY_SKEW_MS = 60_000

export type AuthenticatedSession = Readonly<{
  session: AppSession
  accessExpiresAt: string
}>

export interface SessionService {
  signIn(email: string, password: string): Promise<AuthenticatedSession>
  restore(): Promise<AuthenticatedSession | null>
  refresh(): Promise<AuthenticatedSession | null>
  logout(): Promise<void>
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
}

type SessionServiceOptions = Readonly<{
  api: IdentityApi
  credentials: CredentialStore
  createIdempotencyKey: () => string
  now?: () => number
}>

function invalidSession(message: string) {
  return new ApiError({ code: 'INVALID_SESSION_ACCOUNT', message, status: 401 })
}

function acceptedMobileSession(account: AccountDetail): AppSession {
  const role = account.roles[0]
  if (
    account.status !== 'ACTIVE' ||
    !account.emailVerified ||
    account.roles.length !== 1 ||
    (role !== 'USER' && role !== 'SPECIALIST')
  ) {
    throw invalidSession(
      'Identity did not return an active supported mobile account.',
    )
  }

  return { role, subject: account.accountId }
}

function isRejectedCredential(error: unknown) {
  return (
    error instanceof ApiError &&
    (error.status === 401 || error.code === 'INVALID_SESSION')
  )
}

function isRejectedAccount(error: unknown) {
  return error instanceof ApiError && error.code === 'INVALID_SESSION_ACCOUNT'
}

export function createSessionService({
  api,
  credentials,
  createIdempotencyKey,
  now = Date.now,
}: SessionServiceOptions): SessionService {
  let pendingRotation: { token: string; key: string } | undefined
  let sessionQueue: Promise<unknown> = Promise.resolve()

  function serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = sessionQueue.then(operation)
    sessionQueue = result.catch(() => undefined)
    return result
  }

  async function persistTokenPair(pair: TokenPair): Promise<StoredCredentials> {
    const stored = {
      accessToken: pair.accessToken,
      accessExpiresAt: new Date(now() + pair.expiresIn * 1000).toISOString(),
      refreshToken: pair.refreshToken,
      refreshExpiresAt: pair.refreshExpiresAt,
    }
    await credentials.setCredentials(stored)
    return stored
  }

  async function resolveAccount(
    stored: StoredCredentials,
  ): Promise<AuthenticatedSession> {
    const account = await api.getCurrentAccount()
    return {
      session: acceptedMobileSession(account),
      accessExpiresAt: stored.accessExpiresAt,
    }
  }

  async function rotate(
    stored: StoredCredentials,
  ): Promise<AuthenticatedSession | null> {
    if (Date.parse(stored.refreshExpiresAt) <= now()) {
      pendingRotation = undefined
      await credentials.clear()
      return null
    }

    try {
      if (pendingRotation?.token !== stored.refreshToken) {
        pendingRotation = {
          token: stored.refreshToken,
          key: createIdempotencyKey(),
        }
      }
      const pair = await api.refresh(stored.refreshToken, pendingRotation.key)
      const rotated = await persistTokenPair(pair)
      pendingRotation = undefined
      try {
        return await resolveAccount(rotated)
      } catch (error) {
        if (isRejectedAccount(error)) {
          await api.logout(rotated.refreshToken).catch(() => undefined)
          await credentials.clear()
          return null
        }
        throw error
      }
    } catch (error) {
      if (isRejectedCredential(error)) {
        pendingRotation = undefined
        await credentials.clear()
        return null
      }
      throw error
    }
  }

  const operations: SessionService = {
    async signIn(email, password) {
      pendingRotation = undefined
      const pair = await api.login({ email, password })
      const stored = await persistTokenPair(pair)

      try {
        return await resolveAccount(stored)
      } catch (error) {
        await api.logout(pair.refreshToken).catch(() => undefined)
        await credentials.clear()
        throw error
      }
    },
    async restore() {
      const stored = await credentials.getCredentials()
      if (!stored) {
        await credentials.clear()
        return null
      }

      if (Date.parse(stored.accessExpiresAt) - ACCESS_EXPIRY_SKEW_MS <= now()) {
        return rotate(stored)
      }

      try {
        return await resolveAccount(stored)
      } catch (error) {
        if (isRejectedAccount(error)) {
          await api.logout(stored.refreshToken).catch(() => undefined)
          await credentials.clear()
          return null
        }
        if (isRejectedCredential(error)) return rotate(stored)
        throw error
      }
    },
    async refresh() {
      const stored = await credentials.getCredentials()
      if (!stored) {
        await credentials.clear()
        return null
      }
      return rotate(stored)
    },
    async logout() {
      pendingRotation = undefined
      const stored = await credentials.getCredentials()
      try {
        if (stored) await api.logout(stored.refreshToken)
      } finally {
        await credentials.clear()
      }
    },
    async registerUser(email, password, idempotencyKey) {
      await api.registerUser(
        { actorType: 'USER', email, password },
        idempotencyKey,
      )
    },
    verifyEmail(challenge) {
      return api.verifyEmail(challenge)
    },
    requestEmailVerification(email) {
      return api.requestEmailVerification(email)
    },
    requestPasswordRecovery(email) {
      return api.requestPasswordRecovery(email)
    },
    resetPassword(challenge, newPassword) {
      return api.resetPassword({ challenge, newPassword })
    },
    async changePassword(currentPassword, newPassword) {
      pendingRotation = undefined
      await api.changePassword({ currentPassword, newPassword })
      await credentials.clear()
    },
  }
  return {
    ...operations,
    signIn: (email, password) =>
      serialize(() => operations.signIn(email, password)),
    restore: () => serialize(operations.restore),
    refresh: () => serialize(operations.refresh),
    logout: () => serialize(operations.logout),
    changePassword: (current, next) =>
      serialize(() => operations.changePassword(current, next)),
  }
}
