import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const journalMocks = vi.hoisted(() => ({ requestAnalysis: vi.fn() }))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/journal/journal-client', () => ({ journalClient: journalMocks }))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { POST } from './route'

const journalId = '40000000-0000-4000-8000-000000000001'
const account = {
  accountId: '10000000-0000-4000-8000-000000000001',
  status: 'ACTIVE',
  roles: ['USER'],
  emailVerified: true,
}
const job = {
  jobId: '50000000-0000-4000-8000-000000000001',
  journalId,
  journalRevision: 2,
  status: 'RUNNING',
  attemptCount: 0,
  terminalReason: null,
  result: null,
  createdAt: '2026-09-23T00:00:00Z',
  updatedAt: '2026-09-23T00:00:00Z',
  completedAt: null,
}

function request(key = 'analysis-command-0001') {
  return new NextRequest(
    `http://localhost/api/journals/${journalId}/revisions/2/analysis-jobs`,
    {
      method: 'POST',
      headers: {
        cookie: `${ACCESS_COOKIE_NAME}=access-token`,
        'Idempotency-Key': key,
      },
    },
  )
}

const context = (id = journalId, revision = '2') => ({
  params: Promise.resolve({ journalId: id, revision }),
})

describe('analysis request Route Handler', () => {
  beforeEach(() => {
    journalMocks.requestAnalysis.mockReset()
    sessionMocks.resolveSession.mockReset()
    sessionMocks.ensureRole.mockReset()
    sessionMocks.resolveSession.mockResolvedValue({ account })
  })

  it('forwards the exact revision and idempotency key', async () => {
    journalMocks.requestAnalysis.mockResolvedValue(job)

    const response = await POST(request(), context())

    expect(response.status).toBe(202)
    expect(journalMocks.requestAnalysis).toHaveBeenCalledWith(
      'access-token',
      journalId,
      2,
      'analysis-command-0001',
      expect.any(String),
    )
    expect(await response.json()).toEqual(job)
  })

  it('rejects invalid revision correlation before session access', async () => {
    const response = await POST(request(), context(journalId, '201'))

    expect(response.status).toBe(400)
    expect(sessionMocks.resolveSession).not.toHaveBeenCalled()
    expect(journalMocks.requestAnalysis).not.toHaveBeenCalled()
  })
})
