import type {
  ActionOccurrence,
  AdaptiveReviewConfirmation,
  AdaptiveSupportPlanReview,
  ActionOccurrenceList,
  CompletionEvidence,
  EmotionCheckInOccurrenceReconciliation,
  JournalOccurrenceReconciliation,
  NativeSupportPlanReplacementReview,
  SupportPlanActionHistory,
  SupportPlanContextualCompanionMessage,
  SupportPlanV3,
} from '@/features/support-plan/api/support-plan-contract'
import {
  isReassessmentPeriod,
  isUuid,
  parseReassessmentSummary,
} from './care-validation'
import { parseSupportPlanV3 } from './support-plan-validation'

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exact(
  value: unknown,
  keys: readonly string[],
  optional: readonly string[] = [],
): value is Record<string, unknown> {
  return (
    object(value) &&
    keys.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every(
      (key) => keys.includes(key) || optional.includes(key),
    )
  )
}

const CYCLE_STATES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'PAUSED',
  'REVIEW_DUE',
  'CLOSED',
] as const

/** Additive, optional on the wire: absent for v2 and pre-proposal plans. */
function cycle(value: unknown) {
  if (value === undefined || value === null) return true
  return (
    exact(value, [
      'policyVersion',
      'lengthDays',
      'timezone',
      'cycleNumber',
      'startedOn',
      'reviewDueOn',
      'currentDay',
      'pausedDays',
      'state',
    ]) &&
    value.policyVersion === 'support-plan-cycle-v1' &&
    value.lengthDays === 14 &&
    text(value.timezone, 64) &&
    integer(value.cycleNumber, 1) &&
    (value.startedOn === null || isSupportPlanLocalDate(value.startedOn)) &&
    (value.reviewDueOn === null || isSupportPlanLocalDate(value.reviewDueOn)) &&
    (value.currentDay === null || integer(value.currentDay, 1)) &&
    integer(value.pausedDays) &&
    CYCLE_STATES.includes(value.state as (typeof CYCLE_STATES)[number])
  )
}

const ENGAGEMENT_KEYS = [
  'hidden',
  'helpfulness',
  'barrierCode',
  'reflection',
  'summaryReuseApproved',
  'engagementUpdatedAt',
] as const

function engagement(value: Record<string, unknown>) {
  const has = (key: string) => Object.hasOwn(value, key)
  return (
    (!has('hidden') || typeof value.hidden === 'boolean') &&
    (!has('helpfulness') ||
      value.helpfulness === null ||
      (typeof value.helpfulness === 'string' &&
        ['NOT_HELPFUL', 'A_LITTLE_HELPFUL', 'HELPFUL', 'VERY_HELPFUL'].includes(
          value.helpfulness,
        ))) &&
    (!has('barrierCode') ||
      value.barrierCode === null ||
      (typeof value.barrierCode === 'string' &&
        [
          'LOW_ENERGY',
          'NOT_ENOUGH_TIME',
          'DIFFICULT_TO_START',
          'NOT_A_GOOD_FIT',
          'OTHER',
        ].includes(value.barrierCode))) &&
    (!has('reflection') || nullableText(value.reflection, 500)) &&
    (!has('summaryReuseApproved') ||
      typeof value.summaryReuseApproved === 'boolean') &&
    (!has('engagementUpdatedAt') || nullableInstant(value.engagementUpdatedAt))
  )
}

function text(value: unknown, max: number): value is string {
  return (
    typeof value === 'string' && value.trim().length > 0 && value.length <= max
  )
}

export function parseSupportPlanContextualCompanionMessage(
  value: unknown,
): SupportPlanContextualCompanionMessage | null {
  const keys = [
    'schemaVersion',
    'supportPlanId',
    'actionId',
    'intent',
    'surface',
    'text',
    'delivery',
    'policyVersion',
    'promptVersion',
    'templateVersion',
    'provider',
    'model',
    'fallbackReason',
  ] as const
  if (
    !exact(value, keys) ||
    value.schemaVersion !== 'support-plan-companion-message-v1' ||
    !isUuid(String(value.supportPlanId)) ||
    !isUuid(String(value.actionId)) ||
    value.intent !== 'EXPLAIN_ACTION' ||
    !['TODAY', 'PLAN'].includes(String(value.surface)) ||
    !text(value.text, 480) ||
    !['GENERATED', 'TEMPLATE'].includes(String(value.delivery)) ||
    value.policyVersion !== 'support-plan-companion-policy-v1' ||
    value.promptVersion !== 'support-plan-companion-prompt-v1' ||
    value.templateVersion !== 'support-plan-companion-template-v1' ||
    (value.provider !== null &&
      !['DETERMINISTIC_FAKE', 'GEMINI', 'OPENAI', 'BEDROCK'].includes(
        String(value.provider),
      )) ||
    (value.model !== null && !text(value.model, 2048)) ||
    (value.fallbackReason !== null &&
      ![
        'CONSENT_REQUIRED',
        'CONSENT_UNAVAILABLE',
        'PROVIDER_DISABLED',
        'PROVIDER_TIMEOUT',
        'PROVIDER_QUOTA_LIMITED',
        'PROVIDER_UNAVAILABLE',
        'MALFORMED_OUTPUT',
        'POLICY_REJECTED',
      ].includes(String(value.fallbackReason))) ||
    (value.delivery === 'GENERATED' &&
      (value.provider === null ||
        value.model === null ||
        value.fallbackReason !== null)) ||
    (value.delivery === 'TEMPLATE' && value.fallbackReason === null)
  )
    return null
  return value as SupportPlanContextualCompanionMessage
}

