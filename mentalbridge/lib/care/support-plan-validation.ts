import type {
  SupportEvaluationV2,
  SupportPlan,
  SupportPlanDraft,
  SupportPlanHistoryPage,
  SupportPlanOccurrence,
  SupportPlanOccurrenceList,
  SupportPlanReplacementReview,
} from '@/features/support-plan/api/support-plan-contract'
import { isUuid } from './care-validation'
import { parseReassessmentSummary } from './care-validation'

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, max = 4096): value is string {
  return (
    typeof value === 'string' && value.trim().length > 0 && value.length <= max
  )
}

function instant(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function nullableInstant(value: unknown): value is string | null {
  return value === null || instant(value)
}

function localDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function localTime(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value)
  )
}

function resource(value: unknown) {
  if (!object(value)) return false
  return (
    typeof value.resourceId === 'string' &&
    isUuid(value.resourceId) &&
    typeof value.contentVersion === 'string' &&
    /^\d+$/.test(value.contentVersion) &&
    typeof value.publicationId === 'string' &&
    isUuid(value.publicationId) &&
    ['PRIMARY', 'ADJUNCT'].includes(String(value.role)) &&
    text(value.category, 32) &&
    text(value.title, 255) &&
    text(value.summary) &&
    (value.externalUrl === null ||
      value.externalUrl === undefined ||
      (typeof value.externalUrl === 'string' &&
        /^https?:\/\//.test(value.externalUrl)))
  )
}

export function parseSupportPlan(value: unknown): SupportPlan | null {
  if (!object(value) || !isUuid(String(value.supportPlanId))) return null
  const status = String(value.status)
  const lifecycleTimesAreValid =
    nullableInstant(value.completedAt) &&
    nullableInstant(value.supersededAt) &&
    nullableInstant(value.discardedAt) &&
    (value.completionReason === null ||
      ['USER_DECISION', 'PLAN_NO_LONGER_FITS', 'OTHER'].includes(
        String(value.completionReason),
      )) &&
    ((status === 'DRAFT' &&
      value.activatedAt === null &&
      value.completedAt === null &&
      value.completionReason === null &&
      value.supersededAt === null &&
      value.discardedAt === null) ||
      (['ACTIVE', 'PAUSED'].includes(status) &&
        instant(value.activatedAt) &&
        value.completedAt === null &&
        value.completionReason === null &&
        value.supersededAt === null &&
        value.discardedAt === null) ||
      (status === 'COMPLETED' &&
        instant(value.activatedAt) &&
        instant(value.completedAt) &&
        value.supersededAt === null &&
        value.discardedAt === null) ||
      (status === 'SUPERSEDED' &&
        instant(value.activatedAt) &&
        value.completedAt === null &&
        value.completionReason === null &&
        instant(value.supersededAt) &&
        value.discardedAt === null) ||
      (status === 'DISCARDED' &&
        value.activatedAt === null &&
        value.completedAt === null &&
        value.completionReason === null &&
        value.supersededAt === null &&
        instant(value.discardedAt)))
  if (
    ![
      'DRAFT',
      'ACTIVE',
      'PAUSED',
      'COMPLETED',
      'SUPERSEDED',
      'DISCARDED',
    ].includes(String(value.status)) ||
    !Number.isInteger(value.version)
  )
    return null
  if (!object(value.source) || !object(value.entitlement)) return null
  if (!object(value.rationale) || !object(value.safety)) return null
  if (
    !isUuid(String(value.source.supportEvaluationId)) ||
    value.source.evaluationVersion !== 2 ||
    value.source.evaluationPolicyVersion !== 'mb-support-routing-capstone-v2' ||
    value.source.selectionPolicyVersion !== 'mb-support-plan-selection-v1' ||
    value.source.resourceEligibilityPolicyVersion !==
      'content-eligibility-v1' ||
    !instant(value.source.evaluatedAt) ||
    !instant(value.source.resourcesResolvedAt)
  )
    return null
  if (
    !['PLUS', 'PREMIUM'].includes(String(value.entitlement.packageCode)) ||
    !['DEMO', 'PAID'].includes(String(value.entitlement.source)) ||
    value.entitlement.policyVersion !== 'service-entitlement-v1' ||
    !Number.isInteger(value.entitlement.version) ||
    !instant(value.entitlement.decidedAt)
  )
    return null
  if (!text(value.rationale.text, 2048) || !text(value.safety.guidance, 2048))
    return null
  if (
    !Array.isArray(value.templateFamilies) ||
    value.templateFamilies.length < 1 ||
    value.templateFamilies.length > 2
  )
    return null
  if (
    !Array.isArray(value.slots) ||
    value.slots.length < 1 ||
    value.slots.length > 5
  )
    return null
  if (
    !value.slots.every(
      (slot) =>
        object(slot) &&
        text(slot.slotId, 64) &&
        ['CORE', 'OPTIONAL'].includes(String(slot.kind)) &&
        (slot.selectedResource === null || resource(slot.selectedResource)) &&
        (slot.kind !== 'CORE' || resource(slot.selectedResource)) &&
        Array.isArray(slot.allowedAlternatives) &&
        slot.allowedAlternatives.every(resource),
    )
  )
    return null
  if (
    value.selectedResourceCount !==
      value.slots.filter(
        (slot) => object(slot) && slot.selectedResource !== null,
      ).length ||
    value.disclaimerCode !== 'WELLBEING_SUPPORT_NOT_TREATMENT' ||
    !text(value.disclaimer, 1000) ||
    !instant(value.createdAt) ||
    !instant(value.updatedAt) ||
    !lifecycleTimesAreValid
  )
    return null
  return value as SupportPlan
}

export function parseSupportPlanHistoryPage(
  value: unknown,
): SupportPlanHistoryPage | null {
  if (
    !object(value) ||
    !Array.isArray(value.items) ||
    value.items.length > 50 ||
    typeof value.hasMore !== 'boolean' ||
    (value.nextCursor !== null && !text(value.nextCursor, 256)) ||
    (value.hasMore && value.nextCursor === null) ||
    (!value.hasMore && value.nextCursor !== null)
  )
    return null
  const items = value.items.map(parseSupportPlan)
  if (
    items.some(
      (item) =>
        item === null ||
        !['COMPLETED', 'SUPERSEDED', 'DISCARDED'].includes(item.status),
    )
  )
    return null
  return { ...value, items } as SupportPlanHistoryPage
}

export function parseSupportPlanReplacementReview(
  value: unknown,
): SupportPlanReplacementReview | null {
  if (!object(value)) return null
  const currentPlan = parseSupportPlan(value.currentPlan)
  const proposedPlan = parseSupportPlan(value.proposedPlan)
  const reassessmentSummary = parseReassessmentSummary(
    value.reassessmentSummary,
  )
  if (
    !currentPlan ||
    !proposedPlan ||
    !reassessmentSummary ||
    reassessmentSummary.summaryVersion !== 'reassessment-summary-v2' ||
    ![
      'CURRENT_PLAN_VALID_NO_BETTER_ALTERNATIVE',
      'CURRENT_PLAN_VALID_ALTERNATIVES_AVAILABLE',
      'CURRENT_PLAN_NOT_ADMISSIBLE',
    ].includes(String(value.outcome)) ||
    !Array.isArray(value.rationaleCodes) ||
    value.rationaleCodes.length !== 2 ||
    !value.rationaleCodes.every((code) => text(code, 64)) ||
    !Array.isArray(value.comparison) ||
    value.comparison.length < 1 ||
    value.comparison.length > 10 ||
    !value.comparison.every(
      (item) =>
        object(item) &&
        ['UNCHANGED', 'CHANGED', 'ADDED', 'REMOVED'].includes(
          String(item.change),
        ) &&
        (item.currentSlotId === null || text(item.currentSlotId, 64)) &&
        (item.proposedSlotId === null || text(item.proposedSlotId, 64)) &&
        (item.currentResource === null || resource(item.currentResource)) &&
        (item.proposedResource === null || resource(item.proposedResource)),
    ) ||
    !instant(value.reviewedAt)
  )
    return null
  return value as SupportPlanReplacementReview
}

export function parseSupportPlanDraft(value: unknown): SupportPlanDraft | null {
  const plan = parseSupportPlan(value)
  return plan?.status === 'DRAFT' ? plan : null
}

export function parseSupportPlanOccurrence(
  value: unknown,
): SupportPlanOccurrence | null {
  if (!object(value) || !object(value.source)) return null
  const sourceType = String(value.source.type)
  const resourceSource =
    sourceType === 'RESOURCE' &&
    text(value.source.slotId, 64) &&
    isUuid(String(value.source.resourceId)) &&
    typeof value.source.contentVersion === 'string' &&
    /^\d+$/.test(value.source.contentVersion)
  const promptSource =
    ['JOURNAL_PROMPT', 'EMOTION_CHECK_IN_PROMPT'].includes(sourceType) &&
    value.source.slotId === null &&
    value.source.resourceId === null &&
    value.source.contentVersion === null
  if (
    !isUuid(String(value.occurrenceId)) ||
    !isUuid(String(value.supportPlanId)) ||
    !isUuid(String(value.scheduleId)) ||
    !Number.isInteger(value.scheduleVersion) ||
    Number(value.scheduleVersion) < 1 ||
    !localDate(value.localDate) ||
    !localTime(value.localTime) ||
    !text(value.timezone, 64) ||
    !instant(value.scheduledAt) ||
    !['SCHEDULED', 'COMPLETED', 'SKIPPED', 'CANCELLED'].includes(
      String(value.state),
    ) ||
    !['SCHEDULED', 'MISSED', 'COMPLETED', 'SKIPPED', 'CANCELLED'].includes(
      String(value.displayState),
    ) ||
    (value.stateReason !== null &&
      !['PLAN_PAUSED', 'PLAN_COMPLETED', 'PLAN_REPLACED'].includes(
        String(value.stateReason),
      )) ||
    !Number.isInteger(value.version) ||
    Number(value.version) < 0 ||
    !Number.isInteger(value.source.supportPlanVersion) ||
    Number(value.source.supportPlanVersion) < 1 ||
    (!resourceSource && !promptSource) ||
    !text(value.source.title, 255) ||
    !instant(value.updatedAt) ||
    ![value.completedAt, value.skippedAt, value.cancelledAt].every(
      (timestamp) => timestamp === null || instant(timestamp),
    ) ||
    typeof value.hidden !== 'boolean' ||
    (value.helpfulness !== null &&
      !['NOT_HELPFUL', 'A_LITTLE_HELPFUL', 'HELPFUL', 'VERY_HELPFUL'].includes(
        String(value.helpfulness),
      )) ||
    (value.barrierCode !== null &&
      ![
        'LOW_ENERGY',
        'NOT_ENOUGH_TIME',
        'DIFFICULT_TO_START',
        'NOT_A_GOOD_FIT',
        'OTHER',
      ].includes(String(value.barrierCode))) ||
    (value.reflection !== null && !text(value.reflection, 500)) ||
    typeof value.summaryReuseApproved !== 'boolean' ||
    (value.engagementUpdatedAt !== null &&
      !instant(value.engagementUpdatedAt)) ||
    value.interpretationCode !==
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE'
  )
    return null
  return value as SupportPlanOccurrence
}

export function parseSupportPlanOccurrenceList(
  value: unknown,
): SupportPlanOccurrenceList | null {
  if (
    !object(value) ||
    !isUuid(String(value.supportPlanId)) ||
    !['ACTIVE', 'PAUSED'].includes(String(value.supportPlanStatus)) ||
    value.schedulePolicyVersion !== 'support-plan-activity-schedule-v1' ||
    !localDate(value.from) ||
    !localDate(value.through) ||
    !Array.isArray(value.occurrences) ||
    value.occurrences.length > 217 ||
    value.interpretationCode !==
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE'
  )
    return null
  const occurrences = value.occurrences.map(parseSupportPlanOccurrence)
  if (occurrences.some((occurrence) => occurrence === null)) return null
  return { ...value, occurrences } as SupportPlanOccurrenceList
}

export function parseSupportEvaluationV2(
  value: unknown,
): SupportEvaluationV2 | null {
  if (!object(value)) return null
  const contributions = Array.isArray(value.contributingDomains)
    ? value.contributingDomains
    : []
  const validContribution = (contribution: unknown) => {
    if (!object(contribution)) return false
    const instrumentDomain = `${String(contribution.instrument)}:${String(contribution.domain)}`
    return (
      isUuid(String(contribution.assessmentId)) &&
      isUuid(String(contribution.questionnaireDefinitionId)) &&
      ['PHQ9:DEPRESSIVE_SYMPTOMS', 'GAD7:ANXIETY_SYMPTOMS'].includes(
        instrumentDomain,
      ) &&
      text(contribution.questionnaireVersion, 64) &&
      text(contribution.scoringVersion, 64) &&
      ['MINIMAL', 'MILD', 'MODERATE', 'MODERATELY_SEVERE', 'SEVERE'].includes(
        String(contribution.screeningLevel),
      ) &&
      ['SELF_GUIDED_SUPPORT', 'PROFESSIONAL_SUPPORT_RECOMMENDED'].includes(
        String(contribution.supportPathway),
      ) &&
      Array.isArray(contribution.reasonCodes) &&
      contribution.reasonCodes.length >= 1 &&
      contribution.reasonCodes.every(
        (reason) =>
          typeof reason === 'string' &&
          /^(PHQ9|GAD7)_LEVEL_(MINIMAL|MILD|MODERATE|MODERATELY_SEVERE|SEVERE)$/.test(
            reason,
          ),
      )
    )
  }
  const safety = object(value.safetyEvidence) ? value.safetyEvidence : null
  if (
    !isUuid(String(value.supportEvaluationId)) ||
    value.evaluationVersion !== 2 ||
    value.policyVersion !== 'mb-support-routing-capstone-v2' ||
    !instant(value.evaluatedAt) ||
    contributions.length !== 2 ||
    !contributions.every(validContribution) ||
    new Set(
      contributions.map(
        (contribution) =>
          `${String((contribution as Record<string, unknown>).instrument)}:${String((contribution as Record<string, unknown>).domain)}`,
      ),
    ).size !== 2 ||
    !safety ||
    !isUuid(String(safety.sourceAssessmentId)) ||
    safety.instrument !== 'PHQ9' ||
    safety.trigger !== 'PHQ9_ITEM_9' ||
    !['NEGATIVE_SAFETY_SCREEN', 'POSITIVE_SAFETY_SCREEN'].includes(
      String(safety.status),
    ) ||
    !text(safety.policyVersion, 64) ||
    !['PHQ9_ITEM9_NEGATIVE', 'PHQ9_ITEM9_POSITIVE'].includes(
      String(safety.reasonCode),
    ) ||
    value.disclaimerCode !== 'SCREENING_NOT_DIAGNOSIS' ||
    !text(value.disclaimer, 1000)
  )
    return null
  return value as SupportEvaluationV2
}
