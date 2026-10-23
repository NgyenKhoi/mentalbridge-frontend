import { describe, expect, it } from 'vitest'

import type { HomeNextStep } from '@/features/assessment/api/care-contract'
import { isHomeTimeZone, parseHomeNextStep } from './home-next-step-validation'

const journey = {
  journeyPolicyVersion: 'mb-guided-journey-v1',
  stage: 'GUIDE_READY',
  assessmentInProgress: false,
  episodeId: '10000000-0000-4000-8000-000000000672',
  episodeCompletedAt: '2026-10-22T03:00:00.123456Z',
  presentationEvaluationId: '20000000-0000-4000-8000-000000000672',
  supportGuideId: '30000000-0000-4000-8000-000000000672',
  nextAction: 'OPEN_CURRENT_PLAN',
  currentSupportPlanId: '40000000-0000-4000-8000-000000000672',
  entitlementStatus: 'NOT_REQUIRED',
} as const
const plan = {
  supportPlanId: journey.currentSupportPlanId,
  status: 'ACTIVE',
  focus: 'DO_TODAY',
  reviewDueOn: '2026-11-04',
  cycleDay: 6,
  cycleLengthDays: 14,
  localDate: '2026-10-22',
  timeZone: 'Asia/Bangkok',
  today: { total: 2, completed: 1 },
  nextOccurrence: {
    occurrenceId: '50000000-0000-4000-8000-000000000672',
    actionId: 'native-action-or-adapter-slot',
    actionType: 'RESOURCE',
    title: 'Dành thời gian thở chậm',
    displayState: 'SCHEDULED',
    scheduledAt: '2026-10-22T05:00:00Z',
    estimatedDurationMinutes: 5,
  },
} as const
const home: HomeNextStep = {
  homePolicyVersion: 'mb-home-next-step-v1',
  journey,
  plan,
  lastCompletedPlan: null,
}