function instant(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(Date.parse(value))
  )
}

function nullableInstant(value: unknown) {
  return value === null || instant(value)
}

function nullableText(value: unknown, max: number) {
  return value === null || text(value, max)
}

function integer(value: unknown, min = 0) {
  return Number.isSafeInteger(value) && Number(value) >= min
}

export function isSupportPlanLocalDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false
  const date = new Date(`${value}T00:00:00Z`)
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  )
}

const ACTION_TYPES = [
  'RESOURCE',
  'JOURNAL',
  'EMOTION_CHECK_IN',
  'ROUTINE_SELF_MANAGEMENT',
  'PROFESSIONAL_SUPPORT',
  'REASSESSMENT_SCREENING',
  'SELF_REPORT_REVIEW',
] as const

function source(value: unknown, actionType: unknown) {
  if (value === null)
    return [
      'JOURNAL',
      'EMOTION_CHECK_IN',
      'ROUTINE_SELF_MANAGEMENT',
      'SELF_REPORT_REVIEW',
    ].includes(String(actionType))
  if (
    !exact(value, [
      'ownerDomain',
      'sourceKind',
      'sourceId',
      'sourceRevision',
      'sourcePolicyVersion',
      'publicationId',
      'eligibilityPolicyVersion',
      'verifiedAt',
    ]) ||
    !text(value.sourceId, 255) ||
    !nullableText(value.sourceRevision, 128) ||
    !nullableText(value.sourcePolicyVersion, 128) ||
    !(value.publicationId === null || isUuid(String(value.publicationId))) ||
    !nullableText(value.eligibilityPolicyVersion, 128) ||
    !nullableInstant(value.verifiedAt)
  )
    return false
  switch (actionType) {
    case 'RESOURCE':
      return (
        value.ownerDomain === 'CONTENT' &&
        value.sourceKind === 'RESOURCE_VERSION' &&
        typeof value.sourceRevision === 'string' &&
        /^\d+$/.test(value.sourceRevision) &&
        isUuid(String(value.publicationId)) &&
        text(value.eligibilityPolicyVersion, 128) &&
        instant(value.verifiedAt)
      )
    case 'JOURNAL':
      return (
        value.ownerDomain === 'JOURNAL_AI' &&
        value.sourceKind === 'JOURNAL_TEMPLATE'
      )
    case 'EMOTION_CHECK_IN':
      return (
        value.ownerDomain === 'JOURNAL_AI' &&
        value.sourceKind === 'EMOTION_CHECK_IN_CAPABILITY'
      )
    case 'PROFESSIONAL_SUPPORT':
      return (
        value.ownerDomain === 'CONSULTATION' &&
        ['PROFESSIONAL_SUPPORT_PATHWAY', 'APPOINTMENT'].includes(
          String(value.sourceKind),
        )
      )
    case 'REASSESSMENT_SCREENING':
      return (
        value.ownerDomain === 'CARE' &&
        value.sourceKind === 'QUESTIONNAIRE_DEFINITION'
      )
    default:
      return false
  }
}

