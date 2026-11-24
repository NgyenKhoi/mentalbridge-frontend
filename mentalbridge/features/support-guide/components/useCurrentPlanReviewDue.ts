import { useEffect, useState } from 'react'

import type { GuidedJourney } from '@/features/assessment/api/care-contract'
import { getCurrentSupportPlanActions } from '@/features/support-plan/api/browser-support-plan-actions'

/** Whether the current plan's cycle is REVIEW_DUE; read only when the journey continues to that plan. */
export function useCurrentPlanReviewDue(journey: GuidedJourney | null) {
  const wanted = journey?.nextAction === 'OPEN_CURRENT_PLAN'
  const [due, setDue] = useState(false)
  useEffect(() => {
    if (!wanted) return
    let active = true
    getCurrentSupportPlanActions().then(
      (plan) => active && setDue(plan.cycle?.state === 'REVIEW_DUE'),
      () => {}, // The plain plan link stays when the plan cannot be read.
    )
    return () => {
      active = false
    }
  }, [wanted])
  return wanted && due
}
