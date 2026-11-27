import { z } from 'zod'

import { reassessmentSummarySchema } from '@/reassessment/reassessment-contract'

import { canonicalSupportPlanSchema } from './support-plan-action-contract'

const evidenceRefSchema = z
  .object({
    source: z.enum([
      'SCREENING_PHQ9',
      'SCREENING_GAD7',
      'JOURNAL_CONTEXT',
      'PLAN_ENGAGEMENT',
      'SELF_REPORTED_EXPERIENCE',
      'ACTIVITY_REFLECTION',
      'PATTERN',
      'PREFERENCES',
    ]),
    refId: z.string().max(128).nullable(),
  })
  .strict()

const optionKindSchema = z.enum([
  'KEEP_CURRENT',
  'LOWER_WORKLOAD',
  'DIFFERENT_TIME',
  'ALTERNATIVE_ACTION',
  'DIFFERENT_FOCUS',
  'PROFESSIONAL_SUPPORT_NEXT_STEP',
])

export const adaptiveReviewOptionSchema = z
  .object({
    optionId: z.string().min(1).max(128),
    kind: optionKindSchema,
    executionKind: z.enum([
      'NO_CHANGE',
      'CONTINUE_CYCLE',
      'UPDATE_SCHEDULE',
      'PREPARE_REPLACEMENT',
      'NAVIGATE_PROFESSIONAL_SUPPORT',
    ]),
    actionId: z.uuid().nullable(),
    focusId: z.string().max(128).nullable(),
    rationaleCodes: z.array(z.string().min(1).max(128)).min(1).max(5),
    evidenceRefs: z.array(evidenceRefSchema).max(10),
    conflictingEvidenceRefs: z.array(evidenceRefSchema).max(10),
    changes: z
      .array(
        z
          .object({
            field: z.enum([
              'ACTION',
              'ESTIMATED_DURATION_MINUTES',
              'DAYS_PER_WEEK',
              'PREFERRED_DAYPART',
              'LOCAL_TIME',
              'FOCUS_ORDER',
            ]),
            before: z.string().max(255).nullable(),
            after: z.string().max(255).nullable(),
          })
          .strict(),
      )
      .max(6),
  })
  .strict()

export const adaptiveReviewSchema = z
  .object({
    schemaVersion: z.literal('adaptive-support-plan-review-v1'),
    policyVersion: z.literal('support-plan-review-v1'),
    supportPlanId: z.uuid(),
    planVersion: z.number().int().nonnegative(),
    planStatus: z.enum(['ACTIVE', 'PAUSED']),
    reviewedAt: z.iso.datetime(),
    programPeriod: z
      .object({
        startedOn: z.iso.date(),
        asOf: z.iso.date(),
        timezone: z.string().min(1).max(64),
        elapsedDays: z.number().int().min(1),
        pausedDays: z.number().int().nonnegative(),
        fullCycleElapsed: z.boolean(),
        scheduledCount: z.number().int().nonnegative(),
        completedCount: z.number().int().nonnegative(),
        skippedCount: z.number().int().nonnegative(),
        openCount: z.number().int().nonnegative(),
      })
      .strict(),
    reviewState: z.enum(['EARLY', 'REVIEW_DUE', 'PAUSED']),
    reassessment: z
      .object({
        state: z.enum([
          'AVAILABLE',
          'NOT_STARTED',
          'INCOMPLETE',
          'STALE',
          'UNAVAILABLE',
        ]),
        reasonCode: z.string().max(128).nullable(),
        summary: reassessmentSummarySchema.nullable(),
      })
      .strict(),
    currentAdmission: z.enum(['ADMISSIBLE', 'INADMISSIBLE', 'UNAVAILABLE']),
    outcome: z
      .enum([
        'CURRENT_PLAN_VALID_NO_BETTER_ALTERNATIVE',
        'CURRENT_PLAN_VALID_ALTERNATIVES_AVAILABLE',
        'CURRENT_PLAN_NOT_ADMISSIBLE',
      ])
      .nullable(),
    patterns: z
      .array(
        z
          .object({
            patternId: z.string(),
            kind: z.enum(['REPEATED_BARRIER', 'REPEATED_HELPFUL']),
            code: z.enum([
              'NOT_ENOUGH_TIME',
              'LOW_ENERGY',
              'NOT_A_GOOD_FIT',
              'HELPFUL',
            ]),
            actionId: z.uuid(),
            actionTitle: z.string(),
            count: z.number().int().min(2),
            occurrenceIds: z.array(z.uuid()).min(2).max(31),
          })
          .strict(),
      )
      .max(20),
    contradictions: z
      .array(
        z
          .object({
            contradictionId: z.string(),
            kind: z.enum([
              'INSTRUMENT_DIRECTIONS_DIFFER',
              'SELF_REPORT_DIFFERS_FROM_SCREENING',
              'JOURNAL_DIFFERS_FROM_SCREENING',
            ]),
            evidenceRefs: z.array(evidenceRefSchema).min(2).max(6),
          })
          .strict(),
      )
      .max(10),
    options: z.array(adaptiveReviewOptionSchema).max(8),
    unavailableOptions: z
      .array(
        z
          .object({
            kind: optionKindSchema,
            reasonCode: z.enum([
              'NO_SUPPORTING_PATTERN',
              'NO_TIME_PREFERENCE',
              'NO_ADMITTED_CANDIDATE',
              'REASSESSMENT_REQUIRED',
              'ADMISSION_UNAVAILABLE',
              'CURRENT_PLAN_NOT_ADMISSIBLE',
              'PLAN_PAUSED',
              'ENTITLEMENT_REQUIRED',
            ]),
          })
          .strict(),
      )
      .max(6),
    reviewFingerprint: z.string().min(16).max(128),
  })
  .passthrough()
  .refine(
    (review) =>
      review.options.every(
        (option, index) =>
          review.options.findIndex(
            (item) => item.optionId === option.optionId,
          ) === index,
      ),
    'Adaptive review option identities must be unique.',
  )

export const adaptiveReviewConfirmationSchema = z
  .object({
    result: z.enum([
      'KEPT',
      'CYCLE_CONTINUED',
      'SCHEDULE_UPDATED',
      'DRAFT_PREPARED',
      'REPLACED',
    ]),
    optionId: z.string().min(1).max(128),
    plan: canonicalSupportPlanSchema,
    draft: canonicalSupportPlanSchema.nullable(),
  })
  .strict()
  .refine(
    (value) => (value.result === 'DRAFT_PREPARED') === (value.draft !== null),
    'Prepared replacement must include its draft.',
  )
  .refine(
    (value) => value.draft === null || value.draft.status === 'DRAFT',
    'Prepared replacement candidate must still be a DRAFT.',
  )

export type AdaptiveReview = z.infer<typeof adaptiveReviewSchema>
export type AdaptiveReviewOption = z.infer<typeof adaptiveReviewOptionSchema>
export type AdaptiveReviewConfirmation = z.infer<
  typeof adaptiveReviewConfirmationSchema
>
