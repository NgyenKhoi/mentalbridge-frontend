import { describe, expect, it } from 'vitest'
import {
  parseAccountPage,
  validateAccountStateChangeRequest,
} from './identity-validation'

const account = {
  accountId: '94464b2b-a7fd-46fd-9310-64ef4eac7de7',
  email: 'member@example.com',
  status: 'ACTIVE',
  roles: ['USER'],
  emailVerified: true,
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  version: 2,
}

describe('admin account validation', () => {
  it('parses a bounded account page without accepting extra fields', () => {
    expect(parseAccountPage({ items: [account], nextCursor: null })).toEqual({
      items: [account],
      nextCursor: null,
    })
    expect(
      parseAccountPage({ items: [account], nextCursor: null, secret: 'no' }),
    ).toBeNull()
  })

  it('accepts only approved status and reason combinations at the shape boundary', () => {
    expect(
      validateAccountStateChangeRequest({
        status: 'DISABLED',
        reasonCode: 'SAFETY_CONCERN',
      }).success,
    ).toBe(true)
    expect(
      validateAccountStateChangeRequest({
        status: 'DELETED',
        reasonCode: 'ANY_ARBITRARY_REASON',
      }).success,
    ).toBe(false)
  })
})
