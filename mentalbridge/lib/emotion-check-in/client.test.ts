// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { emotionCheckInClient } from './client'

const baseUrl = 'http://journal.test'
const localDate = '2026-09-16'
const timestamp = '2026-09-16T03:00:00.000Z'
const checkIn = {
  id: '40000000-0000-4000-8000-000000000001',
  localDate,
  timezone: 'Asia/Ho_Chi_Minh',
  emotion: 'GOOD' as const,
  intensity: 4,
  note: 'Synthetic note',
  sourceLabel: 'SELF_REPORTED_EMOTION' as const,
  clinicalUse: 'NOT_A_DIAGNOSIS_OR_SAFETY_CLASSIFIER' as const,
  revision: 1,
  recordedAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
}

describe('Emotion check-in server-only client', () => {
  const fetchMock = vi.fn<typeof fetch>()

  beforeEach(() => vi.stubGlobal('fetch', fetchMock))
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  function configure(timeout = '5000') {
    vi.stubEnv('JOURNAL_AI_SERVICE_URL', baseUrl)
    vi.stubEnv('JOURNAL_AI_SERVICE_TIMEOUT_MS', timeout)
  }

  it('forwards authorization, idempotency, revision, and correlation headers', async () => {
    configure()
    fetchMock.mockResolvedValue(
      Response.json(checkIn, {
        headers: { 'content-type': 'application/json' },
      }),
    )

    await expect(
      emotionCheckInClient.update(
        'access-token',
        localDate,
        1,
        { emotion: 'GOOD', intensity: 4, note: 'Synthetic note' },
        'update-key',
        'correlation-id',
      ),
    ).resolves.toEqual(checkIn)

    expect(fetchMock).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]!
    expect(String(url)).toBe(`${baseUrl}/api/v1/emotion-check-ins/${localDate}`)
    expect(init?.method).toBe('PATCH')
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer access-token',
      'Idempotency-Key': 'update-key',
      'If-Match-Revision': '1',
      'X-Correlation-Id': 'correlation-id',
    })
  })

  it('preserves a documented provider conflict', async () => {
    configure()
    fetchMock.mockResolvedValue(
      Response.json(
        {
          type: '/problems/conflict',
          title: 'Conflict',
          status: 409,
          code: 'CONFLICT',
          correlationId: 'provider-correlation',
        },
        {
          status: 409,
          headers: { 'content-type': 'application/problem+json' },
        },
      ),
    )

    await expect(
      emotionCheckInClient.create(
        'token',
        {
          localDate,
          timezone: 'Asia/Ho_Chi_Minh',
          emotion: 'GOOD',
          intensity: 4,
          note: null,
        },
        'create-key',
        'correlation-id',
      ),
    ).rejects.toMatchObject({ code: 'CONFLICT', status: 409 })
  })

  it('distinguishes a failed read from an ambiguous failed mutation', async () => {
    configure()
    fetchMock.mockRejectedValue(new TypeError('synthetic dependency failure'))

    await expect(
      emotionCheckInClient.list('token', undefined, 7, 'correlation-id'),
    ).rejects.toMatchObject({
      code: 'EMOTION_CHECK_IN_UNAVAILABLE',
      status: 503,
    })
    await expect(
      emotionCheckInClient.create(
        'token',
        {
          localDate,
          timezone: 'Asia/Ho_Chi_Minh',
          emotion: 'GOOD',
          intensity: 4,
          note: null,
        },
        'create-key',
        'correlation-id',
      ),
    ).rejects.toMatchObject({
      code: 'EMOTION_CHECK_IN_MUTATION_OUTCOME_UNKNOWN',
      status: 503,
    })
  })
})
