import { z } from 'zod'
import {
  actionScheduleSchema,
  reassessmentSummaryReferenceSchema,
} from './support-plan-contract'

const actionTypeSchema = z.enum([
  'RESOURCE',
  'JOURNAL',
  'EMOTION_CHECK_IN',
  'ROUTINE_SELF_MANAGEMENT',
  'PROFESSIONAL_SUPPORT',
  'REASSESSMENT_SCREENING',
  'SELF_REPORT_REVIEW',
])
const representationSchema = z.enum(['V2_RESOURCE_ADAPTER', 'NATIVE_V3'])
const stateSchema = z.enum([
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'SUPERSEDED',
  'DISCARDED',
])
const nullableText = (max: number) => z.string().min(1).max(max).nullable()
const instant = z.iso.datetime({ offset: true })
const sourceSchema = z
  .object({
    ownerDomain: z.enum(['CONTENT', 'JOURNAL_AI', 'CONSULTATION', 'CARE']),
    sourceKind: z.enum([
      'RESOURCE_VERSION',
      'JOURNAL_TEMPLATE',
      'EMOTION_CHECK_IN_CAPABILITY',
      'PROFESSIONAL_SUPPORT_PATHWAY',
      'APPOINTMENT',
      'QUESTIONNAIRE_DEFINITION',
    ]),
    sourceId: z.string().min(1).max(255),
    sourceRevision: nullableText(128),
    sourcePolicyVersion: nullableText(128),
    publicationId: z.uuid().nullable(),
    eligibilityPolicyVersion: nullableText(128),
    verifiedAt: instant.nullable(),
  })
  .strict()

const planActionSchema = z
  .object({
    actionId: z.string().min(1).max(128),
    actionType: actionTypeSchema,
    actionVersion: z.number().int().nonnegative(),
    representationMode: representationSchema,
    status: z.enum(['DRAFT', 'ACTIVE', 'ENDED']),
    pathRole: z.enum(['PRIMARY', 'ADJUNCT']),
    purposeCode: z.string().min(1).max(64),
    rationale: nullableText(2048),
    ordinal: z.number().int().min(1).max(20),
    source: sourceSchema.nullable(),
    provenance: z
      .object({
        category: z.enum([
          'USER_SELECTED',
          'SUPPORT_GUIDE',
          'SPECIALIST',
          'SYSTEM_POLICY',
        ]),
        referenceId: nullableText(255),
        referenceVersion: nullableText(128),
        acceptedAt: instant,
      })
      .strict()
      .refine(
        (value) =>
          (value.referenceId === null) === (value.referenceVersion === null),
      ),
    presentation: z
      .object({
        title: z.string().min(1).max(255),
        summary: nullableText(4096),
        instructions: nullableText(2048),
        externalUrl: z.url().max(2048).nullable(),
      })
      .strict(),
    schedules: z.array(actionScheduleSchema).max(50),
    createdAt: instant,
    updatedAt: instant,
    activatedAt: instant.nullable(),
    endedAt: instant.nullable(),
  })
  .strict()
  .superRefine((action, context) => {
    if (
      action.representationMode === 'NATIVE_V3' &&
      !z.uuid().safeParse(action.actionId).success
    )
      context.addIssue({
        code: 'custom',
        path: ['actionId'],
        message: 'Invalid native action identity.',
      })
    const source = action.source
    let valid = false
    switch (action.actionType) {
      case 'RESOURCE':
        valid =
          source?.ownerDomain === 'CONTENT' &&
          source.sourceKind === 'RESOURCE_VERSION' &&
          /^\d+$/.test(source.sourceRevision ?? '') &&
          source.publicationId !== null &&
          source.eligibilityPolicyVersion !== null &&
          source.verifiedAt !== null
        break
      case 'JOURNAL':
        valid =
          source === null ||
          (source.ownerDomain === 'JOURNAL_AI' &&
            source.sourceKind === 'JOURNAL_TEMPLATE')
        break
      case 'EMOTION_CHECK_IN':
        valid =
          source === null ||
          (source.ownerDomain === 'JOURNAL_AI' &&
            source.sourceKind === 'EMOTION_CHECK_IN_CAPABILITY')
        break
      case 'PROFESSIONAL_SUPPORT':
        valid =
          source?.ownerDomain === 'CONSULTATION' &&
          ['PROFESSIONAL_SUPPORT_PATHWAY', 'APPOINTMENT'].includes(
            source.sourceKind,
          )
        break
      case 'REASSESSMENT_SCREENING':
        valid =
          source?.ownerDomain === 'CARE' &&
          source.sourceKind === 'QUESTIONNAIRE_DEFINITION'
        break
      default:
        valid = source === null
    }
    if (!valid)
      context.addIssue({
        code: 'custom',
        path: ['source'],
        message: 'Invalid action source attribution.',
      })
  })

