import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({ replaceSupportPlanChoices: vi.fn() }))
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

const planId = '10000000-0000-4000-8000-000000000373'
const resourceId = '20000000-0000-4000-8000-000000000373'

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(
    `http://localhost/api/care/support-plans/${planId}/choices`,
    {
      method: 'PUT',
      headers: {
        cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret`,
        'content-type': 'application/json',
        'if-match': '"2"',
        ...headers,
      },
      body: JSON.stringify(body),
    },
  )
}

const context = {
  params: Promise.resolve({ supportPlanId: planId }),
} as RouteContext<'/api/care/support-plans/[supportPlanId]/choices'>

describe('PUT /api/care/support-plans/[supportPlanId]/choices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: { accountId: crypto.randomUUID(), roles: ['USER'] },
    })
  })

  it('forwards the exact versioned choice intent', async () => {
    const body = {
      slotSelections: [
        { slotId: 'core-slot', resourceId, contentVersion: '7' },
      ],
    }
    careMocks.replaceSupportPlanChoices.mockResolvedValue({
      supportPlanId: planId,
      version: 3,
    })

    const response = await PUT(request(body), context)

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"3"')
    expect(careMocks.replaceSupportPlanChoices).toHaveBeenCalledWith(
      'identity-access-secret',
      planId,
      body,
      2,
      expect.any(String),
    )
  })

  it('rejects duplicate slot intent before calling Care', async () => {
    const response = await PUT(
      request({
        slotSelections: [
          { slotId: 'core-slot', resourceId, contentVersion: '7' },
          { slotId: 'core-slot', resourceId, contentVersion: '7' },
        ],
      }),
      context,
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      code: 'VALIDATION_FAILED',
    })
    expect(careMocks.replaceSupportPlanChoices).not.toHaveBeenCalled()
  })
})
