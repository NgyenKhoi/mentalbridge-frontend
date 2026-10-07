import { z } from 'zod'

const planStatusSchema = z.enum([
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
  'SUPERSEDED',
  'DISCARDED',
])

const planResourceSchema = z
  .object({
    resourceId: z.uuid(),
    contentVersion: z.string().regex(/^[0-9]+$/),
    publicationId: z.uuid(),
    role: z.enum(['PRIMARY', 'ADJUNCT']),
    category: z.enum([
      'BREATHING',
      'MEDITATION',
      'ARTICLE',
      'VIDEO',
      'JOURNALING',
      'COMMUNITY',
    ]),
    title: z.string().min(1).max(255),
    summary: z.string().min(1).max(4096),
    externalUrl: z.url().max(2048).nullable().optional(),
  })
  .strict()

const planSlotSchema = z
  .object({
    slotId: z.string().min(1).max(64),
    kind: z.enum(['CORE', 'OPTIONAL']),
    targetDomain: z.enum(['DEPRESSIVE_SYMPTOMS', 'ANXIETY_SYMPTOMS']),
    purposeCode: z.string().min(1).max(64),
    selectedResource: planResourceSchema.nullable(),
    allowedAlternatives: z.array(planResourceSchema).max(10),
  })
  .strict()

export const supportPlanSchema = z
  .object({
    supportPlanId: z.uuid(),
    status: planStatusSchema,
    version: z.number().int().nonnegative(),
    source: z
      .object({
        supportEvaluationId: z.uuid(),
        evaluationVersion: z.literal(2),
        evaluationPolicyVersion: z.literal('mb-support-routing-capstone-v2'),
        evaluatedAt: z.iso.datetime(),
        selectionPolicyVersion: z.literal('mb-support-plan-selection-v1'),
        resourceEligibilityPolicyVersion: z.literal('content-eligibility-v1'),
        resourcesResolvedAt: z.iso.datetime(),
      })
      .strict(),
    entitlement: z
      .object({
        packageCode: z.enum(['PLUS', 'PREMIUM']),
        source: z.enum(['DEMO', 'PAID']),
        policyVersion: z.literal('service-entitlement-v1'),
        version: z.number().int().nonnegative(),
        decidedAt: z.iso.datetime(),
      })
      .strict(),
    rationale: z
      .object({
        code: z.literal('DOMAIN_AWARE_WELLBEING_SUPPORT'),
        text: z.string().min(1).max(2048),
      })
      .strict(),
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
    templateFamilies: z
      .array(
        z
          .object({
            family: z.enum([
              'DEPRESSIVE_MAINTENANCE',
              'DEPRESSIVE_SELF_GUIDED',
              'DEPRESSIVE_PROFESSIONAL_ADJUNCT',
              'ANXIETY_MAINTENANCE',
              'ANXIETY_SELF_GUIDED',
              'ANXIETY_PROFESSIONAL_ADJUNCT',
            ]),
            templateVersion: z.literal(1),
            targetDomain: z.enum(['DEPRESSIVE_SYMPTOMS', 'ANXIETY_SYMPTOMS']),
          })
          .strict(),
      )
      .min(1)
      .max(2),
    slots: z.array(planSlotSchema).min(1).max(5),
    selectedResourceCount: z.number().int().min(1).max(5),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    activatedAt: z.iso.datetime().nullable(),
    completedAt: z.iso.datetime().nullable(),
    completionReason: z
      .enum(['USER_DECISION', 'PLAN_NO_LONGER_FITS', 'OTHER'])
      .nullable(),
    supersededAt: z.iso.datetime().nullable(),
    discardedAt: z.iso.datetime().nullable(),
    disclaimerCode: z.literal('WELLBEING_SUPPORT_NOT_TREATMENT'),
    disclaimer: z.string().min(1).max(1000),
  })
  .strict()

export const supportPlanHistorySchema = z
  .object({
    items: z.array(supportPlanSchema).max(50),
    nextCursor: z.string().min(1).max(256).nullable(),
    hasMore: z.boolean(),
  })
  .strict()