export const canonicalSupportPlanSchema = z
  .object({
    supportPlanId: z.uuid(),
    modelVersion: z.literal(3),
    planPolicyVersion: z.string().min(1).max(128),
    representationMode: representationSchema,
    status: stateSchema,
    version: z.number().int().nonnegative(),
    safety: z
      .object({
        status: z.enum([
          'NEGATIVE_SAFETY_SCREEN',
          'POSITIVE_SAFETY_SCREEN',
          'NOT_APPLICABLE',
        ]),
        reasonCode: z.string().min(1).max(64),
        policyVersion: z.string().min(1).max(64),
        guidanceCode: z.enum([
          'REVIEW_SAFETY_GUIDANCE',
          'STANDARD_SAFETY_REMINDER',
        ]),
        guidance: z.string().min(1).max(2048),
      })
      .strict(),
    focuses: z
      .array(
        z
          .object({
            focusId: z.string().min(1).max(128),
            title: z.string().min(1).max(255),
            rationale: nullableText(2048),
            ordinal: z.number().int().min(1).max(20),
            personalizationProvenance: z
              .object({
                personalizationId: z.uuid(),
                revision: z.number().int().min(1),
                schemaVersion: z.literal('support-plan-personalization-v1'),
                reasonCode: z.literal('USER_PREFERENCE_AND_CARE_POLICY'),
              })
              .strict()
              .nullable(),
            actions: z.array(planActionSchema).min(1).max(20),
          })
          .strict(),
      )
      .min(1)
      .max(20),
    createdAt: instant,
    updatedAt: instant,
    activatedAt: instant.nullable(),
    completedAt: instant.nullable(),
    completionReason: z
      .enum(['USER_DECISION', 'PLAN_NO_LONGER_FITS', 'OTHER'])
      .nullable(),
    supersededAt: instant.nullable(),
    discardedAt: instant.nullable(),
    disclaimerCode: z.literal('WELLBEING_SUPPORT_NOT_TREATMENT'),
    disclaimer: z.string().min(1).max(1000),
    // Additive MB-669 field; accepted so web-created 14-day plans still load here.
    cycle: z.unknown().optional(),
  })
  .strict()
  .superRefine((plan, context) => {
    for (const focus of plan.focuses)
      for (const action of focus.actions)
        if (action.representationMode !== plan.representationMode)
          context.addIssue({
            code: 'custom',
            path: ['focuses'],
            message: 'Action representation mismatch.',
          })
  })

const evidenceKinds = {
  USER_ACKNOWLEDGEMENT: 'CARE',
  JOURNAL_ENTRY: 'JOURNAL_AI',
  EMOTION_CHECK_IN: 'JOURNAL_AI',
  APPOINTMENT_FULFILMENT: 'CONSULTATION',
  ASSESSMENT_HISTORY: 'CARE',
  SELF_REPORT_REVIEW: 'CARE',
} as const
export const completionEvidenceSchema = z
  .object({
    kind: z.enum([
      'USER_ACKNOWLEDGEMENT',
      'JOURNAL_ENTRY',
      'EMOTION_CHECK_IN',
      'APPOINTMENT_FULFILMENT',
      'ASSESSMENT_HISTORY',
      'SELF_REPORT_REVIEW',
    ]),
    ownerDomain: z.enum(['CARE', 'JOURNAL_AI', 'CONSULTATION']),
    factId: z.string().min(1).max(255),
    factRevision: nullableText(128),
    occurredAt: instant,
    verifiedAt: instant,
  })
  .strict()
  .refine(
    (value) =>
      evidenceKinds[value.kind] === value.ownerDomain &&
      Date.parse(value.verifiedAt) >= Date.parse(value.occurredAt),
    'Invalid fact attribution.',
  )

