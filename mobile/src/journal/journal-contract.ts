import { z } from 'zod'

import {
  consentCollectionSchema,
  consentDecisionSchema,
} from '@/assessment/assessment-contract'

export { consentCollectionSchema, consentDecisionSchema }

const instant = z.iso.datetime({ offset: true })
const revision = z.number().int().min(1).max(200)
const signals = z.array(z.string().min(1).max(64)).max(12)
const provider = z.enum(['DETERMINISTIC_FAKE', 'GEMINI', 'OPENAI', 'BEDROCK'])
export const journalMoodSchema = z.enum([
  'GREAT',
  'GOOD',
  'OKAY',
  'LOW',
  'VERY_LOW',
])
const contentInput = z
  .object({ text: z.string().min(1).max(12000).regex(/\S/) })
  .strict()
const tags = z.array(z.string().min(1).max(40)).max(20)
export const journalWriteSchema = z
  .object({ content: contentInput, mood: journalMoodSchema, tags })
  .strict()
export const journalCreateSchema = journalWriteSchema
  .extend({ clientEntryId: z.uuid(), occurredAt: instant })
  .strict()

const metadata = z.object({
  id: z.uuid(),
  ownerAccountId: z.uuid(),
  currentRevision: z.number().int().min(1),
  occurredAt: instant,
  createdAt: instant,
  updatedAt: instant,
  deleted: z.literal(false),
  tags,
  mood: journalMoodSchema.nullable(),
  encryption: z
    .object({
      algorithm: z.literal('AES-256-GCM'),
      keyId: z.string().min(1),
      encryptedAt: instant,
    })
    .strict(),
  analysisState: z.enum(['not_requested', 'current', 'stale']),
})
export const journalEntrySchema = metadata
  .extend({
    content: z
      .object({
        text: z.string().min(1).max(12000),
        byteLength: z.number().int().positive(),
      })
      .strict(),
  })
  .strict()
export const journalSummarySchema = metadata
  .extend({
    content: z
      .object({
        preview: z.string().max(160),
        byteLength: z.number().int().positive(),
      })
      .strict(),
  })
  .strict()
export const journalPageSchema = z
  .object({
    items: z.array(journalSummarySchema).max(50),
    page: z
      .object({
        limit: z.number().int().min(1).max(50),
        hasMore: z.boolean(),
        nextCursor: z.string().optional(),
      })
      .strict(),
  })
  .strict()
  .refine(
    (value) => !value.page.hasMore || Boolean(value.page.nextCursor),
    'Missing pagination cursor.',
  )
export const journalTombstoneSchema = z
  .object({
    id: z.uuid(),
    ownerAccountId: z.uuid(),
    deleted: z.literal(true),
    deletedAt: instant,
  })
  .strict()

export const aiDisclosureSchema = z
  .object({
    consentType: z.literal('AI_PROCESSING'),
    version: z.literal('ai-processing-capstone-v1'),
    locale: z.literal('vi-VN'),
    title: z.string().min(1).max(160),
    content: z.string().min(1).max(4000),
    capstoneOnly: z.literal(true),
  })
  .strict()
export const aiAuthorizationSchema = z
  .object({
    authorized: z.boolean(),
    reason: z.enum(['GRANTED', 'MISSING', 'REVOKED', 'POLICY_OUTDATED']),
    consentType: z.literal('AI_PROCESSING'),
    policyVersion: z.string().max(64).nullable(),
    decidedAt: instant.nullable(),
  })
  .strict()
  .refine(
    (value) => value.authorized === (value.reason === 'GRANTED'),
    'Inconsistent consent authorization.',
  )

