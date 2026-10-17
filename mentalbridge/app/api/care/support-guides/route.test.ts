import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({
  currentGuidedJourney: vi.fn(),
  ensureScreeningEpisodeSupportGuide: vi.fn(),
  supportGuideHistory: vi.fn(),
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

import { GET, POST } from './route'

const episodeId = '10000000-0000-4000-8000-000000000668'

function request(method: 'GET' | 'POST', suffix = '') {
  return new NextRequest(`http://localhost/api/care/support-guides${suffix}`, {
    method,
    headers: { cookie: `${ACCESS_COOKIE_NAME}=identity-access-secret` },
  })
}

describe('/api/care/support-guides', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: '30000000-0000-4000-8000-000000000511',
        status: 'ACTIVE',
        roles: ['USER'],
        emailVerified: true,
      },
    })
    careMocks.currentGuidedJourney.mockResolvedValue({
      stage: 'GUIDE_REQUIRED',
      episodeId,
    })
  })

  it('ensures the Guide for the Care-selected completed episode without client evidence or keys', async () => {
    careMocks.ensureScreeningEpisodeSupportGuide.mockResolvedValue({
      supportGuideId: 'guide',
    })
    const response = await POST(request('POST'))

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(careMocks.ensureScreeningEpisodeSupportGuide).toHaveBeenCalledWith(
      'identity-access-secret',
      episodeId,
      expect.any(String),
    )
  })

  it('fails closed when Care has no completed initial check', async () => {
    careMocks.currentGuidedJourney.mockResolvedValue({
      stage: 'ASSESSMENT_REQUIRED',
      episodeId: null,
    })
    const response = await POST(request('POST'))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'INITIAL_CHECK_INCOMPLETE',
    })
    expect(careMocks.ensureScreeningEpisodeSupportGuide).not.toHaveBeenCalled()
  })

  it('passes Care ensure rejections through without inventing a Guide', async () => {
    careMocks.ensureScreeningEpisodeSupportGuide.mockRejectedValue(
      new ApiError({
        message: 'Not current',
        code: 'SCREENING_EPISODE_NOT_CURRENT',
        status: 409,
      }),
    )

    const response = await POST(request('POST'))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'SCREENING_EPISODE_NOT_CURRENT',
    })
  })

  it('requires a session before asking Care to prepare a Guide', async () => {
    sessionMocks.resolveSession.mockRejectedValue(
      new ApiError({
        code: 'SESSION_REQUIRED',
        status: 401,
        message: 'secret',
      }),
    )

    const response = await POST(request('POST'))

    expect(response.status).toBe(401)
    expect(careMocks.currentGuidedJourney).not.toHaveBeenCalled()
    expect(careMocks.ensureScreeningEpisodeSupportGuide).not.toHaveBeenCalled()
  })

  it('forwards bounded history pagination under the authenticated user', async () => {
    careMocks.supportGuideHistory.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    })
    const response = await GET(request('GET', '?limit=5&cursor=next-page'))

    expect(response.status).toBe(200)
    expect(careMocks.supportGuideHistory).toHaveBeenCalledWith(
      'identity-access-secret',
      'next-page',
      5,
      expect.any(String),
    )
  })
})
