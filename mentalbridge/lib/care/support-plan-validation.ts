import type {
  SupportEvaluationV2,
  SupportPlan,
  SupportPlanDraft,
  SupportPlanHistoryPage,
  SupportPlanOccurrence,
  SupportPlanOccurrenceList,
  SupportPlanReplacementReview,
  SupportPlanV3,
  SupportPlanPersonalization,
  ReplaceSupportPlanPersonalizationRequest,
} from '@/features/support-plan/api/support-plan-contract'
import type {
  ValidationResult,
  ValidationViolation,
} from '@/lib/auth/identity-validation'
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

const PERSONALIZATION_FOCUSES = [
  'ANXIETY',
  'MOOD',
  'SLEEP',
  'MOTIVATION',
  'UNDERSTANDING_EMOTIONS',
] as const
const PERSONALIZATION_PACES = ['GENTLE', 'BALANCED', 'ACTIVE'] as const
const PERSONALIZATION_DAYPARTS = [
  'MORNING',
  'AFTERNOON',
  'EVENING',
  'FLEXIBLE',
] as const
const PERSONALIZATION_MODES = [
  'READING',
  'GUIDED_PRACTICE',
  'JOURNALING',
  'EMOTION_CHECK_IN',
  'ROUTINE',
] as const
const PERSONALIZATION_BARRIERS = [
  'LOW_ENERGY',
  'LIMITED_TIME',
  'DIFFICULT_TO_START',
] as const

function isNullableEnum(value: unknown, values: readonly string[]) {
  return value === undefined || value === null || values.includes(String(value))
}

function isUniqueEnumArray(
  value: unknown,
  values: readonly string[],
  maxItems: number,
) {
  return (
    Array.isArray(value) &&
    value.length <= maxItems &&
    new Set(value).size === value.length &&
    value.every((item) => typeof item === 'string' && values.includes(item))
  )
}

export function validateSupportPlanPersonalizationReplacement(
  value: unknown,
): ValidationResult<ReplaceSupportPlanPersonalizationRequest> {
  if (!object(value)) {
    return {
      success: false,
      violations: [{ field: 'body', code: 'INVALID_TYPE' }],
    }
  }

  const violations: ValidationViolation[] = []
  const allowedKeys = new Set([
    'preferredFocus',
    'desiredPace',
    'dailyTimeBudgetMinutes',
    'preferredDaypart',
    'preferredActivityModes',
    'commonBarriers',
  ])
  if (Object.keys(value).some((key) => !allowedKeys.has(key)))
    violations.push({ field: 'body', code: 'UNKNOWN_FIELD' })
  if (!isNullableEnum(value.preferredFocus, PERSONALIZATION_FOCUSES))
    violations.push({ field: 'preferredFocus', code: 'INVALID_VALUE' })
  if (!isNullableEnum(value.desiredPace, PERSONALIZATION_PACES))
    violations.push({ field: 'desiredPace', code: 'INVALID_VALUE' })
  if (
    value.dailyTimeBudgetMinutes !== undefined &&
    value.dailyTimeBudgetMinutes !== null &&
    ![5, 10, 15, 20, 30].includes(Number(value.dailyTimeBudgetMinutes))
  )
    violations.push({ field: 'dailyTimeBudgetMinutes', code: 'INVALID_VALUE' })
  if (!isNullableEnum(value.preferredDaypart, PERSONALIZATION_DAYPARTS))
    violations.push({ field: 'preferredDaypart', code: 'INVALID_VALUE' })
  if (
    !isUniqueEnumArray(value.preferredActivityModes, PERSONALIZATION_MODES, 5)
  )
    violations.push({ field: 'preferredActivityModes', code: 'INVALID_VALUE' })
  if (!isUniqueEnumArray(value.commonBarriers, PERSONALIZATION_BARRIERS, 3))
    violations.push({ field: 'commonBarriers', code: 'INVALID_VALUE' })

  if (violations.length > 0) return { success: false, violations }
  return {
    success: true,
    value: {
      preferredFocus: (value.preferredFocus ??
        null) as ReplaceSupportPlanPersonalizationRequest['preferredFocus'],
      desiredPace: (value.desiredPace ??
        null) as ReplaceSupportPlanPersonalizationRequest['desiredPace'],
      dailyTimeBudgetMinutes: (value.dailyTimeBudgetMinutes ??
        null) as ReplaceSupportPlanPersonalizationRequest['dailyTimeBudgetMinutes'],
      preferredDaypart: (value.preferredDaypart ??
        null) as ReplaceSupportPlanPersonalizationRequest['preferredDaypart'],
      preferredActivityModes:
        value.preferredActivityModes as ReplaceSupportPlanPersonalizationRequest['preferredActivityModes'],
      commonBarriers:
        value.commonBarriers as ReplaceSupportPlanPersonalizationRequest['commonBarriers'],
    },
  }
}

