import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { supportPlanOccurrenceFixture } from '@/features/support-plan/testing/support-plan-occurrence-fixture'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const occurrenceId = '91000000-0000-4000-8000-000000000513'
const careMocks = vi.hoisted(() => ({
  changeSupportPlanOccurrenceState: vi.fn(),
}))
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

import { PUT } from './route'

const context = {
  params: Promise.resolve({ occurrenceId }),
} as RouteContext<'/api/care/support-plan-occurrences/[occurrenceId]/state'>

function request(ifMatch = '"0"', state = 'COMPLETED') {
  return new NextRequest(
    `http://localhost/api/care/support-plan-occurrences/${occurrenceId}/state`,
    {
      method: 'PUT',
      headers: {
        cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret`,
        'content-type': 'application/json',
        'if-match': ifMatch,
      },
      body: JSON.stringify({ state }),
    },
  )
}

describe('PUT /api/care/support-plan-occurrences/[occurrenceId]/state', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: { accountId: crypto.randomUUID(), roles: ['USER'] },
    })
  })

  it('forwards the exact state and version and returns the new ETag', async () => {
    careMocks.changeSupportPlanOccurrenceState.mockResolvedValue(
      supportPlanOccurrenceFixture({
        state: 'COMPLETED',
        displayState: 'COMPLETED',
        version: 1,
        completedAt: '2026-09-21T02:00:00Z',
      }),
    )

    const response = await PUT(request(), context)

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"1"')
    expect(careMocks.changeSupportPlanOccurrenceState).toHaveBeenCalledWith(
      'identity-access-secret',
      occurrenceId,
      0,
      { state: 'COMPLETED' },
      expect.any(String),
    )
  })

  it('rejects a weak or missing concurrency token', async () => {
    const response = await PUT(request('W/"0"'), context)

    expect(response.status).toBe(400)
    expect(careMocks.changeSupportPlanOccurrenceState).not.toHaveBeenCalled()
  })
})
