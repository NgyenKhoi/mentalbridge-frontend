import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'
import {
  INITIAL_CHECK_GAD7_COOKIE,
  INITIAL_CHECK_PHQ9_COOKIE,
} from '@/lib/care/guided-initial-check-cookies'

const careMocks = vi.hoisted(() => ({
  generateSupportGuide: vi.fn(),
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

const phq9 = '10000000-0000-4000-8000-000000000511'
const gad7 = '20000000-0000-4000-8000-000000000511'

function request(method: 'GET' | 'POST', suffix = '', journey = true) {
  const cookies = [`${ACCESS_COOKIE_NAME}=identity-access-secret`]
  if (journey)
    cookies.push(
      `${INITIAL_CHECK_PHQ9_COOKIE}=${phq9}`,
      `${INITIAL_CHECK_GAD7_COOKIE}=${gad7}`,
    )
  return new NextRequest(`http://localhost/api/care/support-guides${suffix}`, {
    method,
    headers: {
      cookie: cookies.join('; '),
      ...(method === 'POST'
        ? { 'idempotency-key': 'support-guide-browser-0001' }
        : {}),
    },
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
  })

  it('generates only from server-held exact assessment references', async () => {
    careMocks.generateSupportGuide.mockResolvedValue({
      supportGuideId: 'guide',
    })
    const response = await POST(request('POST'))

    expect(response.status).toBe(201)
    expect(careMocks.generateSupportGuide).toHaveBeenCalledWith(
      'identity-access-secret',
      { phq9AssessmentId: phq9, gad7AssessmentId: gad7 },
      'support-guide-browser-0001',
      expect.any(String),
    )
  })

  it('fails closed when the guided assessment references are absent', async () => {
    const response = await POST(request('POST', '', false))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'INITIAL_CHECK_INCOMPLETE',
    })
    expect(careMocks.generateSupportGuide).not.toHaveBeenCalled()
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
