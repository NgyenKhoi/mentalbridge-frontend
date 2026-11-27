import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const identityMocks = vi.hoisted(() => ({
  exportAdministrationAuditEvents: vi.fn(),
}))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))
vi.mock('@/lib/auth/identity-client', () => ({ identityClient: identityMocks }))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { GET } from './route'

describe('admin audit export BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: '9e3a8903-3d31-48d0-bf1a-4d81bbcef4b8',
        status: 'ACTIVE',
        roles: ['ADMIN'],
        emailVerified: true,
      },
    })
    identityMocks.exportAdministrationAuditEvents.mockResolvedValue({
      bytes: new TextEncoder().encode('eventId,action\r\n'),
      contentDisposition: 'attachment; filename="mentalbridge-audit.csv"',
    })
  })

  it('uses ADMIN authorization and the same filter vocabulary as browse', async () => {
    const request = new NextRequest(
      'http://localhost/api/admin/audit/export?action=ACCOUNT_DISABLED&result=DENIED',
      { headers: { cookie: `${ACCESS_COOKIE_NAME}=access-token` } },
    )
    const response = await GET(request)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/csv;charset=UTF-8')
    expect(sessionMocks.ensureRole).toHaveBeenCalledWith(expect.anything(), [
      'ADMIN',
    ])
    expect(identityMocks.exportAdministrationAuditEvents).toHaveBeenCalledWith(
      'access-token',
      { action: 'ACCOUNT_DISABLED', result: 'DENIED' },
      expect.any(String),
    )
  })

  it('does not accept browse-only pagination parameters', async () => {
    const request = new NextRequest(
      'http://localhost/api/admin/audit/export?cursor=unsafe',
      { headers: { cookie: `${ACCESS_COOKIE_NAME}=access-token` } },
    )
    const response = await GET(request)
    expect(response.status).toBe(400)
    expect(identityMocks.exportAdministrationAuditEvents).not.toHaveBeenCalled()
  })
})
