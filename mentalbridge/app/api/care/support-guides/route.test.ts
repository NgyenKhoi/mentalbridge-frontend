import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const careMocks = vi.hoisted(() => ({
  currentScreeningEpisode: vi.fn(),
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

function request(method: 'GET' | 'POST', suffix = '') {
  const cookies = [`${ACCESS_COOKIE_NAME}=identity-access-secret`]
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
    careMocks.currentScreeningEpisode.mockResolvedValue({
      status: 'COMPLETED',
      phq9AssessmentId: phq9,
      gad7AssessmentId: gad7,
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
    careMocks.currentScreeningEpisode.mockResolvedValue({
      status: 'IN_PROGRESS',
      phq9AssessmentId: null,
      gad7AssessmentId: null,
    })
    const response = await POST(request('POST'))

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      code: 'INITIAL_CHECK_INCOMPLETE',
      title:
        'Cần hoàn tất PHQ-9 và GAD-7 trong cùng lượt Kiểm tra ban đầu trước khi tạo gợi ý hỗ trợ.',
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
