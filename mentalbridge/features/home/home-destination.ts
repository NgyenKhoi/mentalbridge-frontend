import type { HomeNextStep } from '@/features/assessment/api/care-contract'
import {
  getResourceDetail,
  type PublicResourceSummary,
} from '@/features/resources/api/browser-resources'
import { getSupportGuide } from '@/features/support-guide/api/browser-support-guide'
import { guideContinuation } from '@/features/support-guide/components/guided-continuation'
import {
  getCurrentSupportPlanActions,
  getSupportPlanActionOccurrences,
} from '@/features/support-plan/api/browser-support-plan-actions'
import { actionDestination } from '@/features/support-plan/workspace/workspace-links'

/** Resolve the owner's selected occurrence through the existing task links. */
export async function homeDestination(home: HomeNextStep): Promise<{
  destination?: string
  remaining?: number
  resourceCategory?: PublicResourceSummary['category']
}> {
  const { journey, plan } = home
  if (journey.nextAction === 'REVIEW_SAFETY_SUPPORT') return {}
  if (journey.stage !== 'GUIDE_READY') return {}
  if (
    journey.nextAction !== 'FIND_SPECIALIST' &&
    plan?.focus === 'DO_TODAY' &&
    plan.nextOccurrence
  ) {
    try {
      const [current, window] = await Promise.all([
        getCurrentSupportPlanActions(),
        getSupportPlanActionOccurrences(plan.localDate, plan.localDate),
      ])
      if (
        current.supportPlanId !== plan.supportPlanId ||
        window.supportPlanId !== plan.supportPlanId
      )
        return { destination: '/support-plan' }
      const occurrence = window.occurrences.find(
        (item) =>
          item.occurrenceId === plan.nextOccurrence?.occurrenceId &&
          item.actionId === plan.nextOccurrence.actionId &&
          item.localDate === plan.localDate,
      )
      const action = current.focuses
        .flatMap((focus) => focus.actions)
        .find((item) => item.actionId === occurrence?.actionId)
      const resource =
        action?.actionType === 'RESOURCE' &&
        action.source?.sourceKind === 'RESOURCE_VERSION' &&
        action.source.sourceRevision
          ? await getResourceDetail(
              action.source.sourceId,
              action.source.sourceRevision,
            ).catch(() => undefined)
          : undefined
      return {
        ...(resource ? { resourceCategory: resource.category } : {}),
        destination:
          occurrence && action
            ? (actionDestination(
                current,
                { occurrence, action },
                plan.localDate,
              )?.href ?? '/support-plan')
            : '/support-plan',
        remaining: window.occurrences.filter(
          (item) =>
            item.localDate === plan.localDate &&
            ['SCHEDULED', 'OVERDUE'].includes(item.displayState),
        ).length,
      }
    } catch {
      // The plan remains a useful destination when task context cannot be read.
      return { destination: '/support-plan' }
    }
  }
  if (
    (!plan || journey.nextAction === 'FIND_SPECIALIST') &&
    journey.supportGuideId &&
    journey.nextAction &&
    [
      'FIND_SPECIALIST',
      'START_PLAN_PROPOSAL',
      'EXPLORE_GUIDE_RESOURCES',
    ].includes(journey.nextAction)
  ) {
    const guideHref = `/support-guides/${encodeURIComponent(journey.supportGuideId)}`
    try {
      const guide = await getSupportGuide(journey.supportGuideId)
      if (guide.supportGuideId !== journey.supportGuideId)
        return { destination: guideHref }
      const target = guideContinuation(journey, guide)?.href
      return {
        destination: target?.startsWith('#')
          ? `${guideHref}${target}`
          : (target ?? guideHref),
      }
    } catch {
      // The saved Guide can still resume its own continuation after a retry.
      return { destination: guideHref }
    }
  }
  return {}
}
