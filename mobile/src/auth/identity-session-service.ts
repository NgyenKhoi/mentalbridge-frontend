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
  let authEpoch = 0
  let latestClearEpoch = 0

  async function clearIfCurrent(opEpoch: number) {
    if (opEpoch === authEpoch) {
      await credentials.clear()
    }
  }

  async function persistTokenPair(
    pair: TokenPair,
    opEpoch: number,
  ): Promise<StoredCredentials | null> {
    if (opEpoch !== authEpoch) return null
    const stored = {
      accessToken: pair.accessToken,
      accessExpiresAt: new Date(now() + pair.expiresIn * 1000).toISOString(),
      refreshToken: pair.refreshToken,
      refreshExpiresAt: pair.refreshExpiresAt,
    }
    await credentials.setCredentials(stored)
    if (opEpoch !== authEpoch) {
      if (latestClearEpoch === authEpoch) {
        await credentials.clear()
      }
      return null
    }
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
    opEpoch: number,
  ): Promise<AuthenticatedSession | null> {
    if (Date.parse(stored.refreshExpiresAt) <= now()) {
      await clearIfCurrent(opEpoch)
      return null
    }

    try {
      const pair = await api.refresh(
        stored.refreshToken,
        createIdempotencyKey(),
      )
      const rotated = await persistTokenPair(pair, opEpoch)
      if (!rotated) return null
      try {
        const resolved = await resolveAccount(rotated)
        if (opEpoch !== authEpoch) {
          if (latestClearEpoch === authEpoch) {
            await credentials.clear()
          }
          return null
        }
        return resolved
      } catch (error) {
        if (isRejectedAccount(error)) {
          await api.logout(rotated.refreshToken).catch(() => undefined)
          await clearIfCurrent(opEpoch)
          return null
        }
        throw error
      }
    } catch (error) {
      if (isRejectedCredential(error)) {
        await clearIfCurrent(opEpoch)
        return null
      }
      throw error
    }
  }

  return {
    async signIn(email, password) {
      const opEpoch = ++authEpoch
      const pair = await api.login({ email, password })
      const stored = await persistTokenPair(pair, opEpoch)
      if (!stored) {
        await api.logout(pair.refreshToken).catch(() => undefined)
        throw invalidSession(
          'Sign-in was superseded by another session operation.',
        )
      }

      try {
        const resolved = await resolveAccount(stored)
        if (opEpoch !== authEpoch) {
          await api.logout(pair.refreshToken).catch(() => undefined)
          if (latestClearEpoch === authEpoch) {
            await credentials.clear()
          }
          throw invalidSession(
            'Sign-in was superseded by another session operation.',
          )
        }
        return resolved
      } catch (error) {
        await api.logout(pair.refreshToken).catch(() => undefined)
        await clearIfCurrent(opEpoch)
        throw error
      }
    },
    async restore() {
      const opEpoch = ++authEpoch
      const stored = await credentials.getCredentials()
      if (opEpoch !== authEpoch) return null
      if (!stored) {
        await clearIfCurrent(opEpoch)
        return null
      }

      if (Date.parse(stored.accessExpiresAt) - ACCESS_EXPIRY_SKEW_MS <= now()) {
        return rotate(stored, opEpoch)
      }

      try {
        const resolved = await resolveAccount(stored)
        if (opEpoch !== authEpoch) {
          if (latestClearEpoch === authEpoch) {
            await credentials.clear()
          }
          return null
        }
        return resolved
      } catch (error) {
        if (isRejectedAccount(error)) {
          await api.logout(stored.refreshToken).catch(() => undefined)
          await clearIfCurrent(opEpoch)
          return null
        }
        if (isRejectedCredential(error)) return rotate(stored, opEpoch)
        throw error
      }
    },
    async refresh() {
      const opEpoch = authEpoch
      const stored = await credentials.getCredentials()
      if (opEpoch !== authEpoch) return null
      if (!stored) {
        await clearIfCurrent(opEpoch)
        return null
      }
      return rotate(stored, opEpoch)
    },
    async logout() {
      const opEpoch = ++authEpoch
      latestClearEpoch = opEpoch
      const stored = await credentials.getCredentials()
      if (opEpoch !== authEpoch) return
      await credentials.clear()
      try {
        if (stored) await api.logout(stored.refreshToken)
      } finally {
        await clearIfCurrent(opEpoch)
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
      await api.changePassword({ currentPassword, newPassword })
      const opEpoch = ++authEpoch
      latestClearEpoch = opEpoch
      await clearIfCurrent(opEpoch)
    },
  }
}
