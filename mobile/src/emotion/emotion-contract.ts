import { z } from 'zod'

export const emotionSchema = z.enum([
  'GREAT',
  'GOOD',
  'OKAY',
  'LOW',
  'VERY_LOW',
])

export const emotionCheckInValueSchema = z
  .object({
    emotion: emotionSchema,
    intensity: z.number().int().min(1).max(5),
    note: z.string().trim().min(1).max(500).nullable(),
  })
  .strict()

export const createEmotionCheckInSchema = emotionCheckInValueSchema
  .extend({
    localDate: z.iso.date(),
    timezone: z.string().min(1).max(64),
  })
  .strict()

export const emotionCheckInSchema = emotionCheckInValueSchema
  .extend({
    id: z.uuid(),
    localDate: z.iso.date(),
    timezone: z.string().min(1).max(64),
    sourceLabel: z.literal('SELF_REPORTED_EMOTION'),
    clinicalUse: z.literal('NOT_A_DIAGNOSIS_OR_SAFETY_CLASSIFIER'),
    revision: z.number().int().min(1).max(32),
    recordedAt: z.iso.datetime(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .strict()

export const emotionCheckInListSchema = z
  .object({
    items: z.array(emotionCheckInSchema).max(90),
    page: z
      .object({
        limit: z.number().int().min(1).max(90),
        hasMore: z.boolean(),
        nextBefore: z.iso.date().optional(),
      })
      .strict(),
    label: z.literal('SELF_REPORTED_EMOTION'),
    interpretation: z.literal('NOT_DIAGNOSIS_OR_RECOVERY'),
  })
  .strict()

const emotionDistributionSchema = z
  .object({
    GREAT: z.number().int().nonnegative(),
    GOOD: z.number().int().nonnegative(),
    OKAY: z.number().int().nonnegative(),
    LOW: z.number().int().nonnegative(),
    VERY_LOW: z.number().int().nonnegative(),
  })
  .strict()

const emotionProgressWindowSchema = z
  .object({
    days: z.union([z.literal(7), z.literal(14), z.literal(30)]),
    startLocalDate: z.iso.date(),
    endLocalDate: z.iso.date(),
    checkedInDays: z.number().int().min(0).max(30),
    totalDays: z.union([z.literal(7), z.literal(14), z.literal(30)]),
    distribution: emotionDistributionSchema,
  })
  .strict()
  .superRefine((window, context) => {
    const total = Object.values(window.distribution).reduce(
      (sum, count) => sum + count,
      0,
    )
    if (
      window.totalDays !== window.days ||
      window.checkedInDays > window.days ||
      total !== window.checkedInDays
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Emotion progress window counts are inconsistent.',
      })
    }
  })

export const emotionCheckInProgressSchema = z
  .object({
    asOfLocalDate: z.iso.date(),
    timezone: z.string().min(1).max(64),
    currentEmotion: emotionSchema.nullable(),
    currentStreak: z.number().int().nonnegative(),
    longestStreak: z.number().int().nonnegative(),
    windows: z.array(emotionProgressWindowSchema).length(3),
    label: z.literal('SELF_REPORTED_EMOTION'),
    interpretation: z.literal('FACTUAL_COUNTS_NOT_DIAGNOSIS_OR_RECOVERY'),
  })
  .strict()
  .superRefine((progress, context) => {
    const periods = new Set(progress.windows.map(({ days }) => days))
    if (![7, 14, 30].every((days) => periods.has(days as 7 | 14 | 30))) {
      context.addIssue({
        code: 'custom',
        message: 'Emotion progress must contain 7, 14, and 30 day windows.',
      })
    }
  })

export const emotionCheckInTombstoneSchema = z
  .object({
    localDate: z.iso.date(),
    deleted: z.literal(true),
    deletedAt: z.iso.datetime(),
  })
  .strict()

export type Emotion = z.infer<typeof emotionSchema>
export type EmotionCheckInValue = z.infer<typeof emotionCheckInValueSchema>
export type CreateEmotionCheckIn = z.infer<typeof createEmotionCheckInSchema>
export type EmotionCheckIn = z.infer<typeof emotionCheckInSchema>
export type EmotionCheckInList = z.infer<typeof emotionCheckInListSchema>
export type EmotionCheckInProgress = z.infer<
  typeof emotionCheckInProgressSchema
>
export type EmotionCheckInTombstone = z.infer<
  typeof emotionCheckInTombstoneSchema
>
