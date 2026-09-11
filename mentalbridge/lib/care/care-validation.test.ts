import { describe, expect, it } from 'vitest'

import {
  isUuid,
  parseAnonymousAssessment,
  parseAssessmentProgress,
  parseQuestionnaire,
  parseSubmission,
  parseSupportEvaluation,
  parseSupportEvaluationRequest,
  validateProfileUpdate,
} from './care-validation'

const definitionId = '10000000-0000-4000-8000-000000000001'
const questionId = '10000000-0000-4000-8000-000000000002'
const assessmentId = '10000000-0000-4000-8000-000000000003'
const previousAssessmentId = '10000000-0000-4000-8000-000000000004'
const questionIds = Array.from(
  { length: 9 },
  (_, index) =>
    `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
)
const phq9Bands = [
  { screeningLevel: 'MINIMAL', minimumScore: 0, maximumScore: 4 },
  { screeningLevel: 'MILD', minimumScore: 5, maximumScore: 9 },
  { screeningLevel: 'MODERATE', minimumScore: 10, maximumScore: 14 },
  {
    screeningLevel: 'MODERATELY_SEVERE',
    minimumScore: 15,
    maximumScore: 19,
  },
  { screeningLevel: 'SEVERE', minimumScore: 20, maximumScore: 27 },
]

function phq9Questionnaire(overrides: Record<string, unknown> = {}) {
  return {
    definitionId,
    instrument: 'PHQ9',
    version: 'phq9-vi-vn-capstone-v2',
    locale: 'vi-VN',
    title: 'PHQ-9',
    referencePeriodDays: 14,
    scoringVersion: 'phq9-standard-bands-v1',
    responseOptions: [
      { value: 0, label: 'Không ngày nào' },
      { value: 1, label: 'Vài ngày' },
      { value: 2, label: 'Hơn nửa số ngày' },
      { value: 3, label: 'Gần như mỗi ngày' },
    ],
    questions: questionIds.map((id, index) => ({
      questionId: id,
      itemNumber: index + 1,
      prompt: `Câu hỏi đã duyệt ${index + 1}`,
    })),
    scoreBands: phq9Bands,
    ...overrides,
  }
}

describe('Care runtime validation', () => {
  it('accepts the adult boundary and leap-day boundary without a maximum age', () => {
    const today = new Date('2026-02-28T00:00:00Z')

    expect(
      validateProfileUpdate(
        { displayName: 'Nguyễn An', dateOfBirth: '2008-02-29' },
        today,
      ),
    ).toEqual({
      success: true,
      value: { displayName: 'Nguyễn An', dateOfBirth: '2008-02-29' },
    })
    expect(
      validateProfileUpdate(
        { displayName: 'Nguyễn An', dateOfBirth: '1900-01-01' },
        today,
      ).success,
    ).toBe(true)
  })

  it('returns date-of-birth violations for malformed, future, and underage values', () => {
    const today = new Date('2026-03-01T00:00:00Z')

    expect(
      validateProfileUpdate(
        { displayName: 'Nguyễn An', dateOfBirth: 'not-a-date' },
        today,
      ),
    ).toMatchObject({
      success: false,
      violations: [{ field: 'dateOfBirth', code: 'INVALID_DATE' }],
    })
    expect(
      validateProfileUpdate(
        { displayName: 'Nguyễn An', dateOfBirth: '2026-03-02' },
        today,
      ),
    ).toMatchObject({
      success: false,
      violations: [{ field: 'dateOfBirth', code: 'DATE_OF_BIRTH_IN_FUTURE' }],
    })
    expect(
      validateProfileUpdate(
        { displayName: 'Nguyễn An', dateOfBirth: '2008-03-02' },
        today,
      ),
    ).toMatchObject({
      success: false,
      violations: [{ field: 'dateOfBirth', code: 'MINIMUM_AGE_NOT_MET' }],
    })
  })
  it('accepts canonical UUIDs used by persisted Care reference data', () => {
    expect(isUuid('10000000-0000-0000-0000-000000000002')).toBe(true)
  })

  it('accepts a contract-shaped published questionnaire', () => {
    expect(parseQuestionnaire(phq9Questionnaire())).toMatchObject({
      definitionId,
      locale: 'vi-VN',
    })
  })

  it('rejects incomplete option catalogues and duplicate question identifiers', () => {
    expect(
      parseQuestionnaire(
        phq9Questionnaire({
          responseOptions: [{ value: 0, label: 'Không ngày nào' }],
          questions: Array.from({ length: 9 }, (_, index) => ({
            questionId,
            itemNumber: index + 1,
            prompt: 'Câu hỏi',
          })),
        }),
      ),
    ).toBeNull()
  })

  it('accepts only question identifiers and 0-3 values from the browser', () => {
    expect(
      parseSubmission({
        questionnaireDefinitionId: definitionId,
        privacyPolicyVersion: 'privacy-capstone-v3',
        privacyDisclosureAcknowledged: true,
        answers: [{ questionId, value: 3 }],
      }),
    ).toEqual({
      questionnaireDefinitionId: definitionId,
      privacyPolicyVersion: 'privacy-capstone-v3',
      privacyDisclosureAcknowledged: true,
      answers: [{ questionId, value: 3 }],
    })

    expect(
      parseSubmission({
        questionnaireDefinitionId: definitionId,
        privacyPolicyVersion: 'privacy-capstone-v3',
        privacyDisclosureAcknowledged: true,
        answers: [{ questionId, value: 3 }],
        totalScore: 3,
        screeningLevel: 'MINIMAL',
      }),
    ).toBeNull()

    expect(
      parseSubmission({
        questionnaireDefinitionId: definitionId,
        privacyPolicyVersion: 'privacy-capstone-v2',
        privacyDisclosureAcknowledged: true,
        answers: [{ questionId, value: 3 }],
      }),
    ).toBeNull()
  })

  it('parses server-owned score and independent safety status', () => {
    expect(
      parseAnonymousAssessment({
        assessmentId,
        questionnaireDefinitionId: definitionId,
        instrument: 'PHQ9',
        questionnaireVersion: 'phq9-vi-vn-capstone-v1',
        privacyPolicyVersion: 'privacy-capstone-v2',
        submittedAt: '2026-09-01T00:00:00Z',
        voidedAt: null,
        expiresAt: '2026-09-01T00:30:00Z',
        result: {
          totalScore: 3,
          screeningLevel: 'MINIMAL',
          scoringVersion: 'phq9-standard-v1',
          safetyStatus: 'POSITIVE_SAFETY_SCREEN',
          safetyPolicyVersion: 'MB-SAFETY-PHQ9-001/1.0',
          disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
        },
      }),
    ).toMatchObject({
      assessmentId,
      result: {
        totalScore: 3,
        screeningLevel: 'MINIMAL',
        safetyStatus: 'POSITIVE_SAFETY_SCREEN',
      },
    })
  })

  it('accepts GAD-7 only with not-applicable safety provenance', () => {
    const gadAssessment = {
      assessmentId,
      questionnaireDefinitionId: definitionId,
      instrument: 'GAD7',
      questionnaireVersion: 'gad7-vi-vn-adult-v1',
      privacyPolicyVersion: 'privacy-capstone-v3',
      submittedAt: '2026-09-01T00:00:00Z',
      voidedAt: null,
      expiresAt: '2026-09-01T00:30:00Z',
      result: {
        totalScore: 21,
        screeningLevel: 'SEVERE',
        scoringVersion: 'gad7-standard-bands-v1',
        safetyStatus: 'NOT_APPLICABLE',
        safetyPolicyVersion: null,
        disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
      },
    }

    expect(parseAnonymousAssessment(gadAssessment)).toMatchObject({
      instrument: 'GAD7',
      result: { safetyStatus: 'NOT_APPLICABLE', safetyPolicyVersion: null },
    })
    expect(
      parseAnonymousAssessment({
        ...gadAssessment,
        result: {
          ...gadAssessment.result,
          safetyStatus: 'NEGATIVE_SAFETY_SCREEN',
          safetyPolicyVersion: 'invented-gad-policy',
        },
      }),
    ).toBeNull()
  })

  it('accepts a self-consistent descriptive progress response', () => {
    const progress = {
      instrument: 'PHQ9',
      scoringVersion: 'phq9-standard-bands-v1',
      previous: {
        assessmentId: previousAssessmentId,
        questionnaireVersion: 'phq9-vi-vn-capstone-v1',
        submittedAt: '2026-09-01T00:00:00Z',
        totalScore: 4,
        screeningLevel: 'MINIMAL',
      },
      current: {
        assessmentId,
        questionnaireVersion: 'phq9-vi-vn-capstone-v1',
        submittedAt: '2026-09-04T00:00:00Z',
        totalScore: 10,
        screeningLevel: 'MODERATE',
      },
      rawDelta: 6,
      scoreDirection: 'INCREASED',
      bandTransition: { previous: 'MINIMAL', current: 'MODERATE' },
      elapsedDuration: 'PT72H',
    }

    expect(parseAssessmentProgress(progress, assessmentId)).toEqual(progress)
  })

  it('ignores additive unknown progress fields without forwarding them', () => {
    const parsed = parseAssessmentProgress(
      {
        instrument: 'PHQ9',
        scoringVersion: 'phq9-standard-bands-v1',
        previous: {
          assessmentId: previousAssessmentId,
          questionnaireVersion: 'phq9-vi-vn-capstone-v1',
          submittedAt: '2026-09-01T00:00:00Z',
          totalScore: 4,
          screeningLevel: 'MINIMAL',
          futurePointMetadata: 'ignored',
        },
        current: {
          assessmentId,
          questionnaireVersion: 'phq9-vi-vn-capstone-v1',
          submittedAt: '2026-09-04T00:00:00Z',
          totalScore: 10,
          screeningLevel: 'MODERATE',
        },
        rawDelta: 6,
        scoreDirection: 'INCREASED',
        bandTransition: {
          previous: 'MINIMAL',
          current: 'MODERATE',
          futureTransitionMetadata: true,
        },
        elapsedDuration: 'PT72H',
        futureProgressMetadata: { version: 2 },
      },
      assessmentId,
    )

    expect(parsed).not.toBeNull()
    expect(parsed).not.toHaveProperty('futureProgressMetadata')
    expect(parsed?.previous).not.toHaveProperty('futurePointMetadata')
    expect(parsed?.bandTransition).not.toHaveProperty(
      'futureTransitionMetadata',
    )
  })

  it('uses the safe unavailable fallback for unknown progress enums', () => {
    expect(
      parseAssessmentProgress(
        {
          instrument: 'PHQ9',
          scoringVersion: 'phq9-standard-bands-v1',
          previous: {
            assessmentId: previousAssessmentId,
            questionnaireVersion: 'phq9-vi-vn-capstone-v1',
            submittedAt: '2026-09-01T00:00:00Z',
            totalScore: 4,
            screeningLevel: 'MINIMAL',
          },
          current: {
            assessmentId,
            questionnaireVersion: 'phq9-vi-vn-capstone-v1',
            submittedAt: '2026-09-04T00:00:00Z',
            totalScore: 10,
            screeningLevel: 'MODERATE',
          },
          rawDelta: 6,
          scoreDirection: 'CLINICALLY_IMPROVED',
          bandTransition: { previous: 'MINIMAL', current: 'MODERATE' },
          elapsedDuration: 'PT72H',
        },
        assessmentId,
      ),
    ).toBeNull()
  })

  it('rejects contradictory or safety-bearing progress responses', () => {
    const progress = {
      instrument: 'PHQ9',
      scoringVersion: 'phq9-standard-bands-v1',
      previous: {
        assessmentId: previousAssessmentId,
        questionnaireVersion: 'phq9-vi-vn-capstone-v1',
        submittedAt: '2026-09-01T00:00:00Z',
        totalScore: 4,
        screeningLevel: 'MINIMAL',
      },
      current: {
        assessmentId,
        questionnaireVersion: 'phq9-vi-vn-capstone-v1',
        submittedAt: '2026-09-04T00:00:00Z',
        totalScore: 10,
        screeningLevel: 'MODERATE',
      },
      rawDelta: 5,
      scoreDirection: 'DECREASED',
      bandTransition: { previous: 'MINIMAL', current: 'MILD' },
      elapsedDuration: 'three days',
      safetyStatus: 'NEGATIVE_SAFETY_SCREEN',
    }

    expect(parseAssessmentProgress(progress, assessmentId)).toBeNull()
  })

  it('rejects progress attributed to a different requested assessment', () => {
    const differentAssessmentId = '10000000-0000-4000-8000-000000000005'
    expect(
      parseAssessmentProgress(
        {
          instrument: 'PHQ9',
          scoringVersion: 'phq9-standard-bands-v1',
          previous: {
            assessmentId: previousAssessmentId,
            questionnaireVersion: 'phq9-vi-vn-capstone-v1',
            submittedAt: '2026-09-01T00:00:00Z',
            totalScore: 4,
            screeningLevel: 'MINIMAL',
          },
          current: {
            assessmentId: differentAssessmentId,
            questionnaireVersion: 'phq9-vi-vn-capstone-v1',
            submittedAt: '2026-09-04T00:00:00Z',
            totalScore: 10,
            screeningLevel: 'MODERATE',
          },
          rawDelta: 6,
          scoreDirection: 'INCREASED',
          bandTransition: { previous: 'MINIMAL', current: 'MODERATE' },
          elapsedDuration: 'PT72H',
        },
        assessmentId,
      ),
    ).toBeNull()
  })

  it('requires RFC3339 timestamps and a matching elapsed duration', () => {
    const progress = {
      instrument: 'PHQ9',
      scoringVersion: 'phq9-standard-bands-v1',
      previous: {
        assessmentId: previousAssessmentId,
        questionnaireVersion: 'phq9-vi-vn-capstone-v1',
        submittedAt: '2026-09-01T00:00:00.123456789Z',
        totalScore: 4,
        screeningLevel: 'MINIMAL',
      },
      current: {
        assessmentId,
        questionnaireVersion: 'phq9-vi-vn-capstone-v1',
        submittedAt: '2026-09-01T01:00:00.123456789Z',
        totalScore: 10,
        screeningLevel: 'MODERATE',
      },
      rawDelta: 6,
      scoreDirection: 'INCREASED',
      bandTransition: { previous: 'MINIMAL', current: 'MODERATE' },
      elapsedDuration: 'PT1H',
    }

    expect(parseAssessmentProgress(progress, assessmentId)).toEqual(progress)
    expect(
      parseAssessmentProgress(
        {
          ...progress,
          previous: { ...progress.previous, submittedAt: '2026-09-01' },
        },
        assessmentId,
      ),
    ).toBeNull()
    expect(
      parseAssessmentProgress(
        { ...progress, elapsedDuration: 'PT59M' },
        assessmentId,
      ),
    ).toBeNull()
  })

  it('accepts only an explicit PHQ-9 and GAD-7 support selection', () => {
    const gad7AssessmentId = '10000000-0000-4000-8000-000000000006'
    expect(
      parseSupportEvaluationRequest({
        phq9AssessmentId: assessmentId,
        gad7AssessmentId,
      }),
    ).toEqual({ phq9AssessmentId: assessmentId, gad7AssessmentId })
    expect(
      parseSupportEvaluationRequest({
        phq9AssessmentId: assessmentId,
        gad7AssessmentId,
        totalScore: 9,
      }),
    ).toBeNull()
  })

  it('parses support content only when its evidence matches the selected assessments', () => {
    const gad7AssessmentId = '10000000-0000-4000-8000-000000000006'
    const evaluation = {
      supportEvaluationId: '10000000-0000-4000-8000-000000000007',
      policyVersion: 'mb-support-routing-capstone-v1',
      evaluatedAt: '2026-09-10T08:00:00Z',
      supportTier: 'SELF_GUIDED_SUPPORT',
      reasonCodes: ['ALL_SCREENING_LEVELS_MINIMAL_OR_MILD'],
      evidence: [
        {
          assessmentId,
          instrument: 'PHQ9',
          questionnaireVersion: 'phq9-vi-vn-capstone-v2',
          scoringVersion: 'phq9-standard-bands-v1',
          screeningLevel: 'MILD',
          safetyStatus: 'NEGATIVE_SAFETY_SCREEN',
          meaning: {
            meaningCode: 'PHQ9_MILD_14D',
            contentVersion: 'mb-screening-meaning-vi-vn-v1',
            referencePeriodDays: 14,
            text: 'Câu trả lời PHQ-9 thuộc mức nhẹ trong 14 ngày qua.',
            limitation: 'Đây là sàng lọc triệu chứng, không phải chẩn đoán.',
          },
        },
        {
          assessmentId: gad7AssessmentId,
          instrument: 'GAD7',
          questionnaireVersion: 'gad7-vi-vn-adult-v1',
          scoringVersion: 'gad7-standard-bands-v1',
          screeningLevel: 'MINIMAL',
          safetyStatus: 'NOT_APPLICABLE',
          meaning: {
            meaningCode: 'GAD7_MINIMAL_14D',
            contentVersion: 'mb-screening-meaning-vi-vn-v1',
            referencePeriodDays: 14,
            text: 'Câu trả lời GAD-7 thuộc mức tối thiểu trong 14 ngày qua.',
            limitation: 'Đây là sàng lọc triệu chứng, không phải chẩn đoán.',
          },
        },
      ],
      nextStep: {
        code: 'REVIEW_SELF_GUIDED_RESOURCE',
        contentVersion: 'mb-support-next-step-vi-vn-v1',
        text: 'Bạn có thể chọn một tài nguyên tự hỗ trợ đã được rà soát.',
        boundary: 'Không có hành động hoặc chia sẻ dữ liệu tự động.',
      },
      safetyGuidance: null,
      disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
      disclaimer:
        'Đây là kết quả sàng lọc triệu chứng, không phải chẩn đoán y khoa. MentalBridge không cung cấp dịch vụ ứng cứu khẩn cấp, không giám sát con người 24/7 và không tự động liên hệ bên thứ ba.',
    }
    const expected = { phq9AssessmentId: assessmentId, gad7AssessmentId }

    expect(parseSupportEvaluation(evaluation, expected)).toMatchObject({
      supportTier: 'SELF_GUIDED_SUPPORT',
      evidence: [{ assessmentId }, { assessmentId: gad7AssessmentId }],
    })
    const sanitized = parseSupportEvaluation(
      {
        ...evaluation,
        evidence: [
          { ...evaluation.evidence[0], rawAnswers: [{ value: 3 }] },
          evaluation.evidence[1],
        ],
      },
      expected,
    )
    expect(sanitized?.evidence[0]).toMatchObject({ assessmentId })
    expect(sanitized?.evidence[0]).not.toHaveProperty('rawAnswers')
    expect(
      parseSupportEvaluation(evaluation, {
        ...expected,
        gad7AssessmentId: '10000000-0000-4000-8000-000000000008',
      }),
    ).toBeNull()
  })
})
