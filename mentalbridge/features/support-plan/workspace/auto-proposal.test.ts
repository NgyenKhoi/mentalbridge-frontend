import { describe, expect, it } from 'vitest'
import type { GuidedJourney } from '@/features/assessment/api/care-contract'
import { nativeSupportPlanFixture } from '../testing/native-support-plan-fixture'
import { autoProposalKey, shouldAutoPropose } from './auto-proposal'

function journey(overrides: Partial<GuidedJourney> = {}): GuidedJourney {
  return {
    journeyPolicyVersion: 'mb-guided-journey-v1',
    stage: 'GUIDE_READY',
    assessmentInProgress: false,
    episodeId: '80000000-0000-4000-8000-000000000669',
    episodeCompletedAt: '2026-10-17T01:00:00Z',
    presentationEvaluationId: '90000000-0000-4000-8000-000000000669',
    supportGuideId: 'a0000000-0000-4000-8000-000000000669',
    nextAction: 'START_PLAN_PROPOSAL',
    currentSupportPlanId: null,
    entitlementStatus: 'VERIFIED',
    ...overrides,
  }
}

describe('auto-proposal rule', () => {
  it('key is deterministic per evaluation and revision', () => {
    expect(autoProposalKey('eval-1', 0)).toBe('auto-proposal-eval-1-p0')
    expect(autoProposalKey('eval-1', 0)).toBe(autoProposalKey('eval-1', 0))
    expect(autoProposalKey('eval-1', 2)).not.toBe(autoProposalKey('eval-1', 0))
  })

  it('proposes for a first-time user with a ready guide, including specialist-first journeys', () => {
    expect(
      shouldAutoPropose({ hadPlanBefore: false, journey: journey() }),
    ).toBe(true)
    expect(
      shouldAutoPropose({
        hadPlanBefore: false,
        journey: journey({ nextAction: 'FIND_SPECIALIST' }),
      }),
    ).toBe(true)
  })

  it('never when a plan or draft exists', () => {
    const plan = nativeSupportPlanFixture()
    expect(
      shouldAutoPropose({
        current: plan,
        hadPlanBefore: false,
        journey: journey(),
      }),
    ).toBe(false)
    expect(
      shouldAutoPropose({
        draft: plan,
        hadPlanBefore: false,
        journey: journey(),
      }),
    ).toBe(false)
  })

  it('never after a previous plan', () => {
    expect(shouldAutoPropose({ hadPlanBefore: true, journey: journey() })).toBe(
      false,
    )
  })

  it('never without a completed screening or when the journey is unavailable', () => {
    expect(
      shouldAutoPropose({
        hadPlanBefore: false,
        journey: journey({ stage: 'ASSESSMENT_REQUIRED', nextAction: null }),
      }),
    ).toBe(false)
    expect(shouldAutoPropose({ hadPlanBefore: false, journey: null })).toBe(
      false,
    )
  })

  it('never when journey next is REVIEW_SAFETY_SUPPORT', () => {
    expect(
      shouldAutoPropose({
        hadPlanBefore: false,
        journey: journey({ nextAction: 'REVIEW_SAFETY_SUPPORT' }),
      }),
    ).toBe(false)
  })
})
