import { z } from 'zod'

export const resourceCategorySchema = z.enum([
  'BREATHING',
  'MEDITATION',
  'ARTICLE',
  'VIDEO',
  'JOURNALING',
  'COMMUNITY',
])

export const resourceKindSchema = z.enum([
  'LEARNING',
  'PRACTICE',
  'HABIT',
  'ACTION',
  'REFLECTION',
])

export const resourceInteractionTypeSchema = z.enum([
  'STRUCTURED_READER',
  'VIDEO_TRANSCRIPT',
  'BREATHING_PACER',
  'GROUNDING_GUIDE',
  'PROGRESSIVE_RELAXATION',
  'WALK_TIMER',
  'STRETCH_SEQUENCE',
  'PROBLEM_SOLVING_WORKSHEET',
  'BEHAVIORAL_ACTIVATION_PLANNER',
  'SELF_COMPASSION_PROMPTS',
  'UNHOOKING_PROMPTS',
  'PREPARE_FOR_SPECIALIST_CHECKLIST',
  'REFLECTION',
])

export const resourceCompletionModeSchema = z.enum([
  'EXPLICIT',
  'STEPS',
  'TIMED',
  'VIDEO_CONFIRMATION',
])

export const resourceSummarySchema = z
  .object({
    id: z.uuid(),
    category: resourceCategorySchema,
    resourceKind: resourceKindSchema,
    interactionType: resourceInteractionTypeSchema,
    repeatability: z.enum(['ONE_TIME', 'REPEATABLE']),
    completionMode: resourceCompletionModeSchema,
    streakEligible: z.boolean(),
    expectedDurationMinutes: z.number().int().min(1),
    cooldownDays: z.number().int().min(0),
    recommendedFrequencyPerWeek: z.number().int().min(1),
    planTags: z.array(z.string().min(1)).refine((values) => {
      return new Set(values).size === values.length
    }, 'Resource plan tags must be unique.'),
    locale: z.string().min(1).max(64),
    title: z.string().trim().min(1).max(255),
    summary: z.string().trim().min(1),
    externalUrl: z.url().nullable().optional(),
    sourceOrganization: z.string().trim().min(1).max(200).nullable().optional(),
    status: z.literal('PUBLISHED'),
    reviewedAt: z.iso.datetime().nullable().optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime().optional(),
  })
  .strict()

export const resourceCatalogueSchema = z
  .object({
    data: z.array(resourceSummarySchema),
    count: z.number().int().nonnegative(),
    nextCursor: z.uuid().optional(),
    fallback: z.literal('unavailable').optional(),
    message: z.string().trim().min(1).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.count !== value.data.length) {
      context.addIssue({
        code: 'custom',
        message: 'Resource catalogue count does not match its items.',
      })
    }
    if (value.fallback === 'unavailable' && value.data.length > 0) {
      context.addIssue({
        code: 'custom',
        message: 'Unavailable catalogue cannot contain resources.',
      })
    }
  })

const openRecordSchema = z.record(z.string(), z.unknown())

export const resourceDetailSchema = resourceSummarySchema
  .extend({
    contentVersion: z
      .string()
      .regex(/^(0|[1-9][0-9]*)$/)
      .max(19),
    contentBody: z.string().nullable(),
    sourceTitle: z.string().trim().min(1).max(500).nullable().optional(),
    sourceUrl: z.url().nullable().optional(),
    sourceReviewNote: z.string().trim().min(1).nullable().optional(),
    structuredContent: openRecordSchema,
    interactionConfig: openRecordSchema,
    safetyNotes: z.array(z.string().trim().min(1).max(500)).max(12),
    sourceRetrievedAt: z.iso.datetime().nullable(),
    sourceContentHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    contentVersionLabel: z.string().trim().min(1).max(64),
    sourceReviewStatus: z.literal('REVIEWED'),
    effectiveAt: z.iso.datetime().nullable(),
    expiresAt: z.iso.datetime().nullable(),
  })
  .strict()

export const resourceProgressStatusSchema = z.enum(['IN_PROGRESS', 'COMPLETED'])

export const completedActionIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9:_-]+$/)

export const resourceProgressItemSchema = z
  .object({
    resourceId: z.uuid(),
    localDate: z.iso.date(),
    contentVersion: z
      .string()
      .regex(/^(0|[1-9][0-9]*)$/)
      .max(19),
    status: resourceProgressStatusSchema,
    completedActionIds: z.array(completedActionIdSchema).max(32),
    practiceSessionId: z.uuid().optional(),
    practiceStartedAt: z.iso.datetime().optional(),
    practiceDurationSeconds: z.number().int().min(1).max(7200).optional(),
    completedAt: z.iso.datetime().nullable(),
    updatedAt: z.iso.datetime(),
    version: z
      .string()
      .regex(/^(0|[1-9][0-9]*)$/)
      .max(19),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      new Set(value.completedActionIds).size !== value.completedActionIds.length
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Completed action identifiers must be unique.',
      })
    }
  })

export const resourceProgressListSchema = z
  .object({ items: z.array(resourceProgressItemSchema) })
  .strict()

export const resourceProgressUpdateSchema = z
  .object({
    status: resourceProgressStatusSchema,
    completedActionIds: z.array(completedActionIdSchema).max(32),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      new Set(value.completedActionIds).size !== value.completedActionIds.length
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Completed action identifiers must be unique.',
      })
    }
  })

export type ResourceCategory = z.infer<typeof resourceCategorySchema>
export type ResourceSummary = z.infer<typeof resourceSummarySchema>
export type ResourceCatalogue = z.infer<typeof resourceCatalogueSchema>
export type ResourceDetail = z.infer<typeof resourceDetailSchema>
export type ResourceProgressItem = z.infer<typeof resourceProgressItemSchema>
export type ResourceProgressUpdate = z.infer<
  typeof resourceProgressUpdateSchema
>
