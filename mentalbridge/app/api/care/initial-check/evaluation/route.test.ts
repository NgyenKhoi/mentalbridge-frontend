import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({
  currentScreeningEpisode: vi.fn(),
  evaluateScreeningEpisode: vi.fn(),
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

import { POST } from './route'

const supportEvaluationId = '20000000-0000-4000-8000-000000000101'
const episodeId = '30000000-0000-4000-8000-000000000101'

function request() {
  return new NextRequest('http://localhost/api/care/initial-check/evaluation', {
    method: 'POST',
    headers: {
      cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret`,
    },
  })
}

describe('POST /api/care/initial-check/evaluation', () => {
  beforeEach(() => {
    careMocks.currentScreeningEpisode.mockReset()
    careMocks.evaluateScreeningEpisode.mockReset()
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

  it('evaluates the exact persisted Care episode', async () => {
    careMocks.currentScreeningEpisode.mockResolvedValue({ episodeId })
    careMocks.evaluateScreeningEpisode.mockResolvedValue({
      presentationEvaluation: { supportEvaluationId },
    })

    const response = await POST(request())

    expect(careMocks.evaluateScreeningEpisode).toHaveBeenCalledWith(
      'identity-access-secret',
      episodeId,
      expect.any(String),
    )
    expect(response.headers.get('set-cookie') ?? '').not.toContain(
      'mentalbridge_initial_check',
    )
  })

  it('fails closed when Care says the persisted episode is incomplete', async () => {
    careMocks.currentScreeningEpisode.mockRejectedValue(
      new ApiError({
        message: 'Episode incomplete',
        code: 'SCREENING_EPISODE_INCOMPLETE',
        status: 409,
      }),
    )
    const response = await POST(request())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'SCREENING_EPISODE_INCOMPLETE',
    })
    expect(careMocks.evaluateScreeningEpisode).not.toHaveBeenCalled()
  })
})