export const terminalReasonSchema = z.enum([
  'CONSENT_REQUIRED',
  'CONSENT_REVOKED',
  'CONSENT_UNAVAILABLE',
  'ENTITLEMENT_UNAVAILABLE',
  'ENTITLEMENT_CHANGED',
  'AUTHORIZATION_CONTEXT_LOST',
  'REVISION_STALE',
  'JOURNAL_DELETED',
  'PROVIDER_TIMEOUT',
  'PROVIDER_UNAVAILABLE',
  'INVALID_PROVIDER_RESULT',
  'INTERNAL_ERROR',
])
const trendTerminal = z.enum([
  'CONSENT_REQUIRED',
  'CONSENT_REVOKED',
  'CONSENT_UNAVAILABLE',
  'ENTITLEMENT_UNAVAILABLE',
  'ENTITLEMENT_CHANGED',
  'AUTHORIZATION_CONTEXT_LOST',
  'SOURCE_REVISION_CHANGED',
  'SOURCE_DELETED',
  'PROVIDER_TIMEOUT',
  'PROVIDER_UNAVAILABLE',
  'INVALID_PROVIDER_RESULT',
  'INTERNAL_ERROR',
])
export const analysisResultSchema = z
  .object({
    summary: z.string().min(1).max(800).optional(),
    contextSignals: signals,
    emotionIndicators: signals,
    themes: signals,
    preferenceSignals: signals,
    barrierSignals: signals,
    sentiment: z.string().min(1).max(32).optional(),
    modelConfidence: z.number().min(0).max(1).optional(),
    suggestedAction: z.enum([
      'NONE',
      'OFFER_RESOURCE_EXPLANATION',
      'GUIDE_APPROVED_ACTIVITY',
      'REQUEST_ALLOWED_ALTERNATIVE',
      'REQUEST_PLAN_REVIEW',
      'OPEN_PROFESSIONAL_SUPPORT',
      'OPEN_SAFETY_GUIDANCE',
    ]),
    workload: z.literal('EXACT_REVISION').optional(),
    servicePlan: z.enum(['FREE', 'PLUS', 'PREMIUM']).optional(),
    entitlementSource: z.enum(['DEFAULT_FREE', 'DEMO', 'PAID']).optional(),
    entitlementPolicyVersion: z.string().min(1).max(96).optional(),
    entitlementVersion: z.number().int().nonnegative().optional(),
    routingPolicyVersion: z.string().min(1).max(96).optional(),
    providerApprovalVersion: z.string().min(1).max(96).optional(),
    provider,
    model: z.string().min(1).max(128),
    promptVersion: z.string().min(1).max(96),
    schemaVersion: z.literal(1),
    latencyMs: z.number().int().nonnegative().optional(),
    inputTokens: z.number().int().nonnegative().nullable().optional(),
    outputTokens: z.number().int().nonnegative().nullable().optional(),
    estimatedCostMicroUsd: z.number().int().nonnegative().nullable().optional(),
    createdAt: instant,
  })
  .strict()
const jobBase = z.object({
  jobId: z.uuid(),
  status: z.enum(['RUNNING', 'SUCCEEDED', 'FAILED']),
  attemptCount: z.number().int().min(0).max(2),
  createdAt: instant,
  updatedAt: instant,
  completedAt: instant.nullable().optional(),
})
function consistentJob(value: {
  status: string
  result?: unknown
  terminalReason?: string | null | undefined
  completedAt?: string | null | undefined
}) {
  if (value.status === 'SUCCEEDED')
    return Boolean(value.result && value.completedAt && !value.terminalReason)
  if (value.status === 'FAILED')
    return Boolean(!value.result && value.terminalReason && value.completedAt)
  return !value.result && !value.terminalReason && !value.completedAt
}
export const analysisJobSchema = jobBase
  .extend({
    journalId: z.uuid(),
    journalRevision: revision,
    terminalReason: terminalReasonSchema.nullable().optional(),
    result: analysisResultSchema.nullable().optional(),
  })
  .strict()
  .refine(consistentJob, 'Inconsistent analysis state.')

export const periodSchema = z
  .object({ startAt: instant, endAt: instant })
  .strict()
export const trendRequestSchema = z
  .object({
    previousPeriod: periodSchema,
    currentPeriod: periodSchema,
    excludedJournalIds: z.array(z.uuid()).max(100).optional(),
  })
  .strict()
  .refine((value) => {
    const previousStart = Date.parse(value.previousPeriod.startAt)
    const previousEnd = Date.parse(value.previousPeriod.endAt)
    const currentStart = Date.parse(value.currentPeriod.startAt)
    const currentEnd = Date.parse(value.currentPeriod.endAt)
    const duration = previousEnd - previousStart
    return (
      duration >= 7 * 86400000 &&
      duration <= 31 * 86400000 &&
      duration === currentEnd - currentStart &&
      previousEnd <= currentStart &&
      currentEnd <= Date.now() &&
      new Set(value.excludedJournalIds).size ===
        (value.excludedJournalIds?.length ?? 0)
    )
  }, 'Periods must be bounded, equal and non-overlapping.')
