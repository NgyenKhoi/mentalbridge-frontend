import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const journalMocks = vi.hoisted(() => ({ analysisJob: vi.fn() }))
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

import { GET } from './route'

const jobId = '50000000-0000-4000-8000-000000000001'
const account = {
  accountId: '10000000-0000-4000-8000-000000000001',
  status: 'ACTIVE',
  roles: ['USER'],
  emailVerified: true,
}

const request = () =>
  new NextRequest(`http://localhost/api/journals/analysis-jobs/${jobId}`, {
    headers: { cookie: `${ACCESS_COOKIE_NAME}=access-token` },
  })
const context = (id = jobId) => ({ params: Promise.resolve({ jobId: id }) })

describe('analysis status Route Handler', () => {
  beforeEach(() => {
    journalMocks.analysisJob.mockReset()
    sessionMocks.resolveSession.mockReset()
    sessionMocks.ensureRole.mockReset()
    sessionMocks.resolveSession.mockResolvedValue({ account })
  })

  it('returns only the owner-scoped job loaded with the server credential', async () => {
    journalMocks.analysisJob.mockResolvedValue({ jobId, status: 'RUNNING' })

    const response = await GET(request(), context())

    expect(response.status).toBe(200)
    expect(journalMocks.analysisJob).toHaveBeenCalledWith(
      'access-token',
      jobId,
      expect.any(String),
    )
  })

  it('fails closed when the USER role is denied', async () => {
    sessionMocks.ensureRole.mockImplementation(() => {
      throw new ApiError({
        message: 'Forbidden',
        code: 'FORBIDDEN',
        status: 403,
      })
    })

    const response = await GET(request(), context())

    expect(response.status).toBe(403)
    expect(journalMocks.analysisJob).not.toHaveBeenCalled()
  })

  it('rejects malformed job identifiers before authentication', async () => {
    const response = await GET(request(), context('not-a-job'))

    expect(response.status).toBe(400)
    expect(sessionMocks.resolveSession).not.toHaveBeenCalled()
  })
})