/** Strict new v3 boundary; legacy v1 projections remain unchanged. */
export function parseCanonicalSupportPlan(
  value: unknown,
): SupportPlanV3 | null {
  if (
    !parseSupportPlanV3(value) ||
    !exact(
      value,
      [
        'supportPlanId',
        'modelVersion',
        'planPolicyVersion',
        'representationMode',
        'status',
        'version',
        'safety',
        'focuses',
        'createdAt',
        'updatedAt',
        'activatedAt',
        'completedAt',
        'completionReason',
        'supersededAt',
        'discardedAt',
        'disclaimerCode',
        'disclaimer',
      ],
      ['cycle'],
    ) ||
    !cycle(value.cycle) ||
    !integer(value.version) ||
    !instant(value.createdAt) ||
    !instant(value.updatedAt) ||
    ![
      value.activatedAt,
      value.completedAt,
      value.supersededAt,
      value.discardedAt,
    ].every(nullableInstant) ||
    !(
      value.completionReason === null ||
      ['USER_DECISION', 'PLAN_NO_LONGER_FITS', 'OTHER'].includes(
        String(value.completionReason),
      )
    ) ||
    value.disclaimerCode !== 'WELLBEING_SUPPORT_NOT_TREATMENT' ||
    !text(value.disclaimer, 1000) ||
    !exact(value.safety, [
      'status',
      'reasonCode',
      'policyVersion',
      'guidanceCode',
      'guidance',
    ]) ||
    !text(value.safety.reasonCode, 64) ||
    !text(value.safety.policyVersion, 64) ||
    !['REVIEW_SAFETY_GUIDANCE', 'STANDARD_SAFETY_REMINDER'].includes(
      String(value.safety.guidanceCode),
    ) ||
    !Array.isArray(value.focuses)
  )
    return null
  for (const focus of value.focuses) {
    if (
      !exact(focus, [
        'focusId',
        'title',
        'rationale',
        'personalizationProvenance',
        'ordinal',
        'actions',
      ]) ||
      !nullableText(focus.rationale, 2048) ||
      !integer(focus.ordinal, 1) ||
      Number(focus.ordinal) > 20 ||
      !Array.isArray(focus.actions)
    )
      return null
    const preference = focus.personalizationProvenance
    if (
      preference !== null &&
      (!exact(preference, [
        'personalizationId',
        'revision',
        'schemaVersion',
        'reasonCode',
      ]) ||
        !isUuid(String(preference.personalizationId)) ||
        !integer(preference.revision, 1) ||
        preference.schemaVersion !== 'support-plan-personalization-v1' ||
        preference.reasonCode !== 'USER_PREFERENCE_AND_CARE_POLICY')
    )
      return null
    for (const action of focus.actions) {
      if (
        !exact(action, [
          'actionId',
          'actionType',
          'actionVersion',
          'representationMode',
          'status',
          'pathRole',
          'purposeCode',
          'rationale',
          'ordinal',
          'source',
          'provenance',
          'presentation',
          'schedules',
          'createdAt',
          'updatedAt',
          'activatedAt',
          'endedAt',
        ]) ||
        !integer(action.actionVersion) ||
        !['V2_RESOURCE_ADAPTER', 'NATIVE_V3'].includes(
          String(action.representationMode),
        ) ||
        action.representationMode !== value.representationMode ||
        !['DRAFT', 'ACTIVE', 'ENDED'].includes(String(action.status)) ||
        !text(action.purposeCode, 64) ||
        !nullableText(action.rationale, 2048) ||
        !integer(action.ordinal, 1) ||
        Number(action.ordinal) > 20 ||
        !source(action.source, action.actionType) ||
        !instant(action.createdAt) ||
        !instant(action.updatedAt) ||
        !nullableInstant(action.activatedAt) ||
        !nullableInstant(action.endedAt) ||
        !Array.isArray(action.schedules) ||
        !action.schedules.every((schedule) =>
          exact(schedule, [
            'scheduleId',
            'version',
            'schedulePolicyVersion',
            'recurrenceType',
            'recurrenceDayOfWeek',
            'daysOfWeek',
            'preferredDaypart',
            'estimatedDurationMinutes',
            'localTime',
            'timezone',
            'effectiveFrom',
            'effectiveUntil',
            'reminderEnabled',
            'status',
          ]),
        ) ||
        !exact(action.provenance, [
          'category',
          'referenceId',
          'referenceVersion',
          'acceptedAt',
        ]) ||
        ![
          'USER_SELECTED',
          'SUPPORT_GUIDE',
          'SPECIALIST',
          'SYSTEM_POLICY',
        ].includes(String(action.provenance.category)) ||
        !instant(action.provenance.acceptedAt) ||
        !(
          (action.provenance.referenceId === null &&
            action.provenance.referenceVersion === null) ||
          (text(action.provenance.referenceId, 255) &&
            text(action.provenance.referenceVersion, 128))
        ) ||
        !exact(action.presentation, [
          'title',
          'summary',
          'instructions',
          'externalUrl',
        ]) ||
        !nullableText(action.presentation.summary, 4096) ||
        !nullableText(action.presentation.instructions, 2048) ||
        !nullableText(action.presentation.externalUrl, 2048)
      )
        return null
    }
  }
  return value as SupportPlanV3
}

