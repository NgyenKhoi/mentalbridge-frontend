import { describe, expect, it } from 'vitest'

import type { ActivityDashboard } from '@/features/analytics/api/activity-dashboard-contract'

import { buildAnalytics } from './analytics'

function events(): ActivityDashboard {
  const daily = Array.from({ length: 7 }, (_, index) => ({
    localDate: `2026-09-${String(24 + index).padStart(2, '0')}`,
    assessments: index === 0 ? 2 : 0,
    journals: index === 1 ? 1 : 0,
    emotions: index >= 4 ? 1 : 0,
    emotionLevel: index >= 4 ? index - 1 : null,
    supportCompleted: index === 2 ? 1 : 0,
    supportSkipped: index === 3 ? 1 : 0,
    appointments: index === 0 ? 1 : 0,
    total:
      (index === 0 ? 3 : 0) +
      (index === 1 ? 1 : 0) +
      (index >= 4 ? 1 : 0) +
      (index === 2 || index === 3 ? 1 : 0),
  }))
  return {
    asOfLocalDate: '2026-09-30',
    startLocalDate: '2026-09-24',
    timezone: 'Asia/Bangkok',
    summary: {
      totalActivities: 9,
      activeDays: 7,
      assessmentSubmissions: 2,
      journalEntries: 1,
      journalActiveDays: 1,
      emotionCheckIns: 3,
      emotionActiveDays: 3,
      supportCompleted: 1,
      supportSkipped: 1,
      appointmentEvents: 1,
      currentEmotionStreak: 3,
      latestAssessmentInstrument: 'GAD7',
      latestAssessmentSubmittedAt: '2026-09-24T03:00:00Z',
    },
    daily,
    sources: {
      assessments: 'available',
      journals: 'available',
      emotions: 'available',
      supportPlans: 'available',
      appointments: 'available',
    },
    partial: false,
    bounded: {
      windowDays: 7,
      assessmentLimit: 50,
      journalLimit: 50,
      emotionLimit: 90,
      appointmentLimit: 100,
    },
  }
}

describe('buildAnalytics', () => {
  it('builds one internally consistent view model', () => {
    const result = buildAnalytics(events(), 7)

    expect(result.total).toBe(9)
    expect(result.byKind).toEqual({
      assessments: 2,
      journals: 1,
      emotions: 3,
      support: 2,
      appointments: 1,
    })
    expect(result.supportCompleted).toBe(1)
    expect(result.supportSkipped).toBe(1)
    expect(result.emotionSeries).toHaveLength(7)
  })

  it('rejects a response for another range', () => {
    expect(() => buildAnalytics(events(), 30)).toThrow(/selected range/)
  })
})
