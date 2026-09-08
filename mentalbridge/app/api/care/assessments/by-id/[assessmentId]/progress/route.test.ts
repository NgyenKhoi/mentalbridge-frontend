import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({ progress: vi.fn() }))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/care/care-client', () => ({
  careClient: { progress: careMocks.progress },
}))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { GET } from './route'

const assessmentId = '10000000-0000-4000-8000-000000000003'

function request(id = assessmentId) {
  return new NextRequest(
    `http://localhost/api/care/assessments/by-id/${id}/progress`,
    { headers: { cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret` } },
  )
}

function context(id = assessmentId) {
  return { params: Promise.resolve({ assessmentId: id }) }
}

describe('GET /api/care/assessments/by-id/[assessmentId]/progress', () => {
  beforeEach(() => {
    careMocks.progress.mockReset()
    sessionMocks.resolveSession.mockReset()
    sessionMocks.ensureRole.mockReset()
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: '10000000-0000-4000-8000-000000000009',
        status: 'ACTIVE',
        roles: ['USER'],
        emailVerified: true,
      },
    })
  })

  it('uses the server-side credential and returns only the descriptive comparison', async () => {
    const progress = {
      instrument: 'PHQ9',
      scoringVersion: 'phq9-standard-bands-v1',
      previous: {
        assessmentId: '10000000-0000-4000-8000-000000000002',
        questionnaireVersion: 'phq9-vi-vn-capstone-v1',
        submittedAt: '2026-09-01T00:00:00Z',
        totalScore: 4,
        screeningLevel: 'MINIMAL',
      },
      current: {
        assessmentId,
        questionnaireVersion: 'phq9-vi-vn-capstone-v1',
        submittedAt: '2026-09-04T00:00:00Z',
        totalScore: 10,
        screeningLevel: 'MODERATE',
      },
      rawDelta: 6,
      scoreDirection: 'INCREASED',
      bandTransition: { previous: 'MINIMAL', current: 'MODERATE' },
      elapsedDuration: 'PT72H',
    }
    careMocks.progress.mockResolvedValue(progress)

    const response = await GET(request(), context())

    expect(careMocks.progress).toHaveBeenCalledWith(
      'identity-access-secret',
      assessmentId,
      expect.any(String),
    )
    expect(await response.json()).toEqual(progress)
    expect(JSON.stringify(progress)).not.toContain('identity-access-secret')
  })

  it('rejects a malformed identifier before authentication or Care access', async () => {
    const response = await GET(request('not-a-uuid'), context('not-a-uuid'))

    expect(response.status).toBe(400)
    expect((await response.json()).code).toBe('VALIDATION_FAILED')
    expect(sessionMocks.resolveSession).not.toHaveBeenCalled()
    expect(careMocks.progress).not.toHaveBeenCalled()
  })

  it('preserves the explicit insufficient-data state without exposing upstream detail', async () => {
    careMocks.progress.mockRejectedValue(
      new ApiError({
        message: 'internal upstream detail',
        code: 'INSUFFICIENT_COMPARABLE_DATA',
        status: 409,
      }),
    )

    const response = await GET(request(), context())
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.code).toBe('INSUFFICIENT_COMPARABLE_DATA')
    expect(body.title).toBe('Comparable assessment data is unavailable.')
    expect(JSON.stringify(body)).not.toContain('internal upstream detail')
  })
})
