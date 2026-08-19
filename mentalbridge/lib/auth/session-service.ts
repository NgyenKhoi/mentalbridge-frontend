import 'server-only'

import { ApiError } from '@/lib/api/api-error'
import type {
  AccountDetail,
  IdentityRole,
  TokenPair,
} from '@/features/auth/api/identity-contract'
import {
  isUsableAccount,
  type CurrentAccount,
} from '@/features/auth/model/workspace'

import { identityClient } from './identity-client'
import { refreshCoordinator } from './refresh-coordinator'
import type { SessionCredentials } from './session-cookies'

export type { CurrentAccount } from '@/features/auth/model/workspace'

export type ResolvedSession = Readonly<{
  account: CurrentAccount
  rotatedTokens?: TokenPair
}>

export class RefreshFailedError extends Error {
  constructor(cause: unknown) {
    super('Session refresh failed.', { cause })
    this.name = 'RefreshFailedError'
  }
}

function toCurrentAccount(account: AccountDetail): CurrentAccount {
  return {
    accountId: account.accountId,
    status: account.status,
    roles: account.roles,
    emailVerified: account.emailVerified,
  }
}

export function ensureUsableAccount(account: CurrentAccount) {
  if (!isUsableAccount(account)) {
    throw new ApiError({
      message: 'The account is not eligible for an authenticated session.',
      code: 'SESSION_REQUIRED',
      status: 401,
    })
  }

  return account
}

function sessionRequired() {
  return new ApiError({
    message: 'Authentication is required.',
    code: 'SESSION_REQUIRED',
    status: 401,
  })
}

function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401
}

export async function resolveSession(
  credentials: SessionCredentials,
  correlationId: string,
): Promise<ResolvedSession> {
  if (credentials.accessToken) {
    try {
      const account = await identityClient.getOwnAccount(
        credentials.accessToken,
        correlationId,
      )
      return { account: ensureUsableAccount(toCurrentAccount(account)) }
    } catch (error) {
      if (!isUnauthorized(error)) throw error
    }
  }

  if (!credentials.refreshToken) throw sessionRequired()

  try {
    const rotatedTokens = await refreshCoordinator.refresh(
      credentials.refreshToken,
      correlationId,
    )
    const account = await identityClient.getOwnAccount(
      rotatedTokens.accessToken,
      correlationId,
    )

    return {
      account: ensureUsableAccount(toCurrentAccount(account)),
      rotatedTokens,
    }
  } catch (error) {
    throw new RefreshFailedError(error)
  }
}

export function ensureRole(
  account: CurrentAccount,
  allowedRoles: readonly IdentityRole[],
) {
  if (!allowedRoles.some((role) => account.roles.includes(role))) {
    throw new ApiError({
      message: 'The account lacks the required role.',
      code: 'FORBIDDEN',
      status: 403,
    })
  }

  return account
}