export function parseSupportPlanPersonalization(
  value: unknown,
): SupportPlanPersonalization | null {
  if (!object(value) || !object(value.planReview)) return null
  const validId =
    value.personalizationId === null || isUuid(String(value.personalizationId))
  const validSubmittedAt =
    value.submittedAt === null || instant(value.submittedAt)
  const validPlanId =
    value.planReview.supportPlanId === null ||
    isUuid(String(value.planReview.supportPlanId))
  const validPlanVersion =
    value.planReview.supportPlanVersion === null ||
    (Number.isInteger(value.planReview.supportPlanVersion) &&
      Number(value.planReview.supportPlanVersion) >= 0)
  const validReviewReason =
    value.planReview.reasonCode === null ||
    value.planReview.reasonCode === 'PREFERENCES_CHANGED_AFTER_PLAN_ACTIVATION'
  if (
    !validId ||
    value.schemaVersion !== 'support-plan-personalization-v1' ||
    !Number.isInteger(value.revision) ||
    Number(value.revision) < 0 ||
    !['NOT_PROVIDED', 'PROVIDED', 'SKIPPED'].includes(String(value.status)) ||
    !isNullableEnum(value.preferredFocus, PERSONALIZATION_FOCUSES) ||
    !isNullableEnum(value.desiredPace, PERSONALIZATION_PACES) ||
    (value.dailyTimeBudgetMinutes !== null &&
      ![5, 10, 15, 20, 30].includes(Number(value.dailyTimeBudgetMinutes))) ||
    !isNullableEnum(value.preferredDaypart, PERSONALIZATION_DAYPARTS) ||
    !isUniqueEnumArray(
      value.preferredActivityModes,
      PERSONALIZATION_MODES,
      5,
    ) ||
    !isUniqueEnumArray(value.commonBarriers, PERSONALIZATION_BARRIERS, 3) ||
    !validSubmittedAt ||
    typeof value.planReview.required !== 'boolean' ||
    !validPlanId ||
    !validPlanVersion ||
    !validReviewReason
  )
    return null
  return value as SupportPlanPersonalization
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

export function parseSupportPlanV3(value: unknown): SupportPlanV3 | null {
  if (
    !object(value) ||
    !isUuid(String(value.supportPlanId)) ||
    value.modelVersion !== 3 ||
    !['V2_RESOURCE_ADAPTER', 'NATIVE_V3'].includes(
      String(value.representationMode),
    ) ||
    ![
      'DRAFT',
      'ACTIVE',
      'PAUSED',
      'COMPLETED',
      'SUPERSEDED',
      'DISCARDED',
    ].includes(String(value.status)) ||
    !Number.isInteger(value.version) ||
    !object(value.safety) ||
    ![
      'NEGATIVE_SAFETY_SCREEN',
      'POSITIVE_SAFETY_SCREEN',
      'NOT_APPLICABLE',
    ].includes(String(value.safety.status)) ||
    !text(value.safety.guidance, 2048) ||
    !Array.isArray(value.focuses) ||
    value.focuses.length < 1 ||
    value.focuses.length > 20
  )
    return null

  const validSchedule = (candidate: unknown) => {
    if (!object(candidate)) return false
    const days = candidate.daysOfWeek
    return (
      isUuid(String(candidate.scheduleId)) &&
      Number.isInteger(candidate.version) &&
      Number(candidate.version) >= 1 &&
      text(candidate.schedulePolicyVersion, 128) &&
      ['ONCE', 'DAILY', 'WEEKLY'].includes(String(candidate.recurrenceType)) &&
      (candidate.recurrenceDayOfWeek === null ||
        (Number.isInteger(candidate.recurrenceDayOfWeek) &&
          Number(candidate.recurrenceDayOfWeek) >= 1 &&
          Number(candidate.recurrenceDayOfWeek) <= 7)) &&
      Array.isArray(days) &&
      days.length <= 7 &&
      new Set(days).size === days.length &&
      days.every(
        (day) => Number.isInteger(day) && Number(day) >= 1 && Number(day) <= 7,
      ) &&
      (candidate.preferredDaypart === null ||
        ['MORNING', 'AFTERNOON', 'EVENING', 'FLEXIBLE'].includes(
          String(candidate.preferredDaypart),
        )) &&
      (candidate.estimatedDurationMinutes === null ||
        (Number.isInteger(candidate.estimatedDurationMinutes) &&
          Number(candidate.estimatedDurationMinutes) >= 5 &&
          Number(candidate.estimatedDurationMinutes) <= 180 &&
          Number(candidate.estimatedDurationMinutes) % 5 === 0)) &&
      typeof candidate.localTime === 'string' &&
      /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(candidate.localTime) &&
      text(candidate.timezone, 64) &&
      typeof candidate.effectiveFrom === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(candidate.effectiveFrom) &&
      (candidate.effectiveUntil === null ||
        (typeof candidate.effectiveUntil === 'string' &&
          /^\d{4}-\d{2}-\d{2}$/.test(candidate.effectiveUntil))) &&
      typeof candidate.reminderEnabled === 'boolean' &&
      ['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED'].includes(String(candidate.status))
    )
  }

  const validAction = (candidate: unknown) => {
    if (!object(candidate)) return false
    return (
      isUuid(String(candidate.actionId)) &&
      [
        'RESOURCE',
        'JOURNAL',
        'EMOTION_CHECK_IN',
        'ROUTINE_SELF_MANAGEMENT',
        'PROFESSIONAL_SUPPORT',
        'REASSESSMENT_SCREENING',
        'SELF_REPORT_REVIEW',
      ].includes(String(candidate.actionType)) &&
      ['PRIMARY', 'ADJUNCT'].includes(String(candidate.pathRole)) &&
      object(candidate.presentation) &&
      text(candidate.presentation.title, 255) &&
      Array.isArray(candidate.schedules) &&
      candidate.schedules.length <= 50 &&
      candidate.schedules.every(validSchedule)
    )
  }
  const validFocus = (candidate: unknown) => {
    if (!object(candidate) || !Array.isArray(candidate.actions)) return false
    return (
      text(candidate.focusId, 128) &&
      text(candidate.title, 255) &&
      candidate.actions.length >= 1 &&
      candidate.actions.length <= 20 &&
      candidate.actions.every(validAction)
    )
  }
  return value.focuses.every(validFocus) ? (value as SupportPlanV3) : null
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
