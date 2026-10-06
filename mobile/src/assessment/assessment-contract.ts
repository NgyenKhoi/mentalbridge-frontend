import { z } from 'zod'

export const instrumentSchema = z.enum(['PHQ9', 'GAD7'])
export const screeningLevelSchema = z.enum([
  'MINIMAL',
  'MILD',
  'MODERATE',
  'MODERATELY_SEVERE',
  'SEVERE',
])
export const safetyStatusSchema = z.enum([
  'NEGATIVE_SAFETY_SCREEN',
  'POSITIVE_SAFETY_SCREEN',
  'NOT_APPLICABLE',
])

export const questionnaireSchema = z
  .object({
    definitionId: z.uuid(),
    instrument: instrumentSchema,
    version: z.string().min(1).max(32),
    locale: z.string().min(2).max(16),
    title: z.string().min(1).max(255),
    referencePeriodDays: z.number().int().min(1).max(365),
    scoringVersion: z.string().min(1).max(32),
    responseOptions: z
      .array(
        z
          .object({
            value: z.number().int().min(0).max(3),
            label: z.string().min(1).max(120),
          })
          .strict(),
      )
      .length(4),
    questions: z
      .array(
        z
          .object({
            questionId: z.uuid(),
            itemNumber: z.number().int().min(1).max(32),
            prompt: z.string().min(1).max(1000),
          })
          .strict(),
      )
      .min(1)
      .max(32),
    scoreBands: z
      .array(
        z
          .object({
            screeningLevel: screeningLevelSchema,
            minimumScore: z.number().int().min(0).max(27),
            maximumScore: z.number().int().min(0).max(27),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict()

export const privacyDisclosureSchema = z
  .object({
    consentType: z.literal('PRIVACY_POLICY'),
    version: z.literal('privacy-capstone-v3'),
    locale: z.literal('vi-VN'),
    title: z.string().min(1).max(160),
    content: z.string().min(1).max(4000),
    capstoneOnly: z.literal(true),
  })
  .strict()

export const consentDecisionSchema = z
  .object({
    decisionId: z.uuid(),
    consentType: z.enum(['PRIVACY_POLICY', 'AI_PROCESSING']),
    policyVersion: z.string().min(1).max(64),
    granted: z.boolean(),
    decidedAt: z.iso.datetime(),
  })
  .strict()

export const consentCollectionSchema = z
  .object({ decisions: z.array(consentDecisionSchema).max(2) })
  .strict()

export const assessmentSubmissionSchema = z
  .object({
    questionnaireDefinitionId: z.uuid(),
    privacyPolicyVersion: z.literal('privacy-capstone-v3'),
    privacyDisclosureAcknowledged: z.literal(true),
    answers: z
      .array(
        z
          .object({
            questionId: z.uuid(),
            value: z.number().int().min(0).max(3),
          })
          .strict(),
      )
      .min(1)
      .max(32),
  })
  .strict()

const assessmentResultSchema = z
  .object({
    totalScore: z.number().int().min(0).max(27),
    screeningLevel: screeningLevelSchema,
    scoringVersion: z.string().min(1).max(32),
    safetyStatus: safetyStatusSchema,
    safetyPolicyVersion: z.string().max(64).nullable(),
    disclaimerCode: z.literal('SCREENING_NOT_DIAGNOSIS'),
  })
  .strict()

export const assessmentSchema = z
  .object({
    assessmentId: z.uuid(),
    questionnaireDefinitionId: z.uuid(),
    instrument: instrumentSchema,
    questionnaireVersion: z.string().min(1).max(32),
    privacyPolicyVersion: z.string().min(1).max(64),
    submittedAt: z.iso.datetime(),
    voidedAt: z.iso.datetime().nullable().optional(),
    result: assessmentResultSchema,
  })
  .strict()

export const assessmentHistorySchema = z
  .object({
    items: z.array(assessmentSchema.omit({ voidedAt: true })).max(50),
    nextCursor: z.string().min(1).max(256).nullable().optional(),
    hasMore: z.boolean(),
  })
  .strict()

export const screeningEpisodeSchema = z
  .object({
    episodeId: z.uuid(),
    purpose: z.enum(['INITIAL_CHECK', 'REASSESSMENT']),
    status: z.enum(['IN_PROGRESS', 'READY', 'COMPLETED']),
    phq9AssessmentId: z.uuid().nullable().optional(),
    gad7AssessmentId: z.uuid().nullable().optional(),
    supportEvaluationId: z.uuid().nullable().optional(),
    presentationEvaluationId: z.uuid().nullable().optional(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable().optional(),
    version: z.number().int().nonnegative(),
  })
  .strict()

const supportEvidenceSchema = z
  .object({
    assessmentId: z.uuid(),
    instrument: instrumentSchema,
    questionnaireVersion: z.string().min(1).max(32),
    scoringVersion: z.string().min(1).max(32),
    screeningLevel: screeningLevelSchema,
    safetyStatus: safetyStatusSchema,
    meaning: z
      .object({
        meaningCode: z.string().min(1).max(64),
        contentVersion: z.string().min(1).max(64),
        referencePeriodDays: z.literal(14),
        text: z.string().min(1).max(1000),
        limitation: z.string().min(1).max(1000),
      })
      .strict(),
  })
  .strict()

export const supportEvaluationSchema = z
  .object({
    supportEvaluationId: z.uuid(),
    policyVersion: z.literal('mb-support-routing-capstone-v1'),
    evaluatedAt: z.iso.datetime(),
    supportTier: z.enum([
      'SELF_GUIDED_SUPPORT',
      'PROFESSIONAL_SUPPORT_RECOMMENDED',
      'SAFETY_FOLLOW_UP_RECOMMENDED',
    ]),
    reasonCodes: z
      .array(
        z.enum([
          'ALL_SCREENING_LEVELS_MINIMAL_OR_MILD',
          'PHQ9_MODERATE_OR_HIGHER',
          'GAD7_MODERATE_OR_HIGHER',
          'PHQ9_SAFETY_SCREEN_POSITIVE',
        ]),
      )
      .min(1)
      .max(2),
    evidence: z.array(supportEvidenceSchema).length(2),
    nextStep: z
      .object({
        code: z.string().min(1).max(64),
        contentVersion: z.string().min(1).max(64),
        text: z.string().min(1).max(1000),
        boundary: z.string().min(1).max(1000),
      })
      .strict(),
    safetyGuidance: z.string().min(1).max(1000).nullable(),
    disclaimerCode: z.literal('SCREENING_NOT_DIAGNOSIS'),
    disclaimer: z.string().min(1),
  })
  .strict()

export const screeningEpisodeEvaluationOutcomeSchema = z
  .object({
    episode: screeningEpisodeSchema,
    presentationEvaluation: supportEvaluationSchema,
  })
  .strict()

const supportGuideSchema = z
  .object({
    supportGuideId: z.uuid(),
    guideVersion: z.literal(1),
    guidePolicyVersion: z.literal('mb-support-guide-capstone-v1'),
    supportEvaluationId: z.uuid(),
    generatedAt: z.iso.datetime(),
    guideType: z.literal('ONE_TIME_SUPPORT_GUIDE'),
    explanation: z.object({ code: z.string(), text: z.string() }).strict(),
    safety: z
      .object({
        status: z.enum(['NEGATIVE_SAFETY_SCREEN', 'POSITIVE_SAFETY_SCREEN']),
        reasonCode: z.enum(['PHQ9_ITEM9_NEGATIVE', 'PHQ9_ITEM9_POSITIVE']),
        policyVersion: z.string(),
        guidanceCode: z.string(),
        guidance: z.string(),
      })
      .strict(),
    resourceResolution: z
      .object({
        status: z.enum([
          'AVAILABLE',
          'PARTIAL',
          'EMPTY',
          'STALE',
          'UNAVAILABLE',
        ]),
        policyVersion: z.string(),
        resolvedAt: z.iso.datetime(),
      })
      .strict(),
    resources: z
      .array(
        z
          .object({
            resourceId: z.uuid(),
            contentVersion: z.string(),
            publicationId: z.uuid(),
            domain: z.enum(['DEPRESSIVE_SYMPTOMS', 'ANXIETY_SYMPTOMS']),
            role: z.enum(['PRIMARY', 'ADJUNCT']),
            category: z.string(),
            title: z.string().min(1).max(255),
            summary: z.string().min(1),
            externalUrl: z.url().nullable().optional(),
          })
          .strict(),
      )
      .max(4),
    provenance: z
      .object({
        supportEvaluationPolicyVersion: z.string(),
        assessmentResults: z
          .array(
            z
              .object({
                assessmentId: z.uuid(),
                instrument: instrumentSchema,
                questionnaireVersion: z.string(),
                scoringVersion: z.string(),
                screeningLevel: screeningLevelSchema,
              })
              .strict(),
          )
          .length(2),
      })
      .strict(),
    phrasing: z
      .object({
        source: z.literal('CARE_APPROVED_STANDARD'),
        status: z.enum(['STANDARD', 'AI_UNAVAILABLE_FALLBACK']),
      })
      .strict(),
  })
  .strict()

export { supportGuideSchema }

export const supportGuideHistorySchema = z
  .object({
    items: z.array(supportGuideSchema),
    nextCursor: z.string().nullable().optional(),
    hasMore: z.boolean(),
  })
  .strict()

const safetyDirectoryEntrySchema = z
  .object({
    directoryEntryId: z.uuid(),
    name: z.string().min(1).max(200),
    type: z.enum(['FACILITY', 'HOTLINE']),
    phone: z.string().min(1).max(64),
    address: z.string().max(500).nullable(),
    coverage: z.array(z.looseObject({})).min(1),
    sourceName: z.string(),
    sourceReference: z.string(),
    reviewedAt: z.iso.datetime(),
    verifiedAt: z.iso.datetime(),
  })
  .loose()

export const safetyDirectoryResponseSchema = z
  .object({
    trigger: z.enum(['POSITIVE_ITEM_9', 'HELP_NOW']),
    state: z.enum(['RESULTS', 'EMPTY', 'INVALID_AREA', 'UNAVAILABLE']),
    areaWording: z.literal('Cơ sở trong khu vực đã chọn'),
    safetyGuidance: z.string().min(1),
    limitation: z.string().min(1),
    entries: z.array(safetyDirectoryEntrySchema).max(100),
  })
  .strict()

export type Instrument = z.infer<typeof instrumentSchema>
export type Questionnaire = z.infer<typeof questionnaireSchema>
export type PrivacyDisclosure = z.infer<typeof privacyDisclosureSchema>
export type ConsentCollection = z.infer<typeof consentCollectionSchema>
export type AssessmentSubmission = z.infer<typeof assessmentSubmissionSchema>
export type Assessment = z.infer<typeof assessmentSchema>
export type AssessmentHistory = z.infer<typeof assessmentHistorySchema>
export type ScreeningEpisode = z.infer<typeof screeningEpisodeSchema>
export type SupportEvaluation = z.infer<typeof supportEvaluationSchema>
export type SupportGuide = z.infer<typeof supportGuideSchema>
export type SupportGuideHistory = z.infer<typeof supportGuideHistorySchema>
export type SafetyDirectoryResponse = z.infer<
  typeof safetyDirectoryResponseSchema
>
