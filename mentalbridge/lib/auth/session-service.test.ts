import { describe, expect, it } from 'vitest'

import { ApiError } from '@/lib/api/api-error'

import {
  ensureRole,
  ensureUsableAccount,
  type CurrentAccount,
} from './session-service'

const account: CurrentAccount = {
  accountId: '94464b2b-a7fd-46fd-9310-64ef4eac7de7',
  status: 'ACTIVE',
  roles: ['USER'],
  emailVerified: true,
}

describe('ensureRole', () => {
  it('accepts a backend-confirmed role', () => {
    expect(ensureRole(account, ['USER'])).toBe(account)
  })

  it.each(['ADMIN', 'SPECIALIST'] as const)(
    'returns a stable forbidden failure when USER requests %s',
    (role) => {
      expect.assertions(2)

      try {
        ensureRole(account, [role])
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN' })
      }
    },
  )
})

describe('ensureUsableAccount', () => {
  it('rejects inactive and unverified sessions without disclosing account state', () => {
    for (const unusable of [
      { ...account, status: 'DISABLED' as const },
      { ...account, emailVerified: false },
    ]) {
      expect(() => ensureUsableAccount(unusable)).toThrowError(
        expect.objectContaining({ code: 'SESSION_REQUIRED', status: 401 }),
      )
    }
  })
})
