import { describe, expect, it } from 'vitest'

import type { GuidedJourney } from '@/features/assessment/api/care-contract'
import type { SupportGuide } from '../api/support-guide-contract'
import { guideContinuation, isCurrentJourneyGuide } from './guided-continuation'

const guideId = '30000000-0000-4000-8000-000000000668'

function journey(
  nextAction: GuidedJourney['nextAction'],
  supportGuideId: string | null = guideId,
): GuidedJourney {
  return {
    journeyPolicyVersion: 'mb-guided-journey-v1',
    stage: supportGuideId ? 'GUIDE_READY' : 'GUIDE_REQUIRED',
    assessmentInProgress: false,
    episodeId: '10000000-0000-4000-8000-000000000668',
    episodeCompletedAt: '2026-10-16T03:00:00Z',
    presentationEvaluationId: '20000000-0000-4000-8000-000000000668',
    supportGuideId,
    nextAction,
    currentSupportPlanId: null,
    entitlementStatus: 'NOT_REQUIRED',
  }
}

function guide(resourceCount: number): SupportGuide {
  return {
    supportGuideId: guideId,
    resources: Array.from({ length: resourceCount }),
  } as unknown as SupportGuide
}

describe('guideContinuation', () => {
  it.each([
    [
      'FIND_SPECIALIST',
      `/specialists?from=support-guide&supportGuideId=${guideId}`,
    ],
    ['OPEN_CURRENT_PLAN', '/support-plan'],
    ['REVIEW_PLAN_DRAFT', '/support-plan'],
    ['START_PLAN_PROPOSAL', '/support-plan'],
  ] as const)('navigates %s to its owner route', (action, href) => {
    expect(guideContinuation(journey(action), guide(1))?.href).toBe(href)
  })

  it('leaves safety support as the only primary step', () => {
    expect(
      guideContinuation(journey('REVIEW_SAFETY_SUPPORT'), guide(2)),
    ).toBeNull()
  })

  it('opens the Guide exact resources first and the library only when none were saved', () => {
    expect(
      guideContinuation(journey('EXPLORE_GUIDE_RESOURCES'), guide(2))?.href,
    ).toBe('#support-guide-resources')
    expect(
      guideContinuation(journey('EXPLORE_GUIDE_RESOURCES'), guide(0)),
    ).toEqual({ href: '/resources', label: 'Khám phá thư viện tài nguyên' })
  })

  it('treats only the Care-pointed Guide as the current journey', () => {
    expect(isCurrentJourneyGuide(journey('FIND_SPECIALIST'), guide(1))).toBe(
      true,
    )
    expect(
      isCurrentJourneyGuide(journey('FIND_SPECIALIST', null), guide(1)),
    ).toBe(false)
    expect(isCurrentJourneyGuide(null, guide(1))).toBe(false)
  })
})
