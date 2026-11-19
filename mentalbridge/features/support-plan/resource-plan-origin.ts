import type { ActionOccurrence } from './api/support-plan-contract'
import {
  getCurrentSupportPlanActions,
  getSupportPlanActionOccurrences,
  reconcileResourceOccurrence,
} from './api/browser-support-plan-actions'
import { toApiError } from '@/lib/api/api-error'
import type { EmotionPlanOrigin } from './emotion-plan-origin'
import { localDateIn } from './workspace/workspace-model'

/** Find an open, exact-version resource scheduled for today in the owned plan. */
export async function resolveTodayResourceOccurrence(
  resourceId: string,
  resourceVersion: string,
  now = new Date(),
) {
  let plan
  try {
    plan = await getCurrentSupportPlanActions()
  } catch (error: unknown) {
    if (toApiError(error).status === 404) return null
    throw error
  }
  if (plan.representationMode !== 'NATIVE_V3' || plan.status !== 'ACTIVE')
    return null
  const actions = plan.focuses
    .flatMap((focus) => focus.actions)
    .filter(
      (item) =>
        item.actionType === 'RESOURCE' &&
        item.status === 'ACTIVE' &&
        item.representationMode === 'NATIVE_V3' &&
        item.source?.ownerDomain === 'CONTENT' &&
        item.source.sourceId === resourceId &&
        item.source.sourceRevision === resourceVersion,
    )
  const localDates = actions
    .flatMap((action) =>
      action.schedules.map((schedule) => localDateIn(schedule.timezone, now)),
    )
    .sort()
  if (!localDates.length) return null
  const window = await getSupportPlanActionOccurrences(
    localDates[0],
    localDates[localDates.length - 1],
  )
  if (
    window.supportPlanId !== plan.supportPlanId ||
    window.representationMode !== 'NATIVE_V3' ||
    window.supportPlanStatus !== 'ACTIVE'
  )
    return null
  return (
    window.occurrences.find((occurrence) => {
      if (
        occurrence.actionType !== 'RESOURCE' ||
        occurrence.representationMode !== 'NATIVE_V3' ||
        occurrence.state !== 'SCHEDULED'
      )
        return false
      const action = actions.find(
        (item) => item.actionId === occurrence.actionId,
      )
      return action?.schedules.some(
        (schedule) =>
          schedule.scheduleId === occurrence.scheduleId &&
          schedule.version === occurrence.scheduleVersion &&
          localDateIn(schedule.timezone, now) === occurrence.localDate,
      )
    }) ?? null
  )
}

/** Content's saved version selects the candidate; only Care can complete it. */
export async function reconcileTodayResourceCompletion(
  resourceId: string,
  resourceVersion: string,
  completedDate: string,
) {
  try {
    const occurrence = await resolveTodayResourceOccurrence(
      resourceId,
      resourceVersion,
    )
    if (!occurrence || occurrence.localDate !== completedDate)
      return 'not-applicable'
    const recorded = await reconcileResourceOccurrence(
      occurrence.occurrenceId,
      occurrence.version,
    )
    return hasContentCompletion(recorded) ? 'recorded' : 'not-recorded'
  } catch (error: unknown) {
    // A Content save remains valid when evidence is missing, stale, or unavailable.
    const problem = toApiError(error)
    return [409, 412].includes(problem.status ?? 0)
      ? 'not-recorded'
      : 'unavailable'
  }
}

/** Resolve a navigation hint against the owned plan; opening a Resource proves nothing. */
export async function resolveResourcePlanOrigin(
  origin: EmotionPlanOrigin,
  resourceId: string,
  resourceVersion: string,
  now = new Date(),
) {
  const plan = await getCurrentSupportPlanActions()
  if (plan.representationMode !== 'NATIVE_V3' || plan.status !== 'ACTIVE')
    return null
  const window = await getSupportPlanActionOccurrences(
    origin.localDate,
    origin.localDate,
  )
  if (
    window.supportPlanId !== plan.supportPlanId ||
    window.representationMode !== 'NATIVE_V3'
  )
    return null
  const occurrence = window.occurrences.find(
    (item) =>
      item.occurrenceId === origin.occurrenceId &&
      item.actionId === origin.actionId &&
      item.actionType === 'RESOURCE' &&
      item.representationMode === 'NATIVE_V3' &&
      item.localDate === origin.localDate &&
      ['SCHEDULED', 'COMPLETED'].includes(item.state),
  )
  const action = plan.focuses
    .flatMap((focus) => focus.actions)
    .find(
      (item) =>
        item.actionId === origin.actionId &&
        item.actionType === 'RESOURCE' &&
        item.status === 'ACTIVE' &&
        item.representationMode === 'NATIVE_V3' &&
        item.source?.ownerDomain === 'CONTENT' &&
        item.source.sourceId === resourceId &&
        item.source.sourceRevision === resourceVersion,
    )
  const schedule = action?.schedules.find(
    (item) =>
      item.scheduleId === occurrence?.scheduleId &&
      item.version === occurrence.scheduleVersion,
  )
  if (!occurrence || !schedule) return null
  const today = localDateIn(schedule.timezone, now)
  return occurrence.localDate === today ? occurrence : null
}

export function hasContentCompletion(occurrence: ActionOccurrence) {
  const evidence = occurrence.completionEvidence
  return (
    occurrence.actionType === 'RESOURCE' &&
    occurrence.state === 'COMPLETED' &&
    evidence?.ownerDomain === 'CONTENT' &&
    ['RESOURCE_PRACTICE_SESSION', 'RESOURCE_COMPLETION'].includes(evidence.kind)
  )
}
