import { z } from 'zod'

const instant = z.iso.datetime({ offset: true })
const localDate = z.iso.date()

export const resourceBookmarkSchema = z
  .object({
    resourceId: z.uuid(),
    contentVersion: z.string().min(1).max(128),
    savedAt: instant,
    version: z.string().min(1).max(128),
  })
  .strict()

export const resourceBookmarkListSchema = z
  .object({ items: z.array(resourceBookmarkSchema).max(1000) })
  .strict()

export const bingoItemSchema = z
  .object({
    position: z.number().int().min(1).max(25),
    resourceId: z.uuid(),
    actionId: z.string().min(1).max(255).nullable(),
    retired: z.boolean(),
    contentVersion: z.string().min(1).max(128),
    label: z.string().min(1).max(255),
    evidence: z.enum(['NONE', 'SELF_CONFIRMED', 'CONTENT_VERIFIED']),
    selfConfirmedAt: instant.nullable(),
    verifiedAt: instant.nullable(),
    verificationSource: z
      .enum(['RESOURCE_COMPLETION', 'PRACTICE_SESSION'])
      .nullable(),
  })
  .strict()

const bingoBoardShape = {
  weekStart: localDate,
  timeZone: z.string().min(1).max(64),
  version: z.string().min(1).max(128),
  updatedAt: instant,
  items: z.array(bingoItemSchema).max(25),
}

export const resourceBingoBoardSchema = z.object(bingoBoardShape).strict()

export const resourceBingoPlanSyncSchema = z
  .object({
    ...bingoBoardShape,
    unavailableActions: z
      .array(
        z
          .object({
            actionId: z.string().min(1).max(255),
            reason: z.enum(['RESOURCE_VERSION_UNAVAILABLE', 'BOARD_FULL']),
          })
          .strict(),
      )
      .max(100),
  })
  .strict()

export const resourceRewardSchema = z
  .object({
    totalXp: z.number().int().nonnegative(),
    level: z.number().int().nonnegative(),
    nextLevelXp: z.number().int().nonnegative().nullable(),
    visibilityState: z.enum(['VISIBLE', 'HIDDEN']),
    preferenceVersion: z.string().min(1).max(128),
    policyVersion: z.string().min(1).max(128),
    sourceAvailability: z.literal('AVAILABLE'),
    calculatedAt: instant,
    recentGrants: z
      .array(
        z
          .object({
            grantId: z.string().min(1).max(255),
            kind: z.enum(['RESOURCE_COMPLETION', 'VERIFIED_PRACTICE']),
            xp: z.number().int().positive(),
            resourceId: z.uuid(),
            contentVersion: z.string().min(1).max(128),
            localDate,
            grantedAt: instant,
            sourceReference: z.string().min(1).max(255),
            ruleVersion: z.string().min(1).max(128),
          })
          .strict(),
      )
      .max(100),
  })
  .strict()

const achievementProgressSchema = z
  .object({
    current: z.number().int().nonnegative(),
    target: z.number().int().positive(),
    unit: z.enum([
      'EVENT',
      'CONSECUTIVE_DAY',
      'DISTINCT_RESOURCE',
      'PRACTICE_DAY',
    ]),
  })
  .strict()

export const achievementCollectionSchema = z
  .object({
    visibilityState: z.enum(['VISIBLE', 'HIDDEN']),
    preferenceVersion: z.string().min(1).max(128),
    policyVersion: z.literal('achievement-rules-v1'),
    calculatedAt: instant,
    sources: z
      .array(
        z
          .object({
            domain: z.enum([
              'JOURNAL',
              'EMOTION_CHECK_IN',
              'RESOURCE',
              'JOURNEY',
            ]),
            availability: z.enum(['AVAILABLE', 'UNAVAILABLE', 'DEFERRED']),
            asOfLocalDate: localDate.nullable(),
          })
          .strict(),
      )
      .max(10),
    items: z
      .array(
        z
          .object({
            definitionId: z.string().min(1).max(255),
            domain: z.enum([
              'JOURNAL',
              'EMOTION_CHECK_IN',
              'RESOURCE',
              'JOURNEY',
            ]),
            kind: z.enum(['MILESTONE', 'CONSISTENCY', 'JOURNEY']),
            tier: z.enum([
              'FIRST_STEP',
              'STEADY_STEP',
              'DEEPENING_STEP',
              'JOURNEY',
            ]),
            title: z.string().min(1).max(255),
            description: z.string().min(1).max(1000),
            status: z.enum([
              'EARNED',
              'UNEARNED',
              'SOURCE_UNAVAILABLE',
              'GRANDFATHERED',
              'DEFERRED',
            ]),
            evidenceClass: z.enum([
              'OWNER_SOURCE_FACT',
              'OWNER_STREAK_MILESTONE',
              'OWNER_PRACTICE_WINDOW',
              'USER_CONFIRMED_JOURNEY',
            ]),
            unlockedAt: instant.nullable(),
            ruleVersion: z.literal('achievement-rules-v1'),
            privacy: z.literal('PRIVATE'),
            progress: achievementProgressSchema.nullable(),
          })
          .strict(),
      )
      .max(200),
  })
  .strict()

export type ResourceBookmark = z.infer<typeof resourceBookmarkSchema>
export type ResourceBingoBoard = z.infer<typeof resourceBingoBoardSchema>
export type ResourceBingoPlanSync = z.infer<typeof resourceBingoPlanSyncSchema>
export type ResourceReward = z.infer<typeof resourceRewardSchema>
export type AchievementCollection = z.infer<typeof achievementCollectionSchema>
