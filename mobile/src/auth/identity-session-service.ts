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

function acceptedUserSession(account: AccountDetail): AppSession {
  if (
    account.status !== 'ACTIVE' ||
    !account.emailVerified ||
    account.roles.length !== 1 ||
    account.roles[0] !== 'USER'
  ) {
    throw invalidSession('Identity did not return an active USER account.')
  }

  return { role: 'USER', subject: account.accountId }
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
      session: acceptedUserSession(account),
      accessExpiresAt: stored.accessExpiresAt,
    }
  }

  async function rotate(
    stored: StoredCredentials,
  ): Promise<AuthenticatedSession | null> {
    if (Date.parse(stored.refreshExpiresAt) <= now()) {
      await credentials.clear()
      return null
    }

    try {
      const pair = await api.refresh(
        stored.refreshToken,
        createIdempotencyKey(),
      )
      const rotated = await persistTokenPair(pair)
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
        await credentials.clear()
        return null
      }
      throw error
    }
  }

  return {
    async signIn(email, password) {
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
  }
}
