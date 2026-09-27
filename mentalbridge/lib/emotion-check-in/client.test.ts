import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mockServer } from '@/tests/mocks/server'
import { emotionCheckInClient } from './client'

const baseUrl = 'http://journal.test'
const localDate = '2026-09-26'
const timestamp = '2026-09-26T02:00:00.000Z'
const checkIn = {
  id: '40000000-0000-4000-8000-000000000001',
  localDate,
  timezone: 'Asia/Ho_Chi_Minh',
  emotion: 'GOOD' as const,
  intensity: 4,
  note: null,
  sourceLabel: 'SELF_REPORTED_EMOTION' as const,
  clinicalUse: 'NOT_A_DIAGNOSIS_OR_SAFETY_CLASSIFIER' as const,
  revision: 1,
  recordedAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
}
const distribution = { GREAT: 0, GOOD: 1, OKAY: 0, LOW: 0, VERY_LOW: 0 }
const progress = {
  asOfLocalDate: localDate,
  timezone: 'Asia/Ho_Chi_Minh',
  currentEmotion: 'GOOD' as const,
  currentStreak: 2,
  longestStreak: 4,
  windows: [7, 14, 30].map((days) => ({
    days,
    startLocalDate: '2026-09-20',
    endLocalDate: localDate,
    checkedInDays: 1,
    totalDays: days,
    distribution,
  })),
  label: 'SELF_REPORTED_EMOTION' as const,
  interpretation: 'FACTUAL_COUNTS_NOT_DIAGNOSIS_OR_RECOVERY' as const,
}

describe('Emotion check-in server-only client', () => {
  afterEach(() => vi.unstubAllEnvs())

  function configure() {
    vi.stubEnv('JOURNAL_AI_SERVICE_URL', baseUrl)
    vi.stubEnv('JOURNAL_AI_SERVICE_TIMEOUT_MS', '5000')
  }

  it('loads the exact local day with the server-held credential', async () => {
    configure()
    mockServer.use(
      http.get(
        `${baseUrl}/api/v1/emotion-check-ins/${localDate}`,
        ({ request }) => {
          expect(request.headers.get('authorization')).toBe(
            'Bearer access-token',
          )
          expect(request.headers.get('x-correlation-id')).toBe('correlation-id')
          return HttpResponse.json(checkIn)
        },
      ),
    )

    await expect(
      emotionCheckInClient.get('access-token', localDate, 'correlation-id'),
    ).resolves.toEqual(checkIn)
  })

  it('loads validated history and authoritative timezone-anchored progress', async () => {
    configure()
    mockServer.use(
      http.get(`${baseUrl}/api/v1/emotion-check-ins`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('limit')).toBe('30')
        return HttpResponse.json({
          items: [checkIn],
          page: { limit: 30, hasMore: false },
          label: 'SELF_REPORTED_EMOTION',
          interpretation: 'NOT_DIAGNOSIS_OR_RECOVERY',
        })
      }),
      http.get(`${baseUrl}/api/v1/emotion-check-in-progress`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('timezone')).toBe(
          'Asia/Ho_Chi_Minh',
        )
        return HttpResponse.json(progress)
      }),
    )

    await expect(
      emotionCheckInClient.list('access-token', 30, 'correlation-id'),
    ).resolves.toMatchObject({ items: [checkIn] })
    await expect(
      emotionCheckInClient.progress(
        'access-token',
        'Asia/Ho_Chi_Minh',
        'correlation-id',
      ),
    ).resolves.toMatchObject({ currentStreak: 2, longestStreak: 4 })
  })

  it('rejects malformed progress whose distribution does not match coverage', async () => {
    configure()
    mockServer.use(
      http.get(`${baseUrl}/api/v1/emotion-check-in-progress`, () =>
        HttpResponse.json({
          ...progress,
          windows: progress.windows.map((window) => ({
            ...window,
            checkedInDays: 2,
          })),
        }),
      ),
    )

    await expect(
      emotionCheckInClient.progress('token', 'UTC', 'correlation'),
    ).rejects.toMatchObject({
      code: 'EMOTION_CHECK_IN_MALFORMED_RESPONSE',
      status: 502,
    })
  })

  it('forwards idempotency and exact revision only at the provider boundary', async () => {
    configure()
    const value = { emotion: 'LOW' as const, intensity: 3, note: null }
    mockServer.use(
      http.patch(
        `${baseUrl}/api/v1/emotion-check-ins/${localDate}`,
        async ({ request }) => {
          expect(request.headers.get('authorization')).toBe(
            'Bearer access-token',
          )
          expect(request.headers.get('idempotency-key')).toBe(
            'emotion-command-00000001',
          )
          expect(request.headers.get('if-match-revision')).toBe('1')
          expect(await request.json()).toEqual(value)
          return HttpResponse.json({ ...checkIn, ...value, revision: 2 })
        },
      ),
    )

    await expect(
      emotionCheckInClient.update(
        'access-token',
        localDate,
        1,
        value,
        'emotion-command-00000001',
        'correlation-id',
      ),
    ).resolves.toMatchObject({ emotion: 'LOW', revision: 2 })
  })

  it('distinguishes documented rejection from an ambiguous mutation response', async () => {
    configure()
    const create = {
      localDate,
      timezone: 'Asia/Ho_Chi_Minh',
      emotion: 'GOOD' as const,
      intensity: 4,
      note: null,
    }
    mockServer.use(
      http.post(`${baseUrl}/api/v1/emotion-check-ins`, () =>
        HttpResponse.json(
          {
            type: '/problems/conflict',
            title: 'Conflict',
            status: 409,
            code: 'CONFLICT',
            correlationId: 'provider-correlation',
          },
          { status: 409 },
        ),
      ),
    )
    await expect(
      emotionCheckInClient.create(
        'token',
        create,
        'emotion-command-00000001',
        'correlation',
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT', status: 409 })

    mockServer.use(
      http.post(`${baseUrl}/api/v1/emotion-check-ins`, () =>
        HttpResponse.json({ id: checkIn.id }),
      ),
    )
    await expect(
      emotionCheckInClient.create(
        'token',
        create,
        'emotion-command-00000002',
        'correlation',
      ),
    ).rejects.toMatchObject({
      code: 'EMOTION_CHECK_IN_MUTATION_OUTCOME_UNKNOWN',
      status: 503,
    })
  })
})
