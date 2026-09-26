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
