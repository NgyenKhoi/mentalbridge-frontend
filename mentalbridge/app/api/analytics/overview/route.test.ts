import { NextRequest, NextResponse } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'

const auth = vi.hoisted(() => ({
  authenticate: vi.fn(),
  authenticationFailure: vi.fn(),
  carrySession: vi.fn(),
}))
const care = vi.hoisted(() => ({
  history: vi.fn(),
  supportPlanOccurrences: vi.fn(),
}))
const consultation = vi.hoisted(() => ({ appointments: vi.fn() }))
const emotion = vi.hoisted(() => ({ progress: vi.fn() }))

vi.mock('@/lib/care/authenticated-user', () => ({
  authenticatedCareUser: auth.authenticate,
  careAuthenticationFailure: auth.authenticationFailure,
  carryCareSession: auth.carrySession,
}))
vi.mock('@/lib/care/care-client', () => ({ careClient: care }))
vi.mock('@/lib/consultation/consultation-client', () => ({
  consultationClient: consultation,
}))
vi.mock('@/lib/emotion-check-in/client', () => ({
  emotionCheckInClient: emotion,
}))

import { GET } from './route'

const request = (timezone = 'Asia/Bangkok') =>
  new NextRequest(
    `http://localhost/api/analytics/overview?timezone=${encodeURIComponent(timezone)}`,
  )

describe('/api/analytics/overview', () => {
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
    emotion.progress.mockResolvedValue({
      currentStreak: 3,
      windows: [
        { days: 7, checkedInDays: 2 },
        { days: 14, checkedInDays: 4 },
        { days: 30, checkedInDays: 8 },
      ],
    })
    care.history.mockResolvedValue({
      items: [
        {
          instrument: 'PHQ9',
          submittedAt: '2026-09-28T03:00:00.000Z',
        },
      ],
      hasMore: true,
    })
    care.supportPlanOccurrences.mockResolvedValue({
      occurrences: [
        { state: 'COMPLETED', displayState: 'COMPLETED' },
        { state: 'SKIPPED', displayState: 'SKIPPED' },
        { state: 'SCHEDULED', displayState: 'MISSED' },
      ],
    })
    consultation.appointments.mockResolvedValue({
      data: {
        count: 2,
        items: [{ status: 'CONFIRMED' }, { status: 'CANCELLED' }],
      },
    })
  })

  it('composes owner-scoped facts without inferring scores or trends', async () => {
    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body).toMatchObject({
      timezone: 'Asia/Bangkok',
      emotion: {
        state: 'available',
        data: { currentStreak: 3, checkedInDays: 8, windowDays: 30 },
      },
      assessments: {
        state: 'available',
        data: {
          count: 1,
          countIsLowerBound: true,
          latestInstrument: 'PHQ9',
        },
      },
      supportActivities: {
        state: 'available',
        data: {
          completedCount: 1,
          skippedCount: 1,
          scheduledOrMissedCount: 1,
        },
      },
      appointments: {
        state: 'available',
        data: { totalCount: 2, activeCount: 1 },
      },
    })
    expect(care.history).toHaveBeenCalledWith(
      'owner-token',
      undefined,
      50,
      expect.any(String),
    )
    expect(emotion.progress).toHaveBeenCalledWith(
      'owner-token',
      'Asia/Bangkok',
      expect.any(String),
    )
  })

  it('keeps failures source-specific and treats a missing plan as empty', async () => {
    emotion.progress.mockRejectedValue(new Error('journal unavailable'))
    care.history.mockRejectedValue(new Error('care unavailable'))
    care.supportPlanOccurrences.mockRejectedValue(
      new ApiError({
        message: 'No current support plan.',
        code: 'SUPPORT_PLAN_CURRENT_NOT_FOUND',
        status: 404,
      }),
    )
    consultation.appointments.mockRejectedValue(
      new Error('consultation unavailable'),
    )

    const response = await GET(request())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.emotion).toEqual({ state: 'unavailable' })
    expect(body.assessments).toEqual({ state: 'unavailable' })
    expect(body.supportActivities).toEqual({ state: 'empty' })
    expect(body.appointments).toEqual({ state: 'unavailable' })
  })

  it('rejects an invalid timezone before authenticating or reading domains', async () => {
    const response = await GET(request('not/a-timezone'))

    expect(response.status).toBe(400)
    expect(auth.authenticate).not.toHaveBeenCalled()
    expect(emotion.progress).not.toHaveBeenCalled()
    expect(care.history).not.toHaveBeenCalled()
    expect(consultation.appointments).not.toHaveBeenCalled()
  })

  it('does not call domain APIs when the owner session is unavailable', async () => {
    auth.authenticate.mockRejectedValue(new Error('no session'))

    const response = await GET(request())

    expect(response.status).toBe(401)
    expect(emotion.progress).not.toHaveBeenCalled()
    expect(care.history).not.toHaveBeenCalled()
    expect(consultation.appointments).not.toHaveBeenCalled()
  })
})
