import 'server-only'

import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { ApiError } from '@/lib/api/api-error'
import type { IdentityRole } from '@/features/auth/api/identity-contract'
import { primaryWorkspacePath } from '@/features/auth/model/workspace'

import { identityClient } from './identity-client'
import { readSessionCredentials } from './session-cookies'
import { ensureRole, ensureUsableAccount } from './session-service'
import type { CurrentAccount } from '@/features/auth/model/workspace'

export const getCurrentAccount = cache(async (): Promise<CurrentAccount> => {
  const cookieStore = await cookies()
  const { accessToken } = readSessionCredentials(cookieStore)

  if (!accessToken) {
    throw new ApiError({
      message: 'Authentication is required.',
      code: 'SESSION_REQUIRED',
      status: 401,
    })
  }

  const account = await identityClient.getOwnAccount(
    accessToken,
    crypto.randomUUID(),
  )

  return ensureUsableAccount({
    accountId: account.accountId,
    status: account.status,
    roles: account.roles,
    emailVerified: account.emailVerified,
  })
})

export async function requireCurrentAccount(
  allowedRoles?: readonly IdentityRole[],
) {
  let account: CurrentAccount

  try {
    account = await getCurrentAccount()
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect('/login')
    throw error
  }

  if (allowedRoles) {
    try {
      ensureRole(account, allowedRoles)
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        redirect(primaryWorkspacePath(account.roles) ?? '/login')
      }
      throw error
    }
  }

  return account
}