export function parseCompletionEvidence(
  value: unknown,
): CompletionEvidence | null {
  if (
    !exact(value, [
      'kind',
      'ownerDomain',
      'factId',
      'factRevision',
      'occurredAt',
      'verifiedAt',
    ]) ||
    !text(value.factId, 255) ||
    !nullableText(value.factRevision, 128) ||
    !instant(value.occurredAt) ||
    !instant(value.verifiedAt) ||
    Date.parse(value.verifiedAt) < Date.parse(value.occurredAt)
  )
    return null
  const owners: Record<string, string> = {
    USER_ACKNOWLEDGEMENT: 'CARE',
    JOURNAL_ENTRY: 'JOURNAL_AI',
    EMOTION_CHECK_IN: 'JOURNAL_AI',
    APPOINTMENT_FULFILMENT: 'CONSULTATION',
    ASSESSMENT_HISTORY: 'CARE',
    SELF_REPORT_REVIEW: 'CARE',
  }
  return owners[String(value.kind)] === value.ownerDomain
    ? (value as CompletionEvidence)
    : null
}

export function parseActionOccurrence(value: unknown): ActionOccurrence | null {
  if (
    !exact(
      value,
      [
        'occurrenceId',
        'actionId',
        'actionType',
        'actionVersion',
        'scheduleId',
        'scheduleVersion',
        'representationMode',
        'version',
        'localDate',
        'scheduledAt',
        'state',
        'displayState',
        'stateReason',
        'completionEvidence',
        'outcomeRecordedAt',
      ],
      ENGAGEMENT_KEYS,
    ) ||
    !engagement(value) ||
    !isUuid(String(value.occurrenceId)) ||
    !text(value.actionId, 128) ||
    !ACTION_TYPES.includes(value.actionType as (typeof ACTION_TYPES)[number]) ||
    !integer(value.actionVersion) ||
    !isUuid(String(value.scheduleId)) ||
    !integer(value.scheduleVersion, 1) ||
    !integer(value.version) ||
    !isSupportPlanLocalDate(value.localDate) ||
    !instant(value.scheduledAt) ||
    !nullableInstant(value.outcomeRecordedAt) ||
    !['V2_RESOURCE_ADAPTER', 'NATIVE_V3'].includes(
      String(value.representationMode),
    ) ||
    !['SCHEDULED', 'COMPLETED', 'SKIPPED', 'CANCELLED'].includes(
      String(value.state),
    ) ||
    !['SCHEDULED', 'OVERDUE', 'COMPLETED', 'SKIPPED', 'CANCELLED'].includes(
      String(value.displayState),
    ) ||
    !(
      value.stateReason === null ||
      [
        'PLAN_PAUSED',
        'PLAN_COMPLETED',
        'PLAN_REPLACED',
        'ACTION_ENDED',
        'SCHEDULE_CHANGED',
      ].includes(String(value.stateReason))
    )
  )
    return null
  if (
    value.state === 'SCHEDULED'
      ? !['SCHEDULED', 'OVERDUE'].includes(String(value.displayState))
      : value.displayState !== value.state
  )
    return null
  if (value.representationMode === 'V2_RESOURCE_ADAPTER')
    return value.completionEvidence === null
      ? (value as ActionOccurrence)
      : null
  if (!isUuid(String(value.actionId))) return null
  if (value.state !== 'COMPLETED')
    return value.completionEvidence === null
      ? (value as ActionOccurrence)
      : null
  const evidence = parseCompletionEvidence(value.completionEvidence)
  const kinds: Record<string, string> = {
    RESOURCE: 'USER_ACKNOWLEDGEMENT',
    ROUTINE_SELF_MANAGEMENT: 'USER_ACKNOWLEDGEMENT',
    JOURNAL: 'JOURNAL_ENTRY',
    EMOTION_CHECK_IN: 'EMOTION_CHECK_IN',
    PROFESSIONAL_SUPPORT: 'APPOINTMENT_FULFILMENT',
    REASSESSMENT_SCREENING: 'ASSESSMENT_HISTORY',
    SELF_REPORT_REVIEW: 'SELF_REPORT_REVIEW',
  }
  return evidence &&
    evidence.kind === kinds[String(value.actionType)] &&
    instant(value.outcomeRecordedAt)
    ? (value as ActionOccurrence)
    : null
}