const actionEvidence = {
  RESOURCE: 'USER_ACKNOWLEDGEMENT',
  ROUTINE_SELF_MANAGEMENT: 'USER_ACKNOWLEDGEMENT',
  JOURNAL: 'JOURNAL_ENTRY',
  EMOTION_CHECK_IN: 'EMOTION_CHECK_IN',
  PROFESSIONAL_SUPPORT: 'APPOINTMENT_FULFILMENT',
  REASSESSMENT_SCREENING: 'ASSESSMENT_HISTORY',
  SELF_REPORT_REVIEW: 'SELF_REPORT_REVIEW',
} as const
export const actionOccurrenceSchema = z
  .object({
    occurrenceId: z.uuid(),
    actionId: z.string().min(1).max(128),
    actionType: actionTypeSchema,
    actionVersion: z.number().int().nonnegative(),
    scheduleId: z.uuid(),
    scheduleVersion: z.number().int().min(1),
    representationMode: representationSchema,
    version: z.number().int().nonnegative(),
    localDate: z.iso.date(),
    scheduledAt: instant,
    state: z.enum(['SCHEDULED', 'COMPLETED', 'SKIPPED', 'CANCELLED']),
    displayState: z.enum([
      'SCHEDULED',
      'OVERDUE',
      'COMPLETED',
      'SKIPPED',
      'CANCELLED',
    ]),
    stateReason: z
      .enum([
        'PLAN_PAUSED',
        'PLAN_COMPLETED',
        'PLAN_REPLACED',
        'ACTION_ENDED',
        'SCHEDULE_CHANGED',
      ])
      .nullable(),
    completionEvidence: completionEvidenceSchema.nullable(),
    outcomeRecordedAt: instant.nullable(),
    // Additive MB-644 native engagement fields, emitted only when recorded.
    hidden: z.boolean().optional(),
    helpfulness: z
      .enum(['NOT_HELPFUL', 'A_LITTLE_HELPFUL', 'HELPFUL', 'VERY_HELPFUL'])
      .nullable()
      .optional(),
    barrierCode: z
      .enum([
        'LOW_ENERGY',
        'NOT_ENOUGH_TIME',
        'DIFFICULT_TO_START',
        'NOT_A_GOOD_FIT',
        'OTHER',
      ])
      .nullable()
      .optional(),
    reflection: nullableText(500).optional(),
    summaryReuseApproved: z.boolean().optional(),
    engagementUpdatedAt: instant.nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.state === 'SCHEDULED'
        ? !['SCHEDULED', 'OVERDUE'].includes(value.displayState)
        : value.displayState !== value.state
    )
      context.addIssue({ code: 'custom', message: 'Invalid display state.' })
    if (value.representationMode === 'V2_RESOURCE_ADAPTER') {
      if (value.completionEvidence !== null)
        context.addIssue({
          code: 'custom',
          message: 'Adapter does not manufacture evidence.',
        })
    } else if (
      !z.uuid().safeParse(value.actionId).success ||
      (value.state === 'COMPLETED'
        ? !value.completionEvidence ||
          !value.outcomeRecordedAt ||
          value.completionEvidence.kind !== actionEvidence[value.actionType]
        : value.completionEvidence !== null)
    )
      context.addIssue({
        code: 'custom',
        message: 'Invalid native completion evidence.',
      })
  })

export const actionOccurrenceListSchema = z
  .object({
    supportPlanId: z.uuid(),
    supportPlanStatus: z.enum(['ACTIVE', 'PAUSED']),
    representationMode: representationSchema,
    from: z.iso.date(),
    through: z.iso.date(),
    occurrences: z.array(actionOccurrenceSchema).max(620),
    interpretationCode: z.literal(
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
    ),
  })
  .strict()
  .refine(
    (value) =>
      value.from <= value.through &&
      Date.parse(value.through) - Date.parse(value.from) <= 30 * 86400000 &&
      new Set(value.occurrences.map((item) => item.occurrenceId)).size ===
        value.occurrences.length &&
      value.occurrences.every(
        (item) =>
          item.representationMode === value.representationMode &&
          item.localDate >= value.from &&
          item.localDate <= value.through,
      ),
    'Invalid bounded occurrence window.',
  )

