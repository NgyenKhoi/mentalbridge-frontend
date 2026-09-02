import { describe, expect, it } from 'vitest'

import {
  parseAnonymousAssessment,
  parseQuestionnaire,
  parseSubmission,
} from './care-validation'

const definitionId = '10000000-0000-4000-8000-000000000001'
const questionId = '10000000-0000-4000-8000-000000000002'
const assessmentId = '10000000-0000-4000-8000-000000000003'

describe('Care runtime validation', () => {
  it('accepts a contract-shaped published questionnaire', () => {
    expect(
      parseQuestionnaire({
        definitionId,
        instrument: 'PHQ9',
        version: 'phq9-vi-vn-capstone-v1',
        locale: 'vi-VN',
        title: 'PHQ-9',
        referencePeriodDays: 14,
        responseOptions: [
          { value: 0, label: 'Không ngày nào' },
          { value: 1, label: 'Vài ngày' },
          { value: 2, label: 'Hơn nửa số ngày' },
          { value: 3, label: 'Gần như mỗi ngày' },
        ],
        questions: [{ questionId, itemNumber: 1, prompt: 'Câu hỏi đã duyệt' }],
      }),
    ).toMatchObject({ definitionId, locale: 'vi-VN' })
  })

  it('rejects incomplete option catalogues and duplicate question identifiers', () => {
    expect(
      parseQuestionnaire({
        definitionId,
        instrument: 'PHQ9',
        version: 'v1',
        locale: 'vi-VN',
        title: 'PHQ-9',
        referencePeriodDays: 14,
        responseOptions: [{ value: 0, label: 'Không ngày nào' }],
        questions: [{ questionId, itemNumber: 1, prompt: 'Câu hỏi' }],
      }),
    ).toBeNull()
  })

  it('accepts only question identifiers and 0-3 values from the browser', () => {
    expect(
      parseSubmission({
        questionnaireDefinitionId: definitionId,
        privacyPolicyVersion: 'privacy-capstone-v1',
        privacyDisclosureAcknowledged: true,
        answers: [{ questionId, value: 3 }],
      }),
    ).toEqual({
      questionnaireDefinitionId: definitionId,
      privacyPolicyVersion: 'privacy-capstone-v1',
      privacyDisclosureAcknowledged: true,
      answers: [{ questionId, value: 3 }],
    })

    expect(
      parseSubmission({
        questionnaireDefinitionId: definitionId,
        privacyPolicyVersion: 'privacy-capstone-v1',
        privacyDisclosureAcknowledged: true,
        answers: [{ questionId, value: 3 }],
        totalScore: 3,
        screeningLevel: 'MINIMAL',
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
        privacyPolicyVersion: 'privacy-capstone-v1',
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
})