export function parseActionOccurrenceList(
  value: unknown,
): ActionOccurrenceList | null {
  if (
    !exact(value, [
      'supportPlanId',
      'supportPlanStatus',
      'representationMode',
      'from',
      'through',
      'occurrences',
      'interpretationCode',
    ]) ||
    !isUuid(String(value.supportPlanId)) ||
    !['ACTIVE', 'PAUSED'].includes(String(value.supportPlanStatus)) ||
    !['V2_RESOURCE_ADAPTER', 'NATIVE_V3'].includes(
      String(value.representationMode),
    ) ||
    !isSupportPlanLocalDate(value.from) ||
    !isSupportPlanLocalDate(value.through) ||
    value.from > value.through ||
    Date.parse(value.through) - Date.parse(value.from) > 30 * 86400000 ||
    !Array.isArray(value.occurrences) ||
    value.occurrences.length > 620 ||
    value.interpretationCode !==
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE'
  )
    return null
  const seen = new Set<string>()
  for (const item of value.occurrences) {
    const parsed = parseActionOccurrence(item)
    if (
      !parsed ||
      parsed.representationMode !== value.representationMode ||
      parsed.localDate < value.from ||
      parsed.localDate > value.through ||
      seen.has(parsed.occurrenceId)
    )
      return null
    seen.add(parsed.occurrenceId)
  }
  return value as ActionOccurrenceList
}

export function parseEmotionCheckInReconciliation(
  value: unknown,
): EmotionCheckInOccurrenceReconciliation | null {
  if (
    !exact(value, [
      'schemaVersion',
      'occurrenceId',
      'actionId',
      'localDate',
      'sourceState',
      'occurrenceState',
      'version',
      'completedAt',
      'completionEvidence',
    ]) ||
    value.schemaVersion !== 'emotion-check-in-occurrence-reconciliation-v1' ||
    !isUuid(String(value.occurrenceId)) ||
    !isUuid(String(value.actionId)) ||
    !isSupportPlanLocalDate(value.localDate) ||
    !['RECORDED', 'MISSING', 'DELETED'].includes(String(value.sourceState)) ||
    !integer(value.version)
  )
    return null
  if (value.occurrenceState === 'SCHEDULED')
    return value.completedAt === null && value.completionEvidence === null
      ? (value as EmotionCheckInOccurrenceReconciliation)
      : null
  const evidence = parseCompletionEvidence(value.completionEvidence)
  return value.occurrenceState === 'COMPLETED' &&
    instant(value.completedAt) &&
    evidence?.kind === 'EMOTION_CHECK_IN' &&
    evidence.ownerDomain === 'JOURNAL_AI'
    ? (value as EmotionCheckInOccurrenceReconciliation)
    : null
}

export function parseJournalReconciliation(
  value: unknown,
): JournalOccurrenceReconciliation | null {
  if (
    !exact(value, [
      'schemaVersion',
      'occurrenceId',
      'actionId',
      'localDate',
      'journalId',
      'sourceState',
      'occurrenceState',
      'version',
      'completedAt',
      'completionEvidence',
    ]) ||
    value.schemaVersion !== 'journal-entry-occurrence-reconciliation-v1' ||
    typeof value.occurrenceId !== 'string' ||
    !isUuid(value.occurrenceId) ||
    typeof value.actionId !== 'string' ||
    !isUuid(value.actionId) ||
    typeof value.journalId !== 'string' ||
    !isUuid(value.journalId) ||
    !isSupportPlanLocalDate(value.localDate) ||
    !['RECORDED', 'MISSING', 'DELETED'].includes(String(value.sourceState)) ||
    !integer(value.version)
  )
    return null
  if (value.occurrenceState === 'SCHEDULED')
    return value.sourceState !== 'RECORDED' &&
      value.completedAt === null &&
      value.completionEvidence === null
      ? (value as JournalOccurrenceReconciliation)
      : null
  const evidence = parseCompletionEvidence(value.completionEvidence)
  return value.occurrenceState === 'COMPLETED' &&
    instant(value.completedAt) &&
    evidence?.kind === 'JOURNAL_ENTRY' &&
    evidence.ownerDomain === 'JOURNAL_AI' &&
    evidence.factId === value.journalId &&
    evidence.factRevision === '1'
    ? (value as JournalOccurrenceReconciliation)
    : null
}

export function parseSupportPlanActionHistory(
  value: unknown,
): SupportPlanActionHistory | null {
  if (
    !exact(value, ['items', 'nextCursor', 'hasMore']) ||
    !Array.isArray(value.items) ||
    value.items.length > 20 ||
    typeof value.hasMore !== 'boolean' ||
    !(value.nextCursor === null || text(value.nextCursor, 256)) ||
    value.hasMore !== (value.nextCursor !== null) ||
    !value.items.every((item) => {
      const parsed = parseCanonicalSupportPlan(item)
      return (
        parsed &&
        ['COMPLETED', 'SUPERSEDED', 'DISCARDED'].includes(parsed.status)
      )
    })
  )
    return null
  return value as SupportPlanActionHistory
}

