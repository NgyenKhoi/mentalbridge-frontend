import {
  create,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios'

import { createEmotionApi } from './emotion-api'

const checkIn = {
  id: '11111111-1111-4111-8111-111111111111',
  localDate: '2026-10-07',
  timezone: 'Asia/Ho_Chi_Minh',
  emotion: 'GOOD',
  intensity: 4,
  note: null,
  sourceLabel: 'SELF_REPORTED_EMOTION',
  clinicalUse: 'NOT_A_DIAGNOSIS_OR_SAFETY_CLASSIFIER',
  revision: 1,
  recordedAt: '2026-10-07T01:00:00.000Z',
  createdAt: '2026-10-07T01:00:00.000Z',
  updatedAt: '2026-10-07T01:00:00.000Z',
} as const

describe('Journal mobile emotion API contract', () => {
  it('creates only the current owner check-in fields and idempotency header', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      return {
        config: request,
        data: checkIn,
        headers: {},
        status: 201,
        statusText: 'Created',
      }
    }
    const api = createEmotionApi(create({ adapter }))

    await api.createCheckIn(
      {
        localDate: '2026-10-07',
        timezone: 'Asia/Ho_Chi_Minh',
        emotion: 'GOOD',
        intensity: 4,
        note: null,
      },
      '22222222-2222-4222-8222-222222222222',
    )

    expect(requests[0]?.url).toBe('/api/v1/emotion-check-ins')
    expect(requests[0]?.headers.get('Idempotency-Key')).toBe(
      '22222222-2222-4222-8222-222222222222',
    )
    const body = JSON.parse(String(requests[0]?.data))
    expect(body).toEqual({
      localDate: '2026-10-07',
      timezone: 'Asia/Ho_Chi_Minh',
      emotion: 'GOOD',
      intensity: 4,
      note: null,
    })
    expect(body).not.toHaveProperty('accountId')
    expect(body).not.toHaveProperty('ownerAccountId')
    expect(body).not.toHaveProperty('actorId')
    expect(body).not.toHaveProperty('averageMood')
    expect(body).not.toHaveProperty('score')
  })

  it('uses revision-aware same-day update and owner deletion paths', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const adapter: AxiosAdapter = async (request) => {
      requests.push(request)
      return request.method === 'delete'
        ? {
            config: request,
            data: {
              localDate: '2026-10-07',
              deleted: true,
              deletedAt: '2026-10-07T02:00:00.000Z',
            },
            headers: {},
            status: 200,
            statusText: 'OK',
          }
        : {
            config: request,
            data: { ...checkIn, emotion: 'GREAT', intensity: 5, revision: 2 },
            headers: {},
            status: 200,
            statusText: 'OK',
          }
    }
    const api = createEmotionApi(create({ adapter }))

    await api.updateCheckIn(
      '2026-10-07',
      1,
      { emotion: 'GREAT', intensity: 5, note: null },
      '33333333-3333-4333-8333-333333333333',
    )
    await api.deleteCheckIn(
      '2026-10-07',
      '44444444-4444-4444-8444-444444444444',
    )

    expect(requests[0]?.url).toBe('/api/v1/emotion-check-ins/2026-10-07')
    expect(requests[0]?.headers.get('If-Match-Revision')).toBe('1')
    expect(JSON.parse(String(requests[0]?.data))).toEqual({
      emotion: 'GREAT',
      intensity: 5,
      note: null,
    })
    expect(requests[1]?.method).toBe('delete')
    expect(requests[1]?.url).toBe('/api/v1/emotion-check-ins/2026-10-07')
    expect(requests[1]?.headers.get('Idempotency-Key')).toBe(
      '44444444-4444-4444-8444-444444444444',
    )
  })

  it('rejects invented progress windows and inconsistent factual counts', async () => {
    const adapter: AxiosAdapter = async (request) => ({
      config: request,
      data: {
        asOfLocalDate: '2026-10-07',
        timezone: 'Asia/Ho_Chi_Minh',
        currentEmotion: 'GOOD',
        currentStreak: 2,
        longestStreak: 3,
        windows: [7, 14, 90].map((days) => ({
          days,
          startLocalDate: '2026-09-01',
          endLocalDate: '2026-10-07',
          checkedInDays: 1,
          totalDays: days,
          distribution: {
            GREAT: 0,
            GOOD: 1,
            OKAY: 0,
            LOW: 0,
            VERY_LOW: 0,
          },
        })),
        label: 'SELF_REPORTED_EMOTION',
        interpretation: 'FACTUAL_COUNTS_NOT_DIAGNOSIS_OR_RECOVERY',
      },
      headers: {},
      status: 200,
      statusText: 'OK',
    })

    await expect(
      createEmotionApi(create({ adapter })).getProgress('Asia/Ho_Chi_Minh'),
    ).rejects.toBeDefined()
  })
})
