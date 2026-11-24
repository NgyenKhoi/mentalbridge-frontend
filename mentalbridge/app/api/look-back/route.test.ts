import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'
import {
  conversation,
  makeDashboard,
  makeProgress,
} from '@/tests/fixtures/look-back'
import { makeSummary } from '@/tests/fixtures/reassessment-review'

const auth = vi.hoisted(() => ({
  authenticate: vi.fn(),
  authenticationFailure: vi.fn(),
  carrySession: vi.fn(),
}))
const care = vi.hoisted(() => ({
  activityDashboard: vi.fn(),
  history: vi.fn(),
  progress: vi.fn(),
  reassessmentSummaryHistory: vi.fn(),
}))
const plans = vi.hoisted(() => ({ current: vi.fn() }))
const companion = vi.hoisted(() => ({ list: vi.fn() }))
const consultation = vi.hoisted(() => ({ appointments: vi.fn() }))

vi.mock('@/lib/care/authenticated-user', () => ({
  authenticatedCareUser: auth.authenticate,
  careAuthenticationFailure: auth.authenticationFailure,
  carryCareSession: auth.carrySession,
}))
vi.mock('@/lib/care/care-client', () => ({ careClient: care }))
vi.mock('@/lib/care/support-plan-action-client', () => ({
  supportPlanActionClient: plans,
}))
vi.mock('@/lib/companion/companion-client', () => ({
  companionClient: companion,
}))
vi.mock('@/lib/consultation/consultation-client', () => ({
  consultationClient: consultation,
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
    consultation.appointments.mockResolvedValue({ data: { items: [] } })
    care.reassessmentSummaryHistory.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
    })
    plans.current.mockRejectedValue(problem(404, 'SUPPORT_PLAN_NOT_FOUND'))
  })

  it('composes one owner-scoped view from the 90-day dashboard, screenings and conversations', async () => {
    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(care.activityDashboard).toHaveBeenCalledWith(
      'owner-token',
      'Asia/Ho_Chi_Minh',
      90,
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
    expect(consultation.appointments).toHaveBeenCalledWith(
      'owner-token',
      expect.any(String),
    )
  })

  it('counts only completed sessions that ended in the 14-day local window', async () => {
    consultation.appointments.mockResolvedValue({
      data: {
        items: [
          { status: 'COMPLETED', sessionEndedAt: '2026-11-20T09:00:00+07:00' },
          { status: 'REQUESTED', sessionEndedAt: null },
          { status: 'COMPLETED', sessionEndedAt: '2026-10-20T09:00:00+07:00' },
        ],
      },
    })
    const body = await (await GET(request())).json()
    expect(body.completedSessions).toBe(1)
  })

  it('keeps the look-back usable when the consultation list cannot load', async () => {
    consultation.appointments.mockRejectedValue(new Error('unavailable'))
    const body = await (await GET(request())).json()
    expect(body.completedSessions).toBeNull()
    expect(body.partial).toBe(true)
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

  describe('journey', () => {
    const chapter = makeSummary({
      summaryId: 'sum-1',
      composedAt: '2026-11-03T09:00:00+07:00',
      currentPeriod: {
        startAt: '2026-10-20T09:00:00+07:00',
        endAt: '2026-11-03T09:00:00+07:00',
      },
    })
    const cycle = {
      policyVersion: 'support-plan-cycle-v1',
      lengthDays: 14,
      timezone: 'Asia/Ho_Chi_Minh',
      cycleNumber: 2,
      startedOn: '2026-11-17',
      reviewDueOn: '2026-11-30',
      currentDay: 6,
      pausedDays: 0,
      state: 'IN_PROGRESS',
    }

    it('returns the chapters and the running cycle, and looks back only over the cycle days', async () => {
      care.reassessmentSummaryHistory.mockResolvedValue({
        items: [chapter],
        nextCursor: null,
        hasMore: false,
      })
      plans.current.mockResolvedValue({ supportPlanId: 'p1', cycle })
      const body = await (await GET(request())).json()
      expect(care.reassessmentSummaryHistory).toHaveBeenCalledWith(
        'owner-token',
        undefined,
        50,
        expect.any(String),
      )
      expect(body.journey.chapters).toMatchObject([
        { number: 1, summaryId: 'sum-1' },
      ])
      expect(body.journey.running).toMatchObject({
        number: 2,
        startLocalDate: '2026-11-17',
        currentDay: 6,
      })
      expect(
        body.days.map((day: { localDate: string }) => day.localDate),
      ).toEqual([
        '2026-11-17',
        '2026-11-18',
        '2026-11-19',
        '2026-11-20',
        '2026-11-21',
        '2026-11-22',
      ])
      expect(body.partial).toBe(false)
    })

    // 27/10 to 9/11 local: inside the 30-day test dashboard (24/10 to 22/11).
    const inside = makeSummary({
      summaryId: 'sum-in',
      composedAt: '2026-11-10T00:00:00+07:00',
      currentPeriod: {
        startAt: '2026-10-27T00:00:00+07:00',
        endAt: '2026-11-10T00:00:00+07:00',
      },
    })
    const withChapter = () =>
      care.reassessmentSummaryHistory.mockResolvedValue({
        items: [inside],
        nextCursor: null,
        hasMore: false,
      })
    const dates = (body: { days: { localDate: string }[] }) =>
      body.days.map((day) => day.localDate)

    it('opens the newest closed chapter with its own days and summary screening when no cycle runs', async () => {
      withChapter()
      const body = await (await GET(request())).json()
      expect(body.startLocalDate).toBe('2026-10-27')
      expect(body.asOfLocalDate).toBe('2026-11-09')
      expect(dates(body)).toHaveLength(14)
      // The chapter's summary, not the latest assessments (a-new / a-old).
      expect(body.screening).toMatchObject([
        {
          instrument: 'PHQ9',
          direction: 'LOWER',
          previous: { level: 'MODERATE', score: 14 },
          current: { level: 'MILD', score: 8 },
        },
        { instrument: 'GAD7', direction: 'LOWER' },
      ])
      expect(body.conversations).toEqual([])
    })

    it('looks at a chapter asked for by from and to', async () => {
      withChapter()
      plans.current.mockResolvedValue({ supportPlanId: 'p1', cycle })
      const body = await (
        await GET(
          request('timezone=Asia%2FHo_Chi_Minh&from=2026-10-27&to=2026-11-09'),
        )
      ).json()
      expect(body.startLocalDate).toBe('2026-10-27')
      expect(body.asOfLocalDate).toBe('2026-11-09')
      expect(body.journey.running.number).toBe(2)
      expect(body.screening[0].current.score).toBe(8)
    })

    it('composes an arbitrary valid window with the screening read from the assessments', async () => {
      const body = await (
        await GET(
          request('timezone=Asia%2FHo_Chi_Minh&from=2026-11-10&to=2026-11-14'),
        )
      ).json()
      expect(dates(body)).toEqual([
        '2026-11-10',
        '2026-11-11',
        '2026-11-12',
        '2026-11-13',
        '2026-11-14',
      ])
    })

    it('has no running chapter without a plan, and is not partial for it', async () => {
      const body = await (await GET(request())).json()
      expect(body.journey).toMatchObject({ chapters: [], running: null })
      expect(body.days).toHaveLength(14)
      expect(body.partial).toBe(false)
    })

    it('keeps the rolling look-back and says part is missing when the summaries fail', async () => {
      care.reassessmentSummaryHistory.mockRejectedValue(
        problem(503, 'CARE_UNAVAILABLE'),
      )
      const body = await (await GET(request())).json()
      expect(body.journey).toBeNull()
      expect(body.partial).toBe(true)
      expect(body.days).toHaveLength(14)
    })

    it('keeps the chapters without a running one when the plan cannot be read', async () => {
      care.reassessmentSummaryHistory.mockResolvedValue({
        items: [chapter],
        nextCursor: null,
        hasMore: false,
      })
      plans.current.mockRejectedValue(problem(503, 'CARE_UNAVAILABLE'))
      const body = await (await GET(request())).json()
      expect(body.journey).toMatchObject({
        chapters: [{ number: 1 }],
        running: null,
      })
      expect(body.partial).toBe(true)
    })
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
    'from=2026-11-10',
    'to=2026-11-14',
    'from=2026-11-14&to=2026-11-10',
    'from=2026-11-31&to=2026-12-02',
    'from=11-10-2026&to=2026-11-14',
    'from=2026-10-24&to=2026-11-24',
    'from=2026-11-10&from=2026-11-11&to=2026-11-14',
  ])(
    'rejects the bad chapter window %s before authentication',
    async (window) => {
      const response = await GET(request(`timezone=UTC&${window}`))
      expect(response.status).toBe(400)
      expect(auth.authenticate).not.toHaveBeenCalled()
    },
  )

  it.each([
    // before the first day of the 90-day activity window (here 24/10)
    'from=2026-10-01&to=2026-10-14',
    // after today (22/11)
    'from=2026-11-20&to=2026-11-25',
  ])('rejects the window %s outside the activity days', async (window) => {
    const response = await GET(request(`timezone=Asia%2FHo_Chi_Minh&${window}`))
    expect(response.status).toBe(400)
  })

  it('accepts a window as wide as the activity days', async () => {
    const response = await GET(
      request(
        'timezone=Asia%2FHo_Chi_Minh&from=2026-10-24&to=2026-11-23'.replace(
          '11-23',
          '11-22',
        ),
      ),
    )
    expect(response.status).toBe(200)
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