export function parseNativeSupportPlanReplacementReview(
  value: unknown,
): NativeSupportPlanReplacementReview | null {
  if (
    !exact(value, [
      'outcome',
      'rationaleCodes',
      'currentPlan',
      'proposedPlan',
      'reassessmentSummary',
      'reviewedAt',
    ]) ||
    ![
      'CURRENT_PLAN_VALID_NO_BETTER_ALTERNATIVE',
      'CURRENT_PLAN_VALID_ALTERNATIVES_AVAILABLE',
      'CURRENT_PLAN_NOT_ADMISSIBLE',
    ].includes(String(value.outcome)) ||
    !Array.isArray(value.rationaleCodes) ||
    value.rationaleCodes.length < 1 ||
    value.rationaleCodes.length > 5 ||
    !value.rationaleCodes.every((code) => text(code, 128)) ||
    !instant(value.reviewedAt)
  )
    return null
  const current = parseCanonicalSupportPlan(value.currentPlan)
  const proposed = parseCanonicalSupportPlan(value.proposedPlan)
  const summary = parseReassessmentSummary(value.reassessmentSummary)
  return current &&
    ['ACTIVE', 'PAUSED'].includes(current.status) &&
    proposed?.representationMode === 'NATIVE_V3' &&
    proposed.status === 'DRAFT' &&
    summary?.summaryVersion === 'reassessment-summary-v2'
    ? (value as NativeSupportPlanReplacementReview)
    : null
}

const OPTION_KINDS = [
  'KEEP_CURRENT',
  'LOWER_WORKLOAD',
  'DIFFERENT_TIME',
  'ALTERNATIVE_ACTION',
  'DIFFERENT_FOCUS',
  'PROFESSIONAL_SUPPORT_NEXT_STEP',
]
const EVIDENCE_SOURCES = [
  'SCREENING_PHQ9',
  'SCREENING_GAD7',
  'JOURNAL_CONTEXT',
  'PLAN_ENGAGEMENT',
  'SELF_REPORTED_EXPERIENCE',
  'ACTIVITY_REFLECTION',
  'PATTERN',
  'PREFERENCES',
]

function list(value: unknown, max: number, item: (entry: unknown) => boolean) {
  return Array.isArray(value) && value.length <= max && value.every(item)
}

function evidenceRef(value: unknown) {
  return (
    exact(value, ['source', 'refId']) &&
    EVIDENCE_SOURCES.includes(String(value.source)) &&
    nullableText(value.refId, 128)
  )
}

function reviewOption(value: unknown) {
  return (
    exact(value, [
      'optionId',
      'kind',
      'executionKind',
      'actionId',
      'focusId',
      'rationaleCodes',
      'evidenceRefs',
      'conflictingEvidenceRefs',
      'changes',
    ]) &&
    text(value.optionId, 128) &&
    OPTION_KINDS.includes(String(value.kind)) &&
    [
      'NO_CHANGE',
      'CONTINUE_CYCLE',
      'UPDATE_SCHEDULE',
      'PREPARE_REPLACEMENT',
      'NAVIGATE_PROFESSIONAL_SUPPORT',
    ].includes(String(value.executionKind)) &&
    (value.actionId === null || isUuid(String(value.actionId))) &&
    nullableText(value.focusId, 128) &&
    Array.isArray(value.rationaleCodes) &&
    value.rationaleCodes.length >= 1 &&
    list(value.rationaleCodes, 5, (code) => text(code, 128)) &&
    list(value.evidenceRefs, 10, evidenceRef) &&
    list(value.conflictingEvidenceRefs, 10, evidenceRef) &&
    list(
      value.changes,
      6,
      (change) =>
        exact(change, ['field', 'before', 'after']) &&
        [
          'ACTION',
          'ESTIMATED_DURATION_MINUTES',
          'DAYS_PER_WEEK',
          'PREFERRED_DAYPART',
          'LOCAL_TIME',
          'FOCUS_ORDER',
        ].includes(String(change.field)) &&
        nullableText(change.before, 255) &&
        nullableText(change.after, 255),
    )
  )
}