describe('parseHomeNextStep', () => {
  it('accepts explicit null cycle fields for a plan without a cycle', () => {
    const value = {
      ...home,
      plan: { ...plan, cycleDay: null, cycleLengthDays: null },
    }
    expect(parseHomeNextStep(value)).toEqual(value)
  })
  it('accepts the owned next step and projects only contract fields at every level', () => {
    expect(
      parseHomeNextStep({
        ...home,
        rawAnswers: [1, 2],
        journey: { ...journey, scores: [10, 5] },
        plan: {
          ...plan,
          emotionData: 'private',
          today: { ...plan.today, streak: 10 },
          nextOccurrence: { ...plan.nextOccurrence, journalBody: 'private' },
        },
      }),
    ).toEqual(home)
  })

  it.each([
    'RESUME_PAUSED',
    'REVIEW_DUE',
    'TODAY_DONE',
    'NOTHING_TODAY',
  ] as const)(
    'accepts Care focus %s without deriving it from counts',
    (focus) => {
      const value = {
        ...home,
        plan: {
          ...plan,
          status: focus === 'RESUME_PAUSED' ? 'PAUSED' : 'ACTIVE',
          focus,
          nextOccurrence: null,
        },
      }
      expect(parseHomeNextStep(value)).toEqual(value)
    },
  )

  it('accepts the first-use state without a plan', () => {
    const value = {
      ...home,
      journey: {
        ...journey,
        stage: 'ASSESSMENT_REQUIRED',
        episodeId: null,
        episodeCompletedAt: null,
        presentationEvaluationId: null,
        supportGuideId: null,
        currentSupportPlanId: null,
        nextAction: null,
      },
      plan: null,
    }
    expect(parseHomeNextStep(value)).toEqual(value)
  })

  it('accepts last completed plan and drops its unknown fields', () => {
    const completed = {
      supportPlanId: '60000000-0000-4000-8000-000000000672',
      completedAt: '2026-10-21T03:00:00Z',
    }
    const value = {
      ...home,
      journey: {
        ...journey,
        nextAction: 'EXPLORE_GUIDE_RESOURCES',
        currentSupportPlanId: null,
        entitlementStatus: 'VERIFIED',
      },
      plan: null,
      lastCompletedPlan: completed,
    }
    expect(
      parseHomeNextStep({
        ...value,
        lastCompletedPlan: { ...completed, reflection: 'private' },
      }),
    ).toEqual(value)
  })

  it.each([
    ['unknown policy', { homePolicyVersion: 'mb-home-next-step-v2' }],
    ['missing journey', { journey: undefined }],
    ['invalid embedded journey', { journey: { ...journey, stage: 'OTHER' } }],
    ['missing plan field', { plan: undefined }],
    ['invalid plan type', { plan: [] }],
    ['missing last-completed field', { lastCompletedPlan: undefined }],
    [
      'invalid completed plan ID',
      {
        lastCompletedPlan: {
          supportPlanId: 'p',
          completedAt: '2026-10-22T03:00:00Z',
        },
      },
    ],
    [
      'invalid completed time',
      {
        lastCompletedPlan: {
          supportPlanId: journey.currentSupportPlanId,
          completedAt: 'yesterday',
        },
      },
    ],
  ])('rejects %s', (_label, override) => {
    expect(parseHomeNextStep({ ...home, ...override })).toBeNull()
  })

  it.each([
    ['invalid plan ID', { supportPlanId: 'plan' }],
    ['draft plan', { status: 'DRAFT' }],
    ['unknown focus', { focus: 'DO_NEXT_WEEK' }],
    ['invalid review date', { reviewDueOn: '2026-02-30' }],
    ['missing cycle day', { cycleDay: undefined }],
    ['fractional cycle day', { cycleDay: 1.5 }],
    ['string cycle day', { cycleDay: '6' }],
    ['missing cycle length', { cycleLengthDays: undefined }],
    ['fractional cycle length', { cycleLengthDays: 14.5 }],
    ['invalid local date', { localDate: '2026-13-01' }],
    ['invalid time zone', { timeZone: 'Mars/Olympus' }],
    ['missing today', { today: undefined }],
    ['fractional total', { today: { total: 1.5, completed: 0 } }],
    ['negative total', { today: { total: -1, completed: 0 } }],
    ['negative completed', { today: { total: 2, completed: -1 } }],
    ['excess completed', { today: { total: 2, completed: 3 } }],
    ['missing occurrence field', { nextOccurrence: undefined }],
    ['open focus without an occurrence', { nextOccurrence: null }],
    ['closed focus with an open occurrence', { focus: 'TODAY_DONE' }],
  ])('rejects %s', (_label, override) => {
    expect(
      parseHomeNextStep({ ...home, plan: { ...plan, ...override } }),
    ).toBeNull()
  })

  it.each([
    ['invalid occurrence ID', { occurrenceId: 'o' }],
    ['missing action ID', { actionId: '' }],
    ['unknown action type', { actionType: 'EXERCISE' }],
    ['blank title', { title: ' ' }],
    ['closed occurrence', { displayState: 'COMPLETED' }],
    ['invalid time', { scheduledAt: 'today' }],
    ['fractional duration', { estimatedDurationMinutes: 1.5 }],
    ['negative duration', { estimatedDurationMinutes: -5 }],
  ])('rejects %s', (_label, override) => {
    expect(
      parseHomeNextStep({
        ...home,
        plan: {
          ...plan,
          nextOccurrence: { ...plan.nextOccurrence, ...override },
        },
      }),
    ).toBeNull()
  })

  it('accepts nullable occurrence metadata', () => {
    expect(
      parseHomeNextStep({
        ...home,
        plan: {
          ...plan,
          reviewDueOn: null,
          nextOccurrence: {
            ...plan.nextOccurrence,
            scheduledAt: null,
            estimatedDurationMinutes: null,
          },
        },
      }),
    ).not.toBeNull()
  })

  it('rejects a completed-plan pointer while a current or draft plan exists', () => {
    const lastCompletedPlan = {
      supportPlanId: '60000000-0000-4000-8000-000000000672',
      completedAt: '2026-10-21T03:00:00Z',
    }
    expect(parseHomeNextStep({ ...home, lastCompletedPlan })).toBeNull()
    expect(
      parseHomeNextStep({
        ...home,
        plan: null,
        journey: { ...journey, nextAction: 'REVIEW_PLAN_DRAFT' },
        lastCompletedPlan,
      }),
    ).toBeNull()
  })
})

describe('isHomeTimeZone', () => {
  it.each(['Asia/Bangkok', 'Asia/Ho_Chi_Minh', 'UTC', 'America/New_York'])(
    'accepts IANA time zone %s',
    (value) => expect(isHomeTimeZone(value)).toBe(true),
  )
  it.each(['', ' Asia/Bangkok', 'Mars/Olympus', '+07:00', null, 7])(
    'rejects invalid query time zone %s',
    (value) => expect(isHomeTimeZone(value)).toBe(false),
  )
})
