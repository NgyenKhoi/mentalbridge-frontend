import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'
import { GET } from './route'

const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))
const consultationMocks = vi.hoisted(() => ({
  specialistOperationalAnalytics: vi.fn(),
}))

vi.mock('@/lib/auth/session-service', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/auth/session-service')
  >('@/lib/auth/session-service')
  return { ...actual, ...sessionMocks }
})
vi.mock('@/lib/consultation/consultation-client', () => ({
  consultationClient: consultationMocks,
  ConsultationServiceError: class ConsultationServiceError extends Error {},
}))

function request(days = '30') {
  return new NextRequest(
    `http://localhost/api/consultation/specialist/analytics?days=${days}`,
    { headers: { cookie: `${ACCESS_COOKIE_NAME}=access-token` } },
  )
}

describe('specialist analytics BFF', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-06T01:00:00Z'))
    sessionMocks.resolveSession.mockResolvedValue({
      account: {
        accountId: '9e3a8903-3d31-48d0-bf1a-4d81bbcef4b8',
        status: 'ACTIVE',
        roles: ['SPECIALIST'],
        emailVerified: true,
      },
    })
    consultationMocks.specialistOperationalAnalytics.mockResolvedValue({
      data: { source: 'CONSULTATION', operationalStatus: 'READY' },
    })
  })

  it('authorizes a specialist and converts the selected preset to an explicit UTC period', async () => {
    const response = await GET(request('7'))

    expect(response.status).toBe(200)
    expect(sessionMocks.ensureRole).toHaveBeenCalledWith(expect.anything(), [
      'SPECIALIST',
    ])
    expect(
      consultationMocks.specialistOperationalAnalytics,
    ).toHaveBeenCalledWith(
      'access-token',
      expect.any(String),
      '2026-09-29T01:00:00.000Z',
      '2026-10-06T01:00:00.000Z',
    )
  })

  it('rejects unsupported periods before contacting the backend', async () => {
    const response = await GET(request('365'))

    expect(response.status).toBe(400)
    expect(
      consultationMocks.specialistOperationalAnalytics,
    ).not.toHaveBeenCalled()
  })
})