function programPeriod(value: unknown) {
  const counts = [
    'elapsedDays',
    'pausedDays',
    'scheduledCount',
    'completedCount',
    'skippedCount',
    'openCount',
  ]
  return (
    exact(value, [
      'startedOn',
      'asOf',
      'timezone',
      'fullCycleElapsed',
      ...counts,
    ]) &&
    isSupportPlanLocalDate(value.startedOn) &&
    isSupportPlanLocalDate(value.asOf) &&
    text(value.timezone, 64) &&
    typeof value.fullCycleElapsed === 'boolean' &&
    counts.every((key) => integer(value[key], key === 'elapsedDays' ? 1 : 0))
  )
}

function pattern(value: unknown) {
  return (
    exact(value, [
      'patternId',
      'kind',
      'code',
      'actionId',
      'actionTitle',
      'count',
      'occurrenceIds',
    ]) &&
    text(value.patternId, 128) &&
    ['REPEATED_BARRIER', 'REPEATED_HELPFUL'].includes(String(value.kind)) &&
    ['NOT_ENOUGH_TIME', 'LOW_ENERGY', 'NOT_A_GOOD_FIT', 'HELPFUL'].includes(
      String(value.code),
    ) &&
    isUuid(String(value.actionId)) &&
    text(value.actionTitle, 255) &&
    integer(value.count, 2) &&
    Array.isArray(value.occurrenceIds) &&
    value.occurrenceIds.length >= 2 &&
    list(value.occurrenceIds, 31, (id) => isUuid(String(id)))
  )
}

function contradiction(value: unknown) {
  return (
    exact(value, ['contradictionId', 'kind', 'evidenceRefs']) &&
    text(value.contradictionId, 128) &&
    [
      'INSTRUMENT_DIRECTIONS_DIFFER',
      'SELF_REPORT_DIFFERS_FROM_SCREENING',
      'JOURNAL_DIFFERS_FROM_SCREENING',
    ].includes(String(value.kind)) &&
    Array.isArray(value.evidenceRefs) &&
    value.evidenceRefs.length >= 2 &&
    list(value.evidenceRefs, 6, evidenceRef)
  )
}

function unavailableOption(value: unknown) {
  return (
    exact(value, ['kind', 'reasonCode']) &&
    OPTION_KINDS.includes(String(value.kind)) &&
    [
      'NO_SUPPORTING_PATTERN',
      'NO_TIME_PREFERENCE',
      'NO_ADMITTED_CANDIDATE',
      'REASSESSMENT_REQUIRED',
      'ADMISSION_UNAVAILABLE',
      'CURRENT_PLAN_NOT_ADMISSIBLE',
      'PLAN_PAUSED',
      'ENTITLEMENT_REQUIRED',
    ].includes(String(value.reasonCode))
  )
}

function selfReportDimension(value: unknown) {
  if (
    !exact(value, ['state', 'unavailableReason', 'source']) ||
    !['AVAILABLE', 'INSUFFICIENT_DATA', 'UNAVAILABLE'].includes(
      String(value.state),
    ) ||
    ![null, 'NOT_PROVIDED', 'SOURCE_DELETED'].includes(
      value.unavailableReason as string | null,
    )
  )
    return false
  const source = value.source
  return (
    source === null ||
    (object(source) &&
      isUuid(String(source.selfReportId)) &&
      source.sourceVersion === 'reassessment-self-report-v1' &&
      ['BETTER', 'ABOUT_THE_SAME', 'MORE_DIFFICULT', 'UNSURE'].includes(
        String(source.currentExperience),
      ))
  )
}

function engagementSource(value: unknown) {
  return (
    exact(value, [
      'occurrenceId',
      'occurrenceVersion',
      'actionId',
      'actionVersion',
      'supportPlanId',
      'sourcePlanVersion',
      'sourceSlotId',
      'sourceResourceId',
      'sourceContentVersion',
      'scheduledAt',
      'state',
      'helpfulness',
      'barrierCode',
      'engagementUpdatedAt',
    ]) &&
    isUuid(String(value.occurrenceId)) &&
    integer(value.occurrenceVersion) &&
    (value.actionId === null || isUuid(String(value.actionId))) &&
    (value.actionVersion === null || integer(value.actionVersion)) &&
    isUuid(String(value.supportPlanId)) &&
    integer(value.sourcePlanVersion) &&
    nullableText(value.sourceSlotId, 128) &&
    (value.sourceResourceId === null ||
      isUuid(String(value.sourceResourceId))) &&
    (value.sourceContentVersion === null ||
      integer(value.sourceContentVersion)) &&
    instant(value.scheduledAt) &&
    ['COMPLETED', 'SKIPPED'].includes(String(value.state)) &&
    nullableText(value.helpfulness, 64) &&
    nullableText(value.barrierCode, 64) &&
    nullableInstant(value.engagementUpdatedAt)
  )
}

