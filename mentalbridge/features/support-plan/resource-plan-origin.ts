import type { ActionOccurrence } from './api/support-plan-contract'
import {
  getCurrentSupportPlanActions,
  getSupportPlanActionOccurrences,
} from './api/browser-support-plan-actions'
import type { EmotionPlanOrigin } from './emotion-plan-origin'
import { localDateIn } from './workspace/workspace-model'

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
