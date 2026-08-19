import { describe, expect, it } from 'vitest'

import {
  isUsableAccount,
  parseCurrentAccountResponse,
  primaryWorkspacePath,
  resolveWorkspaces,
} from './workspace'

const account = {
  accountId: '94464b2b-a7fd-46fd-9310-64ef4eac7de7',
  status: 'ACTIVE',
  roles: ['USER'],
  emailVerified: true,
} as const

describe('workspace resolution', () => {
  it.each([
    [['USER'], '/dashboard'],
    [['SPECIALIST'], '/specialist/dashboard'],
    [['ADMIN'], '/admin/dashboard'],
  ])('maps the authoritative %s role', (roles, expectedPath) => {
    expect(primaryWorkspacePath(roles)).toBe(expectedPath)
  })

  it('uses deterministic precedence and exposes every confirmed workspace for a multi-role account', () => {
    expect(resolveWorkspaces(['USER', 'ADMIN', 'SPECIALIST'])).toEqual([
      expect.objectContaining({ role: 'ADMIN', path: '/admin/dashboard' }),
      expect.objectContaining({
        role: 'SPECIALIST',
        path: '/specialist/dashboard',
      }),
      expect.objectContaining({ role: 'USER', path: '/dashboard' }),
    ])
  })

  it.each([[[]], [['OWNER']], [['USER', 'USER']]])(
    'fails safely for invalid roles %s',
    (roles) => {
      expect(resolveWorkspaces(roles)).toBeNull()
      expect(primaryWorkspacePath(roles)).toBeNull()
    },
  )
})

describe('current account parsing', () => {
  it('accepts only the bounded BFF account DTO', () => {
    expect(parseCurrentAccountResponse({ account })).toEqual(account)
  })

  it.each([
    { ...account, roles: ['OWNER'] },
    { ...account, accountId: 'not-an-id' },
    { ...account, displayName: 'Sensitive field' },
  ])('rejects an invalid or expanded account response', (invalidAccount) => {
    expect(parseCurrentAccountResponse({ account: invalidAccount })).toBeNull()
  })

  it('requires both ACTIVE status and verified email for a usable session', () => {
    expect(isUsableAccount(account)).toBe(true)
    expect(isUsableAccount({ ...account, status: 'DISABLED' })).toBe(false)
    expect(isUsableAccount({ ...account, emailVerified: false })).toBe(false)
  })
})
