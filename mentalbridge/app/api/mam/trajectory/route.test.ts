import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import { mamCheerable } from '@/features/mam/mam-trajectory-source'
import { makeDashboard, makeProgress } from '@/tests/fixtures/look-back'

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
  new NextRequest(`http://localhost/api/mam/trajectory?${query}`)
const moods = [...Array(7).fill(2), ...Array(7).fill(4)]
const problem = (status: number, code: string) =>
  new ApiError({ message: code, code, status })

describe('/api/mam/trajectory', () => {
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
  })

  it('returns the 14-day level series and the band status, with no text and no companion call', async () => {
    const response = await GET(request())
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(companion.list).not.toHaveBeenCalled()
    expect(Object.keys(body).sort()).toEqual([
      'asOfLocalDate',
      'band',
      'days',
      'narrative',
      'partial',
    ])
    expect(body.days).toHaveLength(14)
    expect(Object.keys(body.days[0]).sort()).toEqual([
      'emotionLevel',
      'localDate',
    ])
    expect(body).toMatchObject({
      narrative: 'IMPROVING',
      partial: false,
      band: { readable: true, moderatePlus: false, transition: 'LOWER' },
    })
  })

  it('flags a moderate-or-higher current band', async () => {
    care.progress.mockResolvedValue(
      makeProgress(
        'PHQ9',
        ['2026-11-10T09:00:00+07:00', 'MILD', 6],
        ['2026-11-21T09:00:00+07:00', 'MODERATE', 11],
      ),
    )
    const body = await (await GET(request())).json()
    expect(body.band).toEqual({
      readable: true,
      moderatePlus: true,
      transition: 'HIGHER',
    })
  })

  it('says the band is unreadable, and the view partial, when Care history fails', async () => {
    care.history.mockRejectedValue(problem(503, 'CARE_UNAVAILABLE'))
    const body = await (await GET(request())).json()
    expect(care.progress).not.toHaveBeenCalled()
    expect(body.band).toEqual({
      readable: false,
      moderatePlus: false,
      transition: null,
    })
    expect(body.partial).toBe(true)
  })

  it('a FIRST moderate screening (nothing to compare) is moderate-or-higher and holds cheering back', async () => {
    care.history.mockResolvedValue({
      items: [
        {
          assessmentId: 'a-only',
          instrument: 'PHQ9',
          result: { screeningLevel: 'MODERATELY_SEVERE' },
          submittedAt: '2026-11-21T09:00:00+07:00',
        },
      ],
      hasMore: false,
    })
    care.progress.mockRejectedValue(
      problem(409, 'INSUFFICIENT_COMPARABLE_DATA'),
    )
    const body = await (await GET(request())).json()
    expect(body.band).toEqual({
      readable: true,
      moderatePlus: true,
      transition: null,
    })
    expect(mamCheerable(body)).toBe(false)
  })

  it('reads the latest band of each instrument even when it is old', async () => {
    care.history.mockResolvedValue({
      items: [
        {
          assessmentId: 'g-old',
          instrument: 'GAD7',
          result: { screeningLevel: 'SEVERE' },
          submittedAt: '2026-08-01T09:00:00+07:00',
        },
      ],
      hasMore: false,
    })
    care.progress.mockRejectedValue(
      problem(409, 'INSUFFICIENT_COMPARABLE_DATA'),
    )
    const body = await (await GET(request())).json()
    expect(body.band.moderatePlus).toBe(true)
  })

  it('reports the band unreadable, never calm, for a level it does not know', async () => {
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
    expect(body.band.readable).toBe(false)
    expect(mamCheerable(body)).toBe(false)
  })

  it('treats a single screening as nothing to compare, still readable', async () => {
    care.progress.mockRejectedValue(
      problem(409, 'INSUFFICIENT_COMPARABLE_DATA'),
    )
    const body = await (await GET(request())).json()
    expect(body.band).toEqual({
      readable: true,
      moderatePlus: false,
      transition: null,
    })
    expect(body.partial).toBe(false)
  })

  it('fails the request when the dashboard cannot be read', async () => {
    care.activityDashboard.mockRejectedValue(problem(503, 'CARE_UNAVAILABLE'))
    expect((await GET(request())).status).toBe(503)
  })

  it('returns the authentication failure without calling any source', async () => {
    auth.authenticate.mockRejectedValue(new Error('no session'))
    expect((await GET(request())).status).toBe(401)
    expect(care.activityDashboard).not.toHaveBeenCalled()
  })

  it.each([
    'timezone=not%2Fa-timezone',
    'timezone=UTC&timezone=Asia%2FBangkok',
    'timezone=UTC&range=14',
    '',
  ])('rejects invalid query before authentication: %s', async (query) => {
    expect((await GET(request(query))).status).toBe(400)
    expect(auth.authenticate).not.toHaveBeenCalled()
  })
})
