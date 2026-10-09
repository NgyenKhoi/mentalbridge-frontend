import { z } from 'zod'

export const agreedNextStepTypeSchema = z.enum([
  'CHECKLIST',
  'JOURNAL',
  'EMOTION_CHECK_IN',
  'REASSESSMENT',
  'FOLLOW_UP_APPOINTMENT',
  'PLATFORM_RESOURCE',
])

const resourceReasonSchema = z.enum([
  'POST_CONSULTATION_CONTINUITY',
  'TRY_ALTERNATIVE_RESOURCE',
  'ADDRESS_REPORTED_BARRIER',
])

const agreedNextStepSchema = z
  .object({
    id: z.uuid(),
    type: agreedNextStepTypeSchema,
    title: z.string().min(1).max(160),
    details: z.string().max(500).nullable(),
    resourceId: z.uuid().nullable(),
    resourceVersion: z.string().max(64).nullable(),
    resourceProposalReasonCode: resourceReasonSchema.nullable(),
    state: z.enum(['PENDING', 'COMPLETED', 'SKIPPED']).nullable(),
    hidden: z.boolean(),
    stateVersion: z.number().int().nonnegative().nullable(),
    stateUpdatedAt: z.iso.datetime().nullable(),
  })
  .strict()

export const sessionSummarySchema = z
  .object({
    id: z.uuid(),
    appointmentId: z.uuid(),
    userAccountId: z.uuid(),
    specialistAccountId: z.uuid(),
    version: z.number().int().min(1),
    schemaVersion: z.literal('session-summary-v1'),
    topicsDiscussed: z.array(z.string().min(1).max(160)).min(1).max(8),
    progressSummary: z.string().max(1000).nullable(),
    specialistNoteForUser: z.string().max(1000).nullable(),
    followUpSuggested: z.boolean(),
    amendsSummaryId: z.uuid().nullable(),
    publishedAt: z.iso.datetime(),
    reuseConsent: z
      .object({
        approved: z.boolean(),
        version: z.number().int().nonnegative(),
        updatedAt: z.iso.datetime(),
      })
      .strict()
      .nullable(),
    agreedNextSteps: z.array(agreedNextStepSchema).max(8),
  })
  .strict()

export const sessionSummaryListSchema = z
  .object({
    items: z.array(sessionSummarySchema).max(100),
    count: z.number().int().min(0).max(100),
    generatedAt: z.iso.datetime(),
  })
  .strict()
  .refine((value) => value.count === value.items.length, {
    path: ['count'],
    message: 'count must match items',
  })

const publishStepSchema = z
  .object({
    type: agreedNextStepTypeSchema.exclude(['PLATFORM_RESOURCE']),
    title: z.string().trim().min(1).max(160),
    details: z.string().trim().max(500).nullable(),
    resourceId: z.null(),
    resourceVersion: z.null(),
    resourceProposalReasonCode: z.null(),
  })
  .strict()

export const publishSessionSummaryRequestSchema = z
  .object({
    topicsDiscussed: z.array(z.string().trim().min(1).max(160)).min(1).max(8),
    progressSummary: z.string().trim().max(1000).nullable(),
    specialistNoteForUser: z.string().trim().max(1000).nullable(),
    followUpSuggested: z.boolean(),
    agreedNextSteps: z.array(publishStepSchema).max(8),
  })
  .strict()

export type AgreedNextStepType = z.infer<typeof agreedNextStepTypeSchema>
export type PublishSessionSummaryRequest = z.infer<
  typeof publishSessionSummaryRequestSchema
>
export type SessionSummary = z.infer<typeof sessionSummarySchema>
export type SessionSummaryList = z.infer<typeof sessionSummaryListSchema>