/** Exact-period Care facts that exist even when no summary was composed. */
function evidenceContext(value: unknown) {
  return (
    exact(value, [
      'comparisonPolicyVersion',
      'previousPeriod',
      'currentPeriod',
      'timezone',
      'selfReportedExperience',
      'engagementSources',
    ]) &&
    text(value.comparisonPolicyVersion, 128) &&
    isReassessmentPeriod(value.previousPeriod) &&
    isReassessmentPeriod(value.currentPeriod) &&
    value.timezone === 'UTC' &&
    selfReportDimension(value.selfReportedExperience) &&
    list(value.engagementSources, 200, engagementSource)
  )
}

function reassessment(value: unknown) {
  if (
    !exact(value, ['state', 'reasonCode', 'summary']) ||
    ![
      'AVAILABLE',
      'NOT_STARTED',
      'INCOMPLETE',
      'STALE',
      'UNAVAILABLE',
    ].includes(String(value.state)) ||
    !nullableText(value.reasonCode, 128)
  )
    return false
  if (value.summary === null) return value.state !== 'AVAILABLE'
  return (
    ['AVAILABLE', 'STALE'].includes(String(value.state)) &&
    parseReassessmentSummary(value.summary)?.summaryVersion ===
      'reassessment-summary-v2'
  )
}

/** Strict adaptive-support-plan-review-v1; nothing is filled or inferred client-side. */
export function parseAdaptiveSupportPlanReview(
  value: unknown,
): AdaptiveSupportPlanReview | null {
  return exact(
    value,
    [
      'schemaVersion',
      'policyVersion',
      'supportPlanId',
      'planVersion',
      'planStatus',
      'cycle',
      'reviewedAt',
      'programPeriod',
      'reviewState',
      'reassessment',
      'currentAdmission',
      'outcome',
      'patterns',
      'contradictions',
      'options',
      'unavailableOptions',
      'reviewFingerprint',
    ],
    ['evidenceContext'],
  ) &&
    (value.evidenceContext === undefined ||
      evidenceContext(value.evidenceContext)) &&
    value.schemaVersion === 'adaptive-support-plan-review-v1' &&
    value.policyVersion === 'support-plan-review-v1' &&
    isUuid(String(value.supportPlanId)) &&
    integer(value.planVersion) &&
    ['ACTIVE', 'PAUSED'].includes(String(value.planStatus)) &&
    cycle(value.cycle) &&
    instant(value.reviewedAt) &&
    programPeriod(value.programPeriod) &&
    ['EARLY', 'REVIEW_DUE', 'PAUSED'].includes(String(value.reviewState)) &&
    reassessment(value.reassessment) &&
    ['ADMISSIBLE', 'INADMISSIBLE', 'UNAVAILABLE'].includes(
      String(value.currentAdmission),
    ) &&
    (value.outcome === null ||
      [
        'CURRENT_PLAN_VALID_NO_BETTER_ALTERNATIVE',
        'CURRENT_PLAN_VALID_ALTERNATIVES_AVAILABLE',
        'CURRENT_PLAN_NOT_ADMISSIBLE',
      ].includes(String(value.outcome))) &&
    (value.currentAdmission === 'UNAVAILABLE') === (value.outcome === null) &&
    list(value.patterns, 20, pattern) &&
    list(value.contradictions, 10, contradiction) &&
    list(value.options, 8, reviewOption) &&
    list(value.unavailableOptions, 6, unavailableOption) &&
    text(value.reviewFingerprint, 128) &&
    value.reviewFingerprint.length >= 16
    ? (value as AdaptiveSupportPlanReview)
    : null
}

export function parseAdaptiveReviewConfirmation(
  value: unknown,
): AdaptiveReviewConfirmation | null {
  if (
    !exact(value, ['result', 'optionId', 'plan', 'draft']) ||
    ![
      'KEPT',
      'CYCLE_CONTINUED',
      'SCHEDULE_UPDATED',
      'DRAFT_PREPARED',
      'REPLACED',
    ].includes(String(value.result)) ||
    !text(value.optionId, 128)
  )
    return null
  const plan = parseCanonicalSupportPlan(value.plan)
  const draft =
    value.draft === null ? null : parseCanonicalSupportPlan(value.draft)
  if (!plan || (value.draft !== null && draft?.status !== 'DRAFT')) return null
  return (value.result === 'DRAFT_PREPARED') === (draft !== null)
    ? (value as AdaptiveReviewConfirmation)
    : null
}
