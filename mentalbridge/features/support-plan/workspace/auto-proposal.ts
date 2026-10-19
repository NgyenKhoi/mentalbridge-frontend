import type { GuidedJourney } from '@/features/assessment/api/care-contract'
import type { SupportPlanV3 } from '../api/support-plan-contract'

/** Same evaluation + same saved preferences replays the same Care draft. */
export function autoProposalKey(
  evaluationId: string,
  personalizationRevision: number,
) {
  return `auto-proposal-${evaluationId}-p${personalizationRevision}`
}

/**
 * Only a first-time user with a completed screening gets a proposal without
 * asking; Care still decides eligibility (FREE answers 403) and every action.
 */
export function shouldAutoPropose({
  current,
  draft,
  hadPlanBefore,
  journey,
}: Readonly<{
  current?: SupportPlanV3
  draft?: SupportPlanV3
  hadPlanBefore: boolean
  journey?: GuidedJourney | null
}>) {
  return (
    !current &&
    !draft &&
    !hadPlanBefore &&
    journey?.stage === 'GUIDE_READY' &&
    journey.nextAction !== 'REVIEW_SAFETY_SUPPORT'
  )
}
