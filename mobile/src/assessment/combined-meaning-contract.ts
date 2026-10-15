import { z } from 'zod'

import { screeningLevelSchema } from './assessment-contract'

const baseTierSchema = z.enum([
  'SELF_GUIDED_SUPPORT',
  'PROFESSIONAL_SUPPORT_RECOMMENDED',
])
const boundedText = z
  .string()
  .min(1)
  .max(1000)
  .refine(
    (value) =>
      value.trim().length > 0 &&
      !Array.from(value).some((character) => {
        const code = character.charCodeAt(0)
        return (
          code === 0xfffd ||
          (code >= 0x7f && code <= 0x9f) ||
          (code < 0x20 && ![0x09, 0x0a, 0x0d].includes(code))
        )
      }),
    'Presentation text is unreadable.',
  )
const evidenceShape = {
  assessmentId: z.uuid(),
  questionnaireVersion: z.string().min(1).max(32),
  scoringVersion: z.string().min(1).max(32),
}

export const combinedScreeningMeaningSchema = z
  .object({
    supportEvaluationId: z.uuid(),
    sourcePolicyVersion: z.literal('mb-support-routing-capstone-v1'),
    evaluatedAt: z.iso.datetime({ offset: true }),
    presentationPolicyVersion: z.literal('mb-combined-screening-meaning-v1'),
    contentVersion: z.literal('mb-combined-screening-meaning-vi-vn-v1-draft.2'),
    referencePeriodDays: z.literal(14),
    evidence: z.tuple([
      z
        .object({
          ...evidenceShape,
          instrument: z.literal('PHQ9'),
          totalScore: z.number().int().min(0).max(27),
          screeningLevel: screeningLevelSchema,
          safetyStatus: z.enum([
            'NEGATIVE_SAFETY_SCREEN',
            'POSITIVE_SAFETY_SCREEN',
          ]),
        })
        .strict(),
      z
        .object({
          ...evidenceShape,
          instrument: z.literal('GAD7'),
          totalScore: z.number().int().min(0).max(21),
          screeningLevel: z.enum(['MINIMAL', 'MILD', 'MODERATE', 'SEVERE']),
          safetyStatus: z.literal('NOT_APPLICABLE'),
        })
        .strict(),
    ]),
    episodeId: z.uuid().nullable(),
    episodePurpose: z.enum(['INITIAL_CHECK', 'REASSESSMENT']).nullable(),
    episodeCompletedAt: z.iso.datetime({ offset: true }).nullable(),
    domainSupportEvaluationId: z.uuid().nullable(),
    supportGuideId: z.uuid().nullable(),
    supportTier: z.enum([
      'SELF_GUIDED_SUPPORT',
      'PROFESSIONAL_SUPPORT_RECOMMENDED',
      'SAFETY_FOLLOW_UP_RECOMMENDED',
    ]),
    baseMeaning: z
      .object({
        code: z
          .string()
          .max(64)
          .regex(
            /^PHQ9_(MINIMAL|MILD|MODERATE|MODERATELY_SEVERE|SEVERE)_GAD7_(MINIMAL|MILD|MODERATE|SEVERE)$/,
          ),
        text: boundedText,
        rationale: boundedText,
        supportTier: baseTierSchema,
      })
      .strict(),
    presentationPriority: z.enum([
      'SAFETY',
      'PROFESSIONAL_SUPPORT',
      'SELF_GUIDED',
    ]),
    nextStep: z
      .object({
        code: z
          .string()
          .min(1)
          .max(64)
          .regex(/^[A-Z0-9_]+$/),
        contentVersion: z.string().min(1).max(64),
        text: boundedText,
        boundary: boundedText,
      })
      .strict(),
    safetyGuidance: boundedText.nullable(),
    disclaimerCode: z.literal('SCREENING_NOT_DIAGNOSIS'),
    disclaimer: z.literal(
      'Đây là kết quả sàng lọc triệu chứng, không phải chẩn đoán y khoa. MentalBridge không cung cấp dịch vụ ứng cứu khẩn cấp, không giám sát con người 24/7 và không tự động liên hệ bên thứ ba.',
    ),
  })
  .strict()
  .superRefine((value, context) => {
    const [phq9, gad7] = value.evidence
    const hasEpisodeContext = value.episodeId !== null
    if (
      phq9.assessmentId.toLowerCase() === gad7.assessmentId.toLowerCase() ||
      value.baseMeaning.code !==
        `PHQ9_${phq9.screeningLevel}_GAD7_${gad7.screeningLevel}`
    )
      context.addIssue({
        code: 'custom',
        message: 'Combined meaning does not match the exact evidence pair.',
      })

    if (
      (hasEpisodeContext &&
        (value.episodePurpose === null ||
          value.episodeCompletedAt === null ||
          value.domainSupportEvaluationId === null)) ||
      (!hasEpisodeContext &&
        (value.episodePurpose !== null ||
          value.episodeCompletedAt !== null ||
          value.domainSupportEvaluationId !== null ||
          value.supportGuideId !== null))
    )
      context.addIssue({
        code: 'custom',
        message: 'Combined meaning episode provenance is incomplete.',
      })

    const consistent =
      phq9.safetyStatus === 'POSITIVE_SAFETY_SCREEN'
        ? value.supportTier === 'SAFETY_FOLLOW_UP_RECOMMENDED' &&
          value.presentationPriority === 'SAFETY' &&
          value.safetyGuidance !== null
        : value.supportTier === value.baseMeaning.supportTier &&
          value.presentationPriority ===
            (value.supportTier === 'PROFESSIONAL_SUPPORT_RECOMMENDED'
              ? 'PROFESSIONAL_SUPPORT'
              : 'SELF_GUIDED') &&
          value.safetyGuidance === null
    if (!consistent)
      context.addIssue({
        code: 'custom',
        message: 'Combined meaning priority contradicts the safety evidence.',
      })
  })

export type CombinedScreeningMeaning = z.infer<
  typeof combinedScreeningMeaningSchema
>