export const occurrenceSchema = z
  .object({
    occurrenceId: z.uuid(),
    supportPlanId: z.uuid(),
    scheduleId: z.uuid(),
    scheduleVersion: z.number().int().min(1),
    localDate: z.iso.date(),
    localTime: z.iso.time(),
    timezone: z.string().min(1).max(64),
    scheduledAt: z.iso.datetime(),
    state: z.enum(['SCHEDULED', 'COMPLETED', 'SKIPPED', 'CANCELLED']),
    displayState: z.enum([
      'SCHEDULED',
      'MISSED',
      'COMPLETED',
      'SKIPPED',
      'CANCELLED',
    ]),
    stateReason: z
      .enum(['PLAN_PAUSED', 'PLAN_COMPLETED', 'PLAN_REPLACED'])
      .nullable(),
    version: z.number().int().nonnegative(),
    source: z
      .object({
        type: z.enum(['RESOURCE', 'JOURNAL_PROMPT', 'EMOTION_CHECK_IN_PROMPT']),
        supportPlanVersion: z.number().int().min(1),
        slotId: z.string().min(1).max(64).nullable(),
        resourceId: z.uuid().nullable(),
        contentVersion: z
          .string()
          .regex(/^[0-9]+$/)
          .nullable(),
        title: z.string().min(1).max(255),
      })
      .strict(),
    updatedAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
    skippedAt: z.iso.datetime().nullable(),
    cancelledAt: z.iso.datetime().nullable(),
    hidden: z.boolean(),
    helpfulness: z
      .enum(['NOT_HELPFUL', 'A_LITTLE_HELPFUL', 'HELPFUL', 'VERY_HELPFUL'])
      .nullable(),
    barrierCode: z
      .enum([
        'LOW_ENERGY',
        'NOT_ENOUGH_TIME',
        'DIFFICULT_TO_START',
        'NOT_A_GOOD_FIT',
        'OTHER',
      ])
      .nullable(),
    reflection: z.string().min(1).max(500).nullable(),
    summaryReuseApproved: z.boolean(),
    engagementUpdatedAt: z.iso.datetime().nullable(),
    interpretationCode: z.literal(
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
    ),
  })
  .strict()

export const occurrenceListSchema = z
  .object({
    supportPlanId: z.uuid(),
    supportPlanStatus: z.enum(['ACTIVE', 'PAUSED']),
    schedulePolicyVersion: z.literal('support-plan-activity-schedule-v1'),
    from: z.iso.date(),
    through: z.iso.date(),
    occurrences: z.array(occurrenceSchema).max(217),
    interpretationCode: z.literal(
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
    ),
  })
  .strict()

const planChangeResourceSchema = z
  .object({
    resourceId: z.uuid(),
    resourceVersion: z.string().regex(/^[0-9]+$/),
    title: z.string().min(1).max(255),
  })
  .strict()

