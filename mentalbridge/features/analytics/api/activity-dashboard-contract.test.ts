import { describe, expect, it } from 'vitest'

import type { AnalyticsRange } from './activity-dashboard-contract'
import { parseActivityDashboard } from './activity-dashboard-contract'

function payload(range: AnalyticsRange = 30) {
  const start = new Date('2026-09-30T00:00:00.000Z')
  start.setUTCDate(start.getUTCDate() - range + 1)
  const daily = Array.from({ length: range }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(date.getUTCDate() + index)
    return {
      localDate: date.toISOString().slice(0, 10),
      assessments: index === 0 ? 1 : 0,
      journals: 0,
      emotions: index === range - 1 ? 1 : 0,
      emotionLevel: index === range - 1 ? 4 : null,
      supportCompleted: 0,
      supportSkipped: 0,
      appointments: 0,
      total: index === 0 || index === range - 1 ? 1 : 0,
    }
  })
  return {
    asOfLocalDate: '2026-09-30',
    startLocalDate: daily[0].localDate,
    timezone: 'Asia/Bangkok',
    summary: {
      totalActivities: 2,
      activeDays: 2,
      assessmentSubmissions: 1,
      journalEntries: 0,
      journalActiveDays: 0,
      emotionCheckIns: 1,
      emotionActiveDays: 1,
      supportCompleted: 0,
      supportSkipped: 0,
      appointmentEvents: 0,
      currentEmotionStreak: 1,
      latestAssessmentInstrument: 'PHQ9',
      latestAssessmentSubmittedAt: `${daily[0].localDate}T03:00:00Z`,
    },
    daily,
    sources: {
      assessments: 'available',
      journals: 'empty',
      emotions: 'available',
      supportPlans: 'empty',
      appointments: 'empty',
    },
    partial: false,
    bounded: {
      windowDays: range,
      assessmentLimit: 50,
      journalLimit: 50,
      emotionLimit: 90,
      appointmentLimit: 100,
    },
  }
}

describe('parseActivityDashboard', () => {
  it.each([7, 30, 90] as const)(
    'accepts a contiguous %s-day aggregate',
    (range) => {
      expect(parseActivityDashboard(payload(range))).not.toBeNull()
    },
  )

  it('rejects private fields and inconsistent totals', () => {
    expect(
      parseActivityDashboard({ ...payload(), journalNote: 'private' }),
    ).toBeNull()
    const inconsistent = payload()
    inconsistent.daily[0].total = 2
    expect(parseActivityDashboard(inconsistent)).toBeNull()
  })

  it('rejects an emotion count without a chart level', () => {
    const invalid = payload()
    invalid.daily.at(-1)!.emotionLevel = null
    expect(parseActivityDashboard(invalid)).toBeNull()
  })
})