const sourceSchema = z
  .object({
    journalId: z.uuid(),
    journalRevision: revision,
    period: z.enum(['PREVIOUS', 'CURRENT']),
  })
  .strict()
const coverageSchema = z
  .object({
    previousPeriodJournalEntryCount: z.number().int().min(0).max(100),
    currentPeriodJournalEntryCount: z.number().int().min(0).max(100),
    sufficientForComparison: z.boolean(),
  })
  .strict()
const trendIdentity = z.object({
  previousPeriod: periodSchema,
  currentPeriod: periodSchema,
  sourceJournalRevisions: z.array(sourceSchema).max(100),
  dataCoverage: coverageSchema,
})
export const trendResultSchema = trendIdentity
  .extend({
    analysisId: z.uuid(),
    contextSignals: signals,
    emotionIndicators: signals,
    recurringThemes: signals,
    changesComparedWithPreviousPeriod: z
      .array(
        z
          .object({
            signal: z.string().min(1).max(64),
            direction: z.enum([
              'MORE_FREQUENT',
              'LESS_FREQUENT',
              'SIMILAR',
              'INSUFFICIENT_DATA',
            ]),
          })
          .strict(),
      )
      .max(24),
    preferences: signals,
    barriers: signals,
    helpfulPatterns: signals,
    provider,
    model: z.string().min(1).max(128),
    promptVersion: z.literal('longitudinal-v1'),
    schemaVersion: z.literal(1),
    createdAt: instant,
  })
  .strict()
export const trendJobSchema = jobBase
  .extend(trendIdentity.shape)
  .extend({
    terminalReason: trendTerminal.nullable().optional(),
    result: trendResultSchema.nullable(),
    completedAt: instant.nullable(),
  })
  .strict()
  .refine(consistentJob, 'Inconsistent comparison state.')
  .refine((value) => {
    if (!value.result) return true
    return (
      value.result.analysisId === value.jobId &&
      samePeriods(value, value.result) &&
      JSON.stringify(value.sourceJournalRevisions) ===
        JSON.stringify(value.result.sourceJournalRevisions) &&
      JSON.stringify(value.dataCoverage) ===
        JSON.stringify(value.result.dataCoverage)
    )
  }, 'Comparison evidence does not match its job.')

export function samePeriods(
  a: {
    previousPeriod: z.infer<typeof periodSchema>
    currentPeriod: z.infer<typeof periodSchema>
  },
  b: {
    previousPeriod: z.infer<typeof periodSchema>
    currentPeriod: z.infer<typeof periodSchema>
  },
) {
  return ['startAt', 'endAt'].every((key) => {
    const field = key as 'startAt' | 'endAt'
    return (
      Date.parse(a.previousPeriod[field]) ===
        Date.parse(b.previousPeriod[field]) &&
      Date.parse(a.currentPeriod[field]) === Date.parse(b.currentPeriod[field])
    )
  })
}
export type JournalEntry = z.infer<typeof journalEntrySchema>
export type JournalSummary = z.infer<typeof journalSummarySchema>
export type JournalPage = z.infer<typeof journalPageSchema>
export type JournalWrite = z.infer<typeof journalWriteSchema>
export type JournalCreate = z.infer<typeof journalCreateSchema>
export type JournalMood = z.infer<typeof journalMoodSchema>
export type AnalysisJob = z.infer<typeof analysisJobSchema>
export type TrendJob = z.infer<typeof trendJobSchema>
export type TrendRequest = z.infer<typeof trendRequestSchema>
export type AiDisclosure = z.infer<typeof aiDisclosureSchema>
export type AiAuthorization = z.infer<typeof aiAuthorizationSchema>
export type AnalysisTarget =
  | { kind: 'EXACT'; journalId: string; revision: number }
  | { kind: 'TREND'; request: TrendRequest }