export const planChangeRequestSchema = z
  .object({
    requestId: z.uuid(),
    version: z.number().int().nonnegative(),
    status: z.enum(['READY_FOR_REVIEW', 'ACCEPTED', 'REJECTED']),
    outcomeCode: z.enum([
      'PROPOSAL_ADMISSIBLE',
      'PROPOSAL_APPLIED',
      'USER_REJECTED',
    ]),
    sourceProposalId: z.uuid(),
    sourceAppointmentId: z.uuid(),
    sourceSummaryId: z.uuid(),
    specialistId: z.uuid(),
    proposalReasonCode: z.enum([
      'POST_CONSULTATION_CONTINUITY',
      'TRY_ALTERNATIVE_RESOURCE',
      'ADDRESS_REPORTED_BARRIER',
    ]),
    proposalDetails: z.string().max(500).nullable(),
    targetSlotId: z.string().min(1).max(64),
    currentResource: planChangeResourceSchema.nullable(),
    proposedResource: planChangeResourceSchema,
    currentSupportPlanId: z.uuid(),
    currentSupportPlanVersion: z.number().int().nonnegative(),
    replacementSupportPlanId: z.uuid().nullable(),
    replacementSupportPlanVersion: z.number().int().nonnegative().nullable(),
    reviewedAt: z.iso.datetime(),
    decidedAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict()

const reassessmentPeriodSchema = z
  .object({
    startAt: z.iso.datetime(),
    endAt: z.iso.datetime(),
  })
  .strict()

const reassessmentDimensionStateSchema = z.enum([
  'AVAILABLE',
  'INSUFFICIENT_DATA',
  'UNAVAILABLE',
])

const reassessmentSummarySchema = z
  .object({
    summaryId: z.uuid(),
    summaryVersion: z.enum([
      'reassessment-summary-v1',
      'reassessment-summary-v2',
    ]),
    composedAt: z.iso.datetime(),
    previousPeriod: reassessmentPeriodSchema,
    currentPeriod: reassessmentPeriodSchema,
    screening: z
      .object({
        state: reassessmentDimensionStateSchema,
        trends: z.array(z.unknown()).length(2),
      })
      .loose(),
    journalContext: z
      .object({
        state: reassessmentDimensionStateSchema,
        unavailableReason: z.string().nullable(),
        jobId: z.uuid().nullable(),
        analysisId: z.uuid().nullable(),
        sourceJournalRevisions: z.array(z.unknown()).max(100),
        contextSignals: z.array(z.string().max(64)).max(12),
        emotionIndicators: z.array(z.string().max(64)).max(12),
        recurringThemes: z.array(z.string().max(64)).max(12),
        changesComparedWithPreviousPeriod: z.array(z.unknown()).max(24),
        preferences: z.array(z.string().max(64)).max(12),
        barriers: z.array(z.string().max(64)).max(12),
        helpfulPatterns: z.array(z.string().max(64)).max(12),
        dataCoverage: z.unknown().nullable(),
        provenance: z.unknown().nullable(),
      })
      .loose(),
    supportPlanEngagement: z
      .object({
        state: reassessmentDimensionStateSchema,
        previousPeriod: z
          .object({
            completedCount: z.number().int().nonnegative(),
            skippedCount: z.number().int().nonnegative(),
          })
          .strict(),
        currentPeriod: z
          .object({
            completedCount: z.number().int().nonnegative(),
            skippedCount: z.number().int().nonnegative(),
          })
          .strict(),
        sources: z.array(z.unknown()).max(200),
      })
      .loose(),
    disclaimerCode: z.literal('FOUR_DIMENSIONS_NOT_COMBINED'),
  })
  .loose()

const replacementComparisonSchema = z
  .object({
    change: z.enum(['UNCHANGED', 'CHANGED', 'ADDED', 'REMOVED']),
    currentSlotId: z.string().min(1).max(64).nullable(),
    currentResource: planResourceSchema.nullable(),
    proposedSlotId: z.string().min(1).max(64).nullable(),
    proposedResource: planResourceSchema.nullable(),
  })
  .strict()

export const replacementReviewSchema = z
  .object({
    outcome: z.enum([
      'CURRENT_PLAN_VALID_NO_BETTER_ALTERNATIVE',
      'CURRENT_PLAN_VALID_ALTERNATIVES_AVAILABLE',
      'CURRENT_PLAN_NOT_ADMISSIBLE',
    ]),
    rationaleCodes: z
      .array(
        z.enum([
          'CURRENT_PLAN_ADMISSIBLE',
          'EXACT_SELECTION_UNCHANGED',
          'PROPOSED_SELECTION_DIFFERS',
          'PROPOSED_PLAN_ADMISSIBLE',
          'SUPPORT_EVALUATION_STALE',
          'SUPPORT_PLAN_POLICY_STALE',
          'RESOURCE_VERSION_STALE',
          'SUPPORT_PLAN_INVALID_CHOICE',
          'SUPPORT_PLAN_CORE_UNAVAILABLE',
        ]),
      )
      .length(2),
    comparison: z.array(replacementComparisonSchema).min(1).max(10),
    currentPlan: supportPlanSchema,
    proposedPlan: supportPlanSchema,
    reassessmentSummary: reassessmentSummarySchema,
    reviewedAt: z.iso.datetime(),
  })
  .strict()

export const reassessmentSummaryReferenceSchema = reassessmentSummarySchema

export type SupportPlan = z.infer<typeof supportPlanSchema>
export type SupportPlanHistory = z.infer<typeof supportPlanHistorySchema>
export type SupportPlanOccurrence = z.infer<typeof occurrenceSchema>
export type SupportPlanOccurrenceList = z.infer<typeof occurrenceListSchema>
export type PlanChangeRequest = z.infer<typeof planChangeRequestSchema>
export type ReplacementReview = z.infer<typeof replacementReviewSchema>
export type OccurrenceEngagement = Readonly<{
  state: 'SCHEDULED' | 'COMPLETED' | 'SKIPPED'
  hidden: boolean
  helpfulness:
    'NOT_HELPFUL' | 'A_LITTLE_HELPFUL' | 'HELPFUL' | 'VERY_HELPFUL' | null
  barrierCode:
    | 'LOW_ENERGY'
    | 'NOT_ENOUGH_TIME'
    | 'DIFFICULT_TO_START'
    | 'NOT_A_GOOD_FIT'
    | 'OTHER'
    | null
  reflection: string | null
  summaryReuseApproved: boolean
}>
