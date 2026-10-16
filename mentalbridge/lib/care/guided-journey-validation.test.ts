import { describe, expect, it } from 'vitest'

import { parseGuidedJourney } from './guided-journey-validation'

const ready = {
  journeyPolicyVersion: 'mb-guided-journey-v1',
  stage: 'GUIDE_READY',
  assessmentInProgress: false,
  episodeId: '10000000-0000-4000-8000-000000000668',
  episodeCompletedAt: '2026-10-16T03:00:00.123456Z',
  presentationEvaluationId: '20000000-0000-4000-8000-000000000668',
  supportGuideId: '30000000-0000-4000-8000-000000000668',
  nextAction: 'START_PLAN_PROPOSAL',
  currentSupportPlanId: null,
  entitlementStatus: 'VERIFIED',
} as const

describe('parseGuidedJourney', () => {
  it('accepts the Care pointer and drops unknown fields', () => {
    expect(parseGuidedJourney({ ...ready, rawAnswers: [1, 2] })).toEqual(ready)
  })

  it('accepts the no-completed-check state with only null context', () => {
    expect(
      parseGuidedJourney({
        ...ready,
        stage: 'ASSESSMENT_REQUIRED',
        assessmentInProgress: true,
        episodeId: null,
        episodeCompletedAt: null,
        presentationEvaluationId: null,
        supportGuideId: null,
        nextAction: null,
        entitlementStatus: 'NOT_REQUIRED',
      }),
    ).toMatchObject({ stage: 'ASSESSMENT_REQUIRED', nextAction: null })
  })

  it.each([
    ['unknown policy', { journeyPolicyVersion: 'mb-guided-journey-v2' }],
    ['unknown action', { nextAction: 'BOOK_APPOINTMENT' }],
    ['ready without a Guide', { supportGuideId: null }],
    ['Guide while still required', { stage: 'GUIDE_REQUIRED' }],
    ['completed stage without an action', { nextAction: null }],
    ['completed stage without an episode', { episodeId: null }],
    ['assessment stage with context', { stage: 'ASSESSMENT_REQUIRED' }],
    ['malformed identifier', { currentSupportPlanId: 'plan-1' }],
    ['malformed time', { episodeCompletedAt: '16/10/2026' }],
    ['unknown entitlement state', { entitlementStatus: 'PLUS' }],
    ['non-boolean progress flag', { assessmentInProgress: 'false' }],
    [
      'a proposal despite unverified entitlement',
      { entitlementStatus: 'UNAVAILABLE' },
    ],
    [
      'a proposal while a current plan exists',
      { currentSupportPlanId: '60000000-0000-4000-8000-000000000668' },
    ],
    [
      'a plan action without a plan',
      { nextAction: 'OPEN_CURRENT_PLAN', entitlementStatus: 'NOT_REQUIRED' },
    ],
    [
      'a verified entitlement with a non-entitlement action',
      { nextAction: 'FIND_SPECIALIST' },
    ],
  ])('rejects %s', (_label, override) => {
    expect(parseGuidedJourney({ ...ready, ...override })).toBeNull()
  })
})
