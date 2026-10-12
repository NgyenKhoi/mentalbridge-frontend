import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const planId = '10000000-0000-4000-8000-000000000640'
const actionId = '20000000-0000-4000-8000-000000000640'
const careMocks = vi.hoisted(() => ({
  replaceSupportPlanActionSchedule: vi.fn(),
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

const body = {
  schedule: {
    recurrenceType: 'WEEKLY',
    daysOfWeek: [1, 4],
    preferredDaypart: 'MORNING',
    localTime: '08:30',
    estimatedDurationMinutes: 15,
    timezone: 'Asia/Ho_Chi_Minh',
    effectiveFrom: '2026-10-13',
    effectiveUntil: null,
    reminderEnabled: true,
  },
}

function request(value: unknown = body) {
  return new NextRequest(
    `http://localhost/api/care/support-plans/${planId}/actions/${actionId}/schedule`,
    {
      method: 'PUT',
      headers: {
        cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret`,
        'content-type': 'application/json',
        'if-match': '"2"',
        'idempotency-key': 'schedule-command-0001',
      },
      body: JSON.stringify(value),
    },
  )
}

const context = {
  params: Promise.resolve({ supportPlanId: planId, actionId }),
} as RouteContext<'/api/care/support-plans/[supportPlanId]/actions/[actionId]/schedule'>

describe('PUT /api/care/support-plans/[supportPlanId]/actions/[actionId]/schedule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: { accountId: crypto.randomUUID(), roles: ['USER'] },
    })
  })

  it('forwards exact schedule intent with version and idempotency', async () => {
    careMocks.replaceSupportPlanActionSchedule.mockResolvedValue({
      supportPlanId: planId,
      version: 3,
    })
    const response = await PUT(request(), context)

    expect(response.status).toBe(200)
    expect(response.headers.get('etag')).toBe('"3"')
    expect(careMocks.replaceSupportPlanActionSchedule).toHaveBeenCalledWith(
      'identity-access-secret',
      planId,
      actionId,
      body,
      2,
      'schedule-command-0001',
      expect.any(String),
    )
  })

  it('rejects a weekly schedule without weekdays', async () => {
    const response = await PUT(
      request({ schedule: { ...body.schedule, daysOfWeek: [] } }),
      context,
    )

    expect(response.status).toBe(400)
    expect(careMocks.replaceSupportPlanActionSchedule).not.toHaveBeenCalled()
  })

  it('allows workload removal as an explicit null schedule', async () => {
    careMocks.replaceSupportPlanActionSchedule.mockResolvedValue({
      supportPlanId: planId,
      version: 3,
    })
    const response = await PUT(request({ schedule: null }), context)

    expect(response.status).toBe(200)
    expect(careMocks.replaceSupportPlanActionSchedule).toHaveBeenCalledWith(
      expect.any(String),
      planId,
      actionId,
      { schedule: null },
      2,
      'schedule-command-0001',
      expect.any(String),
    )
  })
})
