import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import {
  conversation,
  makeDashboard,
  makeProgress,
} from '@/tests/fixtures/look-back'

const auth = vi.hoisted(() => ({
  authenticate: vi.fn(),
  authenticationFailure: vi.fn(),
  carrySession: vi.fn(),
}))
const care = vi.hoisted(() => ({
  activityDashboard: vi.fn(),
  history: vi.fn(),
  progress: vi.fn(),
}))
const companion = vi.hoisted(() => ({ list: vi.fn() }))

vi.mock('@/lib/care/authenticated-user', () => ({
  authenticatedCareUser: auth.authenticate,
  careAuthenticationFailure: auth.authenticationFailure,
  carryCareSession: auth.carrySession,
}))
vi.mock('@/lib/care/care-client', () => ({ careClient: care }))
vi.mock('@/lib/companion/companion-client', () => ({
  companionClient: companion,
}))

import { GET } from './route'

const request = (query = 'timezone=Asia%2FHo_Chi_Minh') =>
  new NextRequest(`http://localhost/api/look-back?${query}`)
const moods = [...Array(7).fill(2), ...Array(7).fill(4)]
const problem = (status: number, code: string) =>
  new ApiError({ message: code, code, status })

describe('/api/look-back', () => {
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
    care.activityDashboard.mockResolvedValue(makeDashboard(moods))
    care.history.mockResolvedValue({
      items: [
        {
          assessmentId: 'a-new',
          instrument: 'PHQ9',

          result: { screeningLevel: 'MILD' },
          submittedAt: '2026-11-21T09:00:00+07:00',
        },
        {
          assessmentId: 'a-old',
          instrument: 'PHQ9',

          result: { screeningLevel: 'MILD' },
          submittedAt: '2026-11-01T09:00:00+07:00',
        },
      ],
      hasMore: false,
    })
    care.progress.mockResolvedValue(
      makeProgress(
        'PHQ9',
        ['2026-11-10T09:00:00+07:00', 'MODERATE', 11],
        ['2026-11-21T09:00:00+07:00', 'MILD', 6],
      ),
    )
    companion.list.mockResolvedValue({
      items: [conversation('c1', 'Ngủ ngon hơn', '2026-11-20T09:00:00+07:00')],
    })
  })

  it('composes one owner-scoped view from the 30-day dashboard, screenings and conversations', async () => {
    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(care.activityDashboard).toHaveBeenCalledWith(
      'owner-token',
      'Asia/Ho_Chi_Minh',
      30,
      expect.any(String),
    )
    expect(care.progress).toHaveBeenCalledTimes(1)
    expect(care.progress).toHaveBeenCalledWith(
      'owner-token',
      'a-new',
      expect.any(String),
    )
    expect(body).toMatchObject({
      narrative: 'IMPROVING',
      partial: false,
      conversations: [{ id: 'c1', title: 'Ngủ ngon hơn' }],
      screening: [{ instrument: 'PHQ9', direction: 'LOWER' }],
    })
    expect(body.days).toHaveLength(14)
  })

  it('shows the professional pointer for a FIRST moderate screening that has nothing to compare', async () => {
    care.history.mockResolvedValue({
      items: [
        {
          assessmentId: 'a-only',
          instrument: 'PHQ9',
          result: { screeningLevel: 'MODERATE' },
          submittedAt: '2026-11-21T09:00:00+07:00',
        },
      ],
      hasMore: false,
    })
    care.progress.mockRejectedValue(
      problem(409, 'INSUFFICIENT_COMPARABLE_DATA'),
    )
    const body = await (await GET(request())).json()
    expect(body.screening).toEqual([])
    expect(body.professionalPointer).toBe(true)
    expect(body.nextStep).toBe('SUPPORT')
    expect(body.partial).toBe(false)
  })

  it('flags partial for a screening level it does not know', async () => {
    care.history.mockResolvedValue({
      items: [
        {
          assessmentId: 'a-odd',
          instrument: 'PHQ9',
          result: { screeningLevel: 'EXTREME' },
          submittedAt: '2026-11-21T09:00:00+07:00',
        },
      ],
      hasMore: false,
    })
    care.progress.mockRejectedValue(
      problem(409, 'INSUFFICIENT_COMPARABLE_DATA'),
    )
    const body = await (await GET(request())).json()
    expect(body.partial).toBe(true)
  })

  it('hides the conversation section silently when consent is missing', async () => {
    companion.list.mockRejectedValue(problem(403, 'AI_CONSENT_REQUIRED'))
    const body = await (await GET(request())).json()
    expect(body.conversations).toBeNull()
    expect(body.partial).toBe(false)
    expect(body.screening).toHaveLength(1)
  })

  it('says part of the data is missing when the companion is down', async () => {
    companion.list.mockRejectedValue(problem(503, 'COMPANION_UNAVAILABLE'))
    const body = await (await GET(request())).json()
    expect(body.conversations).toBeNull()
    expect(body.partial).toBe(true)
  })

  it('treats a single screening as nothing to compare, not as a failure', async () => {
    care.progress.mockRejectedValue(
      problem(409, 'INSUFFICIENT_COMPARABLE_DATA'),
    )
    const body = await (await GET(request())).json()
    expect(body.screening).toEqual([])
    expect(body.partial).toBe(false)
  })

  it.each([408, 429])(
    'says part of the data is missing when the companion answers %i',
    async (status) => {
      companion.list.mockRejectedValue(problem(status, 'COMPANION_BUSY'))
      const body = await (await GET(request())).json()
      expect(body.conversations).toBeNull()
      expect(body.partial).toBe(true)
    },
  )

  it('flags partial when a screening comparison fails with a server error', async () => {
    care.progress.mockRejectedValue(problem(503, 'CARE_UNAVAILABLE'))
    const body = await (await GET(request())).json()
    expect(body.screening).toEqual([])
    expect(body.partial).toBe(true)
    expect(body.days).toHaveLength(14)
  })

  it('reports UNKNOWN, not SPARSE, when the mood source is unavailable', async () => {
    const dashboard = makeDashboard(moods)
    care.activityDashboard.mockResolvedValue({
      ...dashboard,
      sources: { ...dashboard.sources, emotions: 'unavailable' },
    })
    const body = await (await GET(request())).json()
    expect(body.narrative).toBe('UNKNOWN')
    expect(body.partial).toBe(true)
  })

  it('keeps the rest and flags partial when screenings cannot be read', async () => {
    care.history.mockRejectedValue(problem(503, 'CARE_UNAVAILABLE'))
    const body = await (await GET(request())).json()
    expect(care.progress).not.toHaveBeenCalled()
    expect(body.partial).toBe(true)
    expect(body.days).toHaveLength(14)
  })

  it('fails the request when the dashboard cannot be read', async () => {
    care.activityDashboard.mockRejectedValue(problem(503, 'CARE_UNAVAILABLE'))
    const response = await GET(request())
    expect(response.status).toBe(503)
  })

  it('returns the authentication failure without calling any source', async () => {
    auth.authenticate.mockRejectedValue(new Error('no session'))
    const response = await GET(request())
    expect(response.status).toBe(401)
    expect(care.activityDashboard).not.toHaveBeenCalled()
    expect(companion.list).not.toHaveBeenCalled()
  })

  it.each([
    'timezone=not%2Fa-timezone',
    'timezone=UTC&timezone=Asia%2FBangkok',
    'timezone=UTC&range=14',
    '',
  ])('rejects invalid query before authentication: %s', async (query) => {
    const response = await GET(request(query))
    expect(response.status).toBe(400)
    expect(auth.authenticate).not.toHaveBeenCalled()
  })
})
