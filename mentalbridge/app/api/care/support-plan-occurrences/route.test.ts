import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { supportPlanOccurrenceListFixture } from '@/features/support-plan/testing/support-plan-occurrence-fixture'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({ supportPlanOccurrences: vi.fn() }))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/care/care-client', () => ({ careClient: careMocks }))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { GET } from './route'

function request(query: string) {
  return new NextRequest(
    `http://localhost/api/care/support-plan-occurrences${query}`,
    { headers: { cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret` } },
  )
}

describe('GET /api/care/support-plan-occurrences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: { accountId: crypto.randomUUID(), roles: ['USER'] },
    })
  })

  it('forwards the bounded local-date window to Care', async () => {
    careMocks.supportPlanOccurrences.mockResolvedValue(
      supportPlanOccurrenceListFixture(),
    )

    const response = await GET(request('?from=2026-09-21&through=2026-10-04'))

    expect(response.status).toBe(200)
    expect(careMocks.supportPlanOccurrences).toHaveBeenCalledWith(
      'identity-access-secret',
      '2026-09-21',
      '2026-10-04',
      expect.any(String),
    )
  })

  it('rejects malformed dates before contacting Care', async () => {
    const response = await GET(request('?from=2026-02-30&through=tomorrow'))

    expect(response.status).toBe(400)
    expect(careMocks.supportPlanOccurrences).not.toHaveBeenCalled()
  })
})
