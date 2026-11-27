import { describe, expect, it } from 'vitest'
import type { EmotionCheckIn } from '@/lib/emotion-check-in/contract'
import { homeEmotionWeek } from './emotion-week'

function record(localDate: string): EmotionCheckIn {
  return {
    id: '40000000-0000-4000-8000-000000000001',
    localDate,
    timezone: 'Asia/Ho_Chi_Minh',
    emotion: 'GOOD',
    intensity: 4,
    factors: [],
    note: null,
    sourceLabel: 'SELF_REPORTED_EMOTION',
    clinicalUse: 'NOT_A_DIAGNOSIS_OR_SAFETY_CLASSIFIER',
    revision: 1,
    recordedAt: '2026-10-22T02:00:00Z',
    createdAt: '2026-10-22T02:00:00Z',
    updatedAt: '2026-10-22T02:00:00Z',
  }
}

describe('homeEmotionWeek', () => {
  it('ends at the authoritative local date and crosses month/year boundaries', () => {
    const days = homeEmotionWeek('2027-01-03', [])
    expect(days.map((day) => day.localDate)).toEqual([
      '2026-12-28',
      '2026-12-29',
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
      '2027-01-03',
    ])
    expect(days.map((day) => day.label)).toEqual([
      'T2',
      'T3',
      'T4',
      'T5',
      'T6',
      'T7',
      'Nay',
    ])
    expect(days.filter((day) => day.today)).toHaveLength(1)
  })

  it('keeps missing days empty and ignores records outside the window', () => {
    const days = homeEmotionWeek('2026-10-22', [
      record('2026-10-21'),
      record('2026-10-18'),
      record('2026-10-10'),
    ])
    expect(days.filter((day) => day.emotion)).toHaveLength(2)
    expect(days[5].emotion).toBe('GOOD')
    expect(days[6].emotion).toBeNull()
  })

  it('renders all seven records and supports an entirely empty week', () => {
    const dates = homeEmotionWeek('2026-10-22', []).map((day) => day.localDate)
    expect(
      homeEmotionWeek('2026-10-22', dates.map(record)).every(
        (day) => day.emotion === 'GOOD',
      ),
    ).toBe(true)
    expect(
      homeEmotionWeek('2026-10-22', []).every((day) => day.emotion === null),
    ).toBe(true)
  })
})
