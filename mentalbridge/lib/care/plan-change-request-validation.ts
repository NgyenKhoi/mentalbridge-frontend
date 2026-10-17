import type { PlanChangeRequest } from '@/features/support-plan/api/support-plan-contract'
import { isUuid } from './care-validation'

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function instant(value: unknown) {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function resource(value: unknown) {
  return (
    object(value) &&
    isUuid(value.resourceId) &&
    typeof value.resourceVersion === 'string' &&
    /^\d+$/.test(value.resourceVersion) &&
    typeof value.title === 'string' &&
    value.title.length > 0 &&
    value.title.length <= 255
  )
}

export function parsePlanChangeRequest(
  value: unknown,
): PlanChangeRequest | null {
  if (!object(value)) return null
  if (
    !isUuid(value.requestId) ||
    !Number.isSafeInteger(value.version) ||
    Number(value.version) < 0 ||
    !['READY_FOR_REVIEW', 'ACCEPTED', 'REJECTED'].includes(
      String(value.status),
    ) ||
    !['PROPOSAL_ADMISSIBLE', 'PROPOSAL_APPLIED', 'USER_REJECTED'].includes(
      String(value.outcomeCode),
    ) ||
    !isUuid(value.sourceProposalId) ||
    !isUuid(value.sourceAppointmentId) ||
    !isUuid(value.sourceSummaryId) ||
    !isUuid(value.specialistId) ||
    ![
      'POST_CONSULTATION_CONTINUITY',
      'TRY_ALTERNATIVE_RESOURCE',
      'ADDRESS_REPORTED_BARRIER',
    ].includes(String(value.proposalReasonCode)) ||
    !(
      value.proposalDetails === null ||
      typeof value.proposalDetails === 'string'
    ) ||
    typeof value.targetSlotId !== 'string' ||
    !(value.currentResource === null || resource(value.currentResource)) ||
    !resource(value.proposedResource) ||
    !isUuid(value.currentSupportPlanId) ||
    !Number.isSafeInteger(value.currentSupportPlanVersion) ||
    Number(value.currentSupportPlanVersion) < 0 ||
    !(
      value.replacementSupportPlanId === null ||
      isUuid(value.replacementSupportPlanId)
    ) ||
    !(
      value.replacementSupportPlanVersion === null ||
      (Number.isSafeInteger(value.replacementSupportPlanVersion) &&
        Number(value.replacementSupportPlanVersion) >= 0)
    ) ||
    !instant(value.reviewedAt) ||
    !(value.decidedAt === null || instant(value.decidedAt)) ||
    !instant(value.createdAt) ||
    !instant(value.updatedAt)
  )
    return null
  return value as PlanChangeRequest
}
