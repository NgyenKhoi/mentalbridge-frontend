import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const auth = vi.hoisted(() => ({
  authenticate: vi.fn(),
  authenticationFailure: vi.fn(),
  carrySession: vi.fn(),
}))
const care = vi.hoisted(() => ({ activityDashboard: vi.fn() }))

vi.mock('@/lib/care/authenticated-user', () => ({
  authenticatedCareUser: auth.authenticate,
  careAuthenticationFailure: auth.authenticationFailure,
  carryCareSession: auth.carrySession,
}))
vi.mock('@/lib/care/care-client', () => ({ careClient: care }))

import { GET } from './route'

function request(query = 'timezone=Asia%2FBangkok&range=30') {
  return new NextRequest(`http://localhost/api/analytics?${query}`)
}

describe('/api/analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    auth.authenticate.mockResolvedValue({
      accessToken: 'owner-token',
      rotatedTokens: undefined,
    })
    auth.carrySession.mockImplementation((response: NextResponse) => response)
    auth.authenticationFailure.mockReturnValue(
      NextResponse.json({ code: 'AUTHENTICATION_REQUIRED' }, { status: 401 }),
    )
    care.activityDashboard.mockResolvedValue({ bounded: { windowDays: 30 } })
  })

  it('proxies one owner-scoped aggregate for the selected range', async () => {
    const response = await GET(request())

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(care.activityDashboard).toHaveBeenCalledWith(
      'owner-token',
      'Asia/Bangkok',
      30,
      expect.any(String),
    )
  })

  it.each([
    'timezone=not%2Fa-timezone&range=30',
    'timezone=UTC&timezone=Asia%2FBangkok&range=30',
    'timezone=UTC&range=14',
    'timezone=UTC&range=30&cursor=private',
    '',
  ])(
    'rejects invalid query parameters before authentication: %s',
    async (query) => {
      const response = await GET(request(query))

      expect(response.status).toBe(400)
      expect(auth.authenticate).not.toHaveBeenCalled()
      expect(care.activityDashboard).not.toHaveBeenCalled()
    },
  )
})