export const emotionReconciliationSchema = z
  .object({
    schemaVersion: z.literal('emotion-check-in-occurrence-reconciliation-v1'),
    occurrenceId: z.uuid(),
    actionId: z.uuid(),
    localDate: z.iso.date(),
    sourceState: z.enum(['RECORDED', 'MISSING', 'DELETED']),
    occurrenceState: z.enum(['SCHEDULED', 'COMPLETED']),
    version: z.number().int().nonnegative(),
    completedAt: instant.nullable(),
    completionEvidence: completionEvidenceSchema.nullable(),
  })
  .strict()
  .refine(
    (value) =>
      value.occurrenceState === 'COMPLETED'
        ? value.completedAt !== null &&
          value.completionEvidence?.kind === 'EMOTION_CHECK_IN' &&
          value.completionEvidence.ownerDomain === 'JOURNAL_AI'
        : value.completedAt === null && value.completionEvidence === null,
    'Invalid persisted Emotion outcome.',
  )

export const journalReconciliationSchema = z
  .object({
    schemaVersion: z.literal('journal-entry-occurrence-reconciliation-v1'),
    occurrenceId: z.uuid(),
    actionId: z.uuid(),
    localDate: z.iso.date(),
    journalId: z.uuid(),
    sourceState: z.enum(['RECORDED', 'MISSING', 'DELETED']),
    occurrenceState: z.enum(['SCHEDULED', 'COMPLETED']),
    version: z.number().int().nonnegative(),
    completedAt: instant.nullable(),
    completionEvidence: completionEvidenceSchema.nullable(),
  })
  .strict()
  .refine(
    (value) =>
      value.occurrenceState === 'COMPLETED'
        ? value.completedAt !== null &&
          value.completionEvidence?.kind === 'JOURNAL_ENTRY' &&
          value.completionEvidence.ownerDomain === 'JOURNAL_AI' &&
          value.completionEvidence.factId === value.journalId &&
          value.completionEvidence.factRevision === '1'
        : value.sourceState !== 'RECORDED' &&
          value.completedAt === null &&
          value.completionEvidence === null,
    'Invalid persisted Journal outcome.',
  )

export const supportPlanActionHistorySchema = z
  .object({
    items: z.array(canonicalSupportPlanSchema).max(20),
    nextCursor: z.string().min(1).max(256).nullable(),
    hasMore: z.boolean(),
  })
  .strict()
  .refine(
    (value) =>
      value.hasMore === (value.nextCursor !== null) &&
      value.items.every((item) =>
        ['COMPLETED', 'SUPERSEDED', 'DISCARDED'].includes(item.status),
      ),
    'Invalid terminal history.',
  )

export const nativeReplacementReviewSchema = z
  .object({
    outcome: z.enum([
      'CURRENT_PLAN_VALID_NO_BETTER_ALTERNATIVE',
      'CURRENT_PLAN_VALID_ALTERNATIVES_AVAILABLE',
      'CURRENT_PLAN_NOT_ADMISSIBLE',
    ]),
    rationaleCodes: z.array(z.string().min(1).max(128)).min(1).max(5),
    currentPlan: canonicalSupportPlanSchema,
    proposedPlan: canonicalSupportPlanSchema,
    reassessmentSummary: reassessmentSummaryReferenceSchema,
    reviewedAt: instant,
  })
  .strict()
  .refine(
    (value) =>
      ['ACTIVE', 'PAUSED'].includes(value.currentPlan.status) &&
      value.proposedPlan.status === 'DRAFT' &&
      value.proposedPlan.representationMode === 'NATIVE_V3' &&
      value.reassessmentSummary.summaryVersion === 'reassessment-summary-v2',
    'Invalid replacement context.',
  )

export type CanonicalSupportPlan = z.infer<typeof canonicalSupportPlanSchema>
export type ActionOccurrence = z.infer<typeof actionOccurrenceSchema>
export type ActionOccurrenceList = z.infer<typeof actionOccurrenceListSchema>
export type EmotionReconciliation = z.infer<typeof emotionReconciliationSchema>
export type JournalReconciliation = z.infer<typeof journalReconciliationSchema>
export type SupportPlanActionHistory = z.infer<
  typeof supportPlanActionHistorySchema
>
export type NativeReplacementReview = z.infer<
  typeof nativeReplacementReviewSchema
>
