import { describe, expect, it } from 'vitest'

import {
  parseEmotionCheckIn,
  parseEmotionCreate,
  parseEmotionList,
} from './validation'

const checkIn = {
  id: '40000000-0000-4000-8000-000000000001',
  localDate: '2026-09-17',
  timezone: 'Asia/Ho_Chi_Minh',
  emotion: 'GOOD',
  intensity: 4,
  note: 'synthetic note',
  sourceLabel: 'SELF_REPORTED_EMOTION',
  clinicalUse: 'NOT_A_DIAGNOSIS_OR_SAFETY_CLASSIFIER',
  revision: 1,
  recordedAt: '2026-09-16T17:30:00.000Z',
  createdAt: '2026-09-16T17:30:00.000Z',
  updatedAt: '2026-09-16T17:30:00.000Z',
}

describe('emotion check-in contract validation', () => {
  it('accepts the reviewed create and response vocabulary', () => {
    expect(
      parseEmotionCreate({
        localDate: '2026-09-17',
        timezone: 'Asia/Ho_Chi_Minh',
        emotion: 'GOOD',
        intensity: 4,
        note: null,
      }),
    ).not.toBeNull()
    expect(parseEmotionCheckIn(checkIn)).toEqual(checkIn)
    expect(
      parseEmotionList({
        items: [checkIn],
        page: { limit: 7, hasMore: false },
        label: 'SELF_REPORTED_EMOTION',
        interpretation: 'NOT_DIAGNOSIS_OR_RECOVERY',
      }),
    ).not.toBeNull()
  })

  it('rejects unsupported values and clinical label drift', () => {
    expect(
      parseEmotionCreate({
        localDate: '2026-09-17',
        timezone: 'Asia/Ho_Chi_Minh',
        emotion: 'ANXIOUS',
        intensity: 4,
      }),
    ).toBeNull()
    expect(parseEmotionCheckIn({ ...checkIn, intensity: 6 })).toBeNull()
    expect(
      parseEmotionCheckIn({ ...checkIn, sourceLabel: 'RECOVERY_SCORE' }),
    ).toBeNull()
  })
})
