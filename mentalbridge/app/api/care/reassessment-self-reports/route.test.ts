import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({
  currentReassessmentSelfReport: vi.fn(),
  createReassessmentSelfReport: vi.fn(),
}))
const sessionMocks = vi.hoisted(() => ({ resolveSession: vi.fn() }))

vi.mock('@/lib/care/care-client', () => ({ careClient: careMocks }))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: vi.fn(),
}))

import { GET, POST } from './route'

function request(method: 'GET' | 'POST', body?: unknown) {
  return new NextRequest(
    'http://localhost/api/care/reassessment-self-reports',
    {
      method,
      headers: {
        cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret`,
        ...(method === 'POST'
          ? {
              'content-type': 'application/json',
              'idempotency-key': 'reassessment-self-browser-01',
            }
          : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    },
  )
}

describe('/api/care/reassessment-self-reports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: '30000000-0000-4000-8000-000000000559',
        status: 'ACTIVE',
        roles: ['USER'],
        emailVerified: true,
      },
    })
  })

  it('validates and forwards the explicit self-report under the user session', async () => {
    careMocks.createReassessmentSelfReport.mockResolvedValue({
      selfReportId: 'id',
    })
    const body = {
      currentPeriod: {
        startAt: '2026-09-10T00:00:00Z',
        endAt: '2026-09-24T00:00:00Z',
      },
      currentExperience: 'UNSURE',
      helpfulContext: '  Nghỉ ngắn.  ',
      difficultContext: null,
    }
    const response = await POST(request('POST', body))

    expect(response.status).toBe(201)
    expect(careMocks.createReassessmentSelfReport).toHaveBeenCalledWith(
      'identity-access-secret',
      { ...body, helpfulContext: 'Nghỉ ngắn.' },
      'reassessment-self-browser-01',
      expect.any(String),
    )
  })

  it('rejects a missing categorical response before calling Care', async () => {
    const response = await POST(
      request('POST', {
        currentPeriod: {
          startAt: '2026-09-10T00:00:00Z',
          endAt: '2026-09-24T00:00:00Z',
        },
      }),
    )
    expect(response.status).toBe(400)
    expect(careMocks.createReassessmentSelfReport).not.toHaveBeenCalled()
  })

  it('loads only the authenticated owner current response', async () => {
    careMocks.currentReassessmentSelfReport.mockResolvedValue({
      selfReportId: 'owner-report',
    })
    const response = await GET(request('GET'))
    expect(response.status).toBe(200)
    expect(careMocks.currentReassessmentSelfReport).toHaveBeenCalledWith(
      'identity-access-secret',
      expect.any(String),
    )
  })
})
