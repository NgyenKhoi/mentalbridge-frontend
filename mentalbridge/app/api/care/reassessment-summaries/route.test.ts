import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const care = vi.hoisted(() => ({
  reassessmentContext: vi.fn(),
  composeReassessmentSummary: vi.fn(),
}))
const session = vi.hoisted(() => ({ resolveSession: vi.fn() }))
vi.mock('@/lib/care/care-client', () => ({ careClient: care }))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: session.resolveSession,
  ensureRole: vi.fn(),
}))

import { GET, POST } from './route'

const body = {
  phq9AssessmentId: '10000000-0000-4000-8000-000000000001',
  gad7AssessmentId: '10000000-0000-4000-8000-000000000002',
  journalJobId: '10000000-0000-4000-8000-000000000003',
  selfReportId: '10000000-0000-4000-8000-000000000004',
  previousPeriod: {
    startAt: '2026-08-27T00:00:00Z',
    endAt: '2026-09-10T00:00:00Z',
  },
  currentPeriod: {
    startAt: '2026-09-10T00:00:00Z',
    endAt: '2026-09-24T00:00:00Z',
  },
}

function request(method: 'GET' | 'POST', value?: unknown) {
  return new NextRequest('http://localhost/api/care/reassessment-summaries', {
    method,
    headers: {
      cookie: `${ACCESS_COOKIE_NAME}=access-token`,
      ...(method === 'POST'
        ? {
            'content-type': 'application/json',
            'idempotency-key': 'reassessment-summary-browser-01',
          }
        : {}),
    },
    ...(value === undefined ? {} : { body: JSON.stringify(value) }),
  })
}

describe('/api/care/reassessment-summaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    session.resolveSession.mockResolvedValue({
      account: { accountId: 'owner', roles: ['USER'] },
    })
  })

  it('loads the Care-owned context', async () => {
    care.reassessmentContext.mockResolvedValue({ state: 'READY' })
    const response = await GET(request('GET'))
    expect(response.status).toBe(200)
    expect(care.reassessmentContext).toHaveBeenCalledWith(
      'access-token',
      expect.any(String),
    )
  })

  it('forwards only the canonical Journal job composition shape', async () => {
    care.composeReassessmentSummary.mockResolvedValue({ summaryId: 'summary' })
    const response = await POST(request('POST', body))
    expect(response.status).toBe(201)
    expect(care.composeReassessmentSummary).toHaveBeenCalledWith(
      'access-token',
      body,
      'reassessment-summary-browser-01',
      expect.any(String),
    )
  })

  it('rejects a browser-supplied analysis id', async () => {
    const response = await POST(
      request('POST', {
        ...body,
        journalJobId: undefined,
        journalAnalysisId: '10000000-0000-4000-8000-000000000005',
      }),
    )
    expect(response.status).toBe(400)
    expect(care.composeReassessmentSummary).not.toHaveBeenCalled()
  })
})
