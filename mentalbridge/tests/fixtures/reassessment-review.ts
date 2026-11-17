// Shared by the ReassessmentReview unit tests and the reassessment-review E2E spec.
import type {
  ReassessmentContext,
  ReassessmentSummary,
} from '../../features/assessment/api/care-contract'

export const DAY = 86_400_000
export const end = Date.UTC(
  new Date().getUTCFullYear(),
  new Date().getUTCMonth(),
  new Date().getUTCDate(),
)
const iso = (ms: number) => new Date(ms).toISOString()
export const previousPeriod = {
  startAt: iso(end - 28 * DAY),
  endAt: iso(end - 14 * DAY),
}
export const currentPeriod = { startAt: iso(end - 14 * DAY), endAt: iso(end) }

export const context: ReassessmentContext = {
  policyVersion: 'reassessment-comparison-v1',
  state: 'READY',
  missingInstruments: [],
  phq9AssessmentId: '10000000-0000-4000-8000-000000000001',
  gad7AssessmentId: '10000000-0000-4000-8000-000000000002',
  previousPeriod,
  currentPeriod,
}

export const job = {
  jobId: '30000000-0000-4000-8000-000000000001',
  status: 'SUCCEEDED' as const,
}
export const runningJob = { ...job, status: 'RUNNING' as const }

export const report = {
  selfReportId: '20000000-0000-4000-8000-000000000001',
  sourceVersion: 'reassessment-self-report-v1' as const,
  currentPeriod,
  currentExperience: 'BETTER' as const,
  helpfulContext: 'Đi bộ buổi tối.',
  difficultContext: null,
  version: 0,
  authoredAt: iso(end),
  updatedAt: iso(end),
}

const point = (id: string, score: number, level: string) => ({
  assessmentId: id,
  questionnaireVersion: 'v1',
  submittedAt: iso(end - DAY),
  totalScore: score,
  screeningLevel: level,
})

export function makeSummary(overrides: Record<string, unknown> = {}) {
  return {
    summaryId: '40000000-0000-4000-8000-000000000001',
    summaryVersion: 'reassessment-summary-v2',
    composedAt: iso(end),
    previousPeriod,
    currentPeriod,
    screening: {
      state: 'AVAILABLE',
      trends: [
        {
          instrument: 'PHQ9',
          state: 'AVAILABLE',
          scoringVersion: 'v1',
          previous: point('p0', 14, 'MODERATE'),
          current: point(context.phq9AssessmentId!, 8, 'MILD'),
          rawDelta: -6,
          direction: 'DECREASED',
        },
        {
          instrument: 'GAD7',
          state: 'AVAILABLE',
          scoringVersion: 'v1',
          previous: point('g0', 11, 'MODERATE'),
          current: point(context.gad7AssessmentId!, 7, 'MILD'),
          rawDelta: -4,
          direction: 'DECREASED',
        },
      ],
    },
    journalContext: {
      state: 'AVAILABLE',
      unavailableReason: null,
      jobId: job.jobId,
      analysisId: '50000000-0000-4000-8000-000000000001',
      sourceJournalRevisions: [],
      contextSignals: [],
      emotionIndicators: [],
      recurringThemes: ['Công việc'],
      changesComparedWithPreviousPeriod: [
        { signal: 'Áp lực công việc', direction: 'LESS_FREQUENT' },
        { signal: 'Giấc ngủ', direction: 'SIMILAR' },
        { signal: 'Ẩn', direction: 'INSUFFICIENT_DATA' },
      ],
      preferences: [],
      barriers: [],
      helpfulPatterns: ['Đi bộ'],
      dataCoverage: {
        previousPeriodJournalEntryCount: 4,
        currentPeriodJournalEntryCount: 5,
        sufficientForComparison: true,
      },
      provenance: null,
    },
    supportPlanEngagement: {
      state: 'AVAILABLE',
      previousPeriod: { completedCount: 2, skippedCount: 3 },
      currentPeriod: { completedCount: 6, skippedCount: 2 },
      sources: [
        {
          occurrenceId: '70000000-0000-4000-8000-000000000001',
          supportPlanId: '80000000-0000-4000-8000-000000000001',
          sourcePlanVersion: 1,
          sourceSlotId: null,
          sourceResourceId: '60000000-0000-4000-8000-000000000001',
          sourceContentVersion: 1,
          scheduledAt: iso(end - 3 * DAY),
          period: 'CURRENT',
          state: 'COMPLETED',
          barrierCode: null,
        },
        {
          occurrenceId: '70000000-0000-4000-8000-000000000002',
          supportPlanId: '80000000-0000-4000-8000-000000000001',
          sourcePlanVersion: 1,
          sourceSlotId: null,
          sourceResourceId: null,
          sourceContentVersion: null,
          scheduledAt: iso(end - 2 * DAY),
          period: 'CURRENT',
          state: 'SKIPPED',
          barrierCode: 'NOT_ENOUGH_TIME',
        },
      ],
    },
    selfReportedExperience: {
      state: 'INSUFFICIENT_DATA',
      unavailableReason: 'NOT_PROVIDED',
      source: null,
    },
    activityReflection: {
      state: 'AVAILABLE',
      sources: [
        {
          occurrenceId: '70000000-0000-4000-8000-000000000001',
          period: 'CURRENT',
          helpfulness: 'VERY_HELPFUL',
          reflection: 'Thở xong thấy nhẹ người.',
          engagementUpdatedAt: iso(end - 3 * DAY),
        },
      ],
    },
    disclaimerCode: 'FOUR_DIMENSIONS_NOT_COMBINED',
    ...overrides,
  } as unknown as ReassessmentSummary
}

export function dashboard(levels: Array<number | null>) {
  // 28 days ending yesterday (UTC), oldest first.
  const dates = levels.map((_, index) =>
    iso(end - (levels.length - index) * DAY).slice(0, 10),
  )
  return {
    daily: dates.map((localDate, index) => ({
      localDate,
      emotionLevel: levels[index],
      emotions: levels[index] ? 1 : 0,
    })),
    sources: { emotions: 'available' },
    partial: false,
  }
}
