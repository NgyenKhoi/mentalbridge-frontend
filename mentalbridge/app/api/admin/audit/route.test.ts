import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const identityMocks = vi.hoisted(() => ({
  browseAdministrationAuditEvents: vi.fn(),
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

function request(query = '') {
  return new NextRequest(`http://localhost/api/admin/audit${query}`, {
    headers: { cookie: `${ACCESS_COOKIE_NAME}=access-token` },
  })
}

describe('admin audit browse BFF', () => {
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
    identityMocks.browseAdministrationAuditEvents.mockResolvedValue({
      items: [],
      nextCursor: null,
      effectiveFrom: '2026-09-05T00:00:00Z',
      effectiveTo: '2026-10-05T00:00:00Z',
      retentionCutoff: '2025-10-05T00:00:00Z',
    })
  })

  it('requires ADMIN and forwards the validated filters', async () => {
    const response = await GET(
      request('?actorType=ADMIN&result=DENIED&limit=25'),
    )
    expect(response.status).toBe(200)
    expect(sessionMocks.ensureRole).toHaveBeenCalledWith(expect.anything(), [
      'ADMIN',
    ])
    expect(identityMocks.browseAdministrationAuditEvents).toHaveBeenCalledWith(
      'access-token',
      { actorType: 'ADMIN', result: 'DENIED', limit: 25 },
      expect.any(String),
    )
  })

  it('rejects invalid filters before calling Identity', async () => {
    const response = await GET(request('?action=raw%20chat%20body'))
    expect(response.status).toBe(400)
    expect(identityMocks.browseAdministrationAuditEvents).not.toHaveBeenCalled()
  })
})
