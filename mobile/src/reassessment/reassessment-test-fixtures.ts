import { makeReassessmentSummary } from '@/support-plan/support-plan-test-fixtures'

export function makeMobileReassessmentSummary() {
  const base = makeReassessmentSummary()
  const point = (instrument: 'PHQ9' | 'GAD7', suffix: string) => ({
    assessmentId: `${instrument === 'PHQ9' ? '10000000' : '20000000'}-0000-4000-8000-000000000${suffix}`,
    questionnaireVersion: `${instrument.toLowerCase()}-v1`,
    submittedAt: '2026-10-07T00:00:00.000Z',
    totalScore: instrument === 'PHQ9' ? 5 : 6,
    screeningLevel: 'MILD',
  })
  return {
    ...base,
    screening: {
      state: 'AVAILABLE' as const,
      trends: [
        {
          instrument: 'PHQ9' as const,
          state: 'AVAILABLE' as const,
          scoringVersion: 'phq9-standard-v1',
          previous: point('PHQ9', '663'),
          current: point('PHQ9', '664'),
          rawDelta: -2,
          direction: 'DECREASED' as const,
        },
        {
          instrument: 'GAD7' as const,
          state: 'AVAILABLE' as const,
          scoringVersion: 'gad7-standard-v1',
          previous: point('GAD7', '663'),
          current: point('GAD7', '664'),
          rawDelta: 0,
          direction: 'UNCHANGED' as const,
        },
      ],
    },
    selfReportedExperience: {
      state: 'AVAILABLE' as const,
      unavailableReason: null,
      source: {
        selfReportId: '30000000-0000-4000-8000-000000000664',
        sourceVersion: 'reassessment-self-report-v1' as const,
        sourceRevision: 0,
        currentPeriod: base.currentPeriod,
        currentExperience: 'BETTER' as const,
        helpfulContext: null,
        difficultContext: null,
        authoredAt: '2026-10-07T01:00:00.000Z',
        updatedAt: '2026-10-07T01:00:00.000Z',
      },
    },
    activityReflection: {
      state: 'INSUFFICIENT_DATA' as const,
      sources: [],
    },
  }
}
