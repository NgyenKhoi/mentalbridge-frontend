import { z } from 'zod'

export const reassessmentPeriodSchema = z
  .object({ startAt: z.iso.datetime(), endAt: z.iso.datetime() })
  .strict()
  .refine((period) => Date.parse(period.startAt) < Date.parse(period.endAt), {
    message: 'Reassessment period must be bounded.',
  })

export const reassessmentContextSchema = z
  .object({
    policyVersion: z.literal('reassessment-comparison-v1'),
    state: z.enum(['READY', 'INCOMPLETE']),
    missingInstruments: z.array(z.enum(['PHQ9', 'GAD7'])).max(2),
    phq9AssessmentId: z.uuid().nullable(),
    gad7AssessmentId: z.uuid().nullable(),
    previousPeriod: reassessmentPeriodSchema,
    currentPeriod: reassessmentPeriodSchema,
  })
  .strict()

export const reassessmentExperienceSchema = z.enum([
  'BETTER',
  'ABOUT_THE_SAME',
  'MORE_DIFFICULT',
  'UNSURE',
])

const optionalContext = z.string().trim().min(1).max(500).nullable()

export const reassessmentSelfReportDraftSchema = z
  .object({
    currentExperience: reassessmentExperienceSchema,
    helpfulContext: optionalContext,
    difficultContext: optionalContext,
  })
  .strict()

export const reassessmentSelfReportSchema = reassessmentSelfReportDraftSchema
  .extend({
    selfReportId: z.uuid(),
    sourceVersion: z.literal('reassessment-self-report-v1'),
    currentPeriod: reassessmentPeriodSchema,
    version: z.number().int().nonnegative(),
    authoredAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict()

const dimensionStateSchema = z.enum([
  'AVAILABLE',
  'INSUFFICIENT_DATA',
  'UNAVAILABLE',
])

const screeningPointSchema = z
  .object({
    assessmentId: z.uuid(),
    totalScore: z.number().int().min(0).max(27),
  })
  .passthrough()

const screeningTrendSchema = z
  .object({
    instrument: z.enum(['PHQ9', 'GAD7']),
    state: dimensionStateSchema,
    previous: screeningPointSchema.nullable(),
    current: screeningPointSchema,
    rawDelta: z.number().int().min(-27).max(27).nullable(),
    direction: z.enum([
      'INCREASED',
      'DECREASED',
      'UNCHANGED',
      'INSUFFICIENT_DATA',
    ]),
  })
  .passthrough()

const explicitSelfReportSchema = reassessmentSelfReportDraftSchema
  .extend({
    selfReportId: z.uuid(),
    sourceVersion: z.literal('reassessment-self-report-v1'),
    sourceRevision: z.number().int().nonnegative(),
    currentPeriod: reassessmentPeriodSchema,
    authoredAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict()

export const reassessmentSummarySchema = z
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
        state: dimensionStateSchema,
        trends: z.array(screeningTrendSchema).length(2),
      })
      .passthrough(),
    journalContext: z
      .object({
        state: dimensionStateSchema,
        unavailableReason: z.string().nullable(),
        jobId: z.uuid().nullable().optional(),
        changesComparedWithPreviousPeriod: z
          .array(
            z
              .object({ signal: z.string(), direction: z.string() })
              .passthrough(),
          )
          .max(24),
      })
      .passthrough(),
    supportPlanEngagement: z
      .object({
        state: dimensionStateSchema,
        previousPeriod: z.object({
          completedCount: z.number().int().nonnegative(),
          skippedCount: z.number().int().nonnegative(),
        }),
        currentPeriod: z.object({
          completedCount: z.number().int().nonnegative(),
          skippedCount: z.number().int().nonnegative(),
        }),
      })
      .passthrough(),
    selfReportedExperience: z
      .object({
        state: dimensionStateSchema,
        unavailableReason: z.string().nullable(),
        source: explicitSelfReportSchema.nullable(),
      })
      .strict()
      .optional(),
    activityReflection: z
      .object({ state: dimensionStateSchema, sources: z.array(z.unknown()) })
      .passthrough()
      .optional(),
    disclaimerCode: z.literal('FOUR_DIMENSIONS_NOT_COMBINED'),
  })
  .passthrough()

export type ReassessmentContext = z.infer<typeof reassessmentContextSchema>
export type ReassessmentExperience = z.infer<
  typeof reassessmentExperienceSchema
>
export type ReassessmentSelfReportDraft = z.infer<
  typeof reassessmentSelfReportDraftSchema
>
export type ReassessmentSelfReport = z.infer<
  typeof reassessmentSelfReportSchema
>
export type ReassessmentSummary = z.infer<typeof reassessmentSummarySchema>
