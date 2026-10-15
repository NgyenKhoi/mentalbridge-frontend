import {
  create,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios'

import { createCombinedMeaningApi } from './combined-meaning-api'
import { combinedScreeningMeaningSchema } from './combined-meaning-contract'

const evaluationId = '10000000-0000-4000-8000-000000000003'
const phq9Id = '20000000-0000-4000-8000-000000000001'
const gad7Id = '20000000-0000-4000-8000-000000000002'
const phq9Levels = [
  'MINIMAL',
  'MILD',
  'MODERATE',
  'MODERATELY_SEVERE',
  'SEVERE',
]
const gad7Levels = ['MINIMAL', 'MILD', 'MODERATE', 'SEVERE']

function result(phq9Level = 'MILD', gad7Level = 'MINIMAL', safety = false) {
  const baseTier =
    ['MINIMAL', 'MILD'].includes(phq9Level) &&
    ['MINIMAL', 'MILD'].includes(gad7Level)
      ? 'SELF_GUIDED_SUPPORT'
      : 'PROFESSIONAL_SUPPORT_RECOMMENDED'
  return {
    supportEvaluationId: evaluationId,
    sourcePolicyVersion: 'mb-support-routing-capstone-v1',
    evaluatedAt: '2026-10-14T08:00:00Z',
    presentationPolicyVersion: 'mb-combined-screening-meaning-v1',
    contentVersion: 'mb-combined-screening-meaning-vi-vn-v1-draft.2',
    referencePeriodDays: 14,
    episodeId: '30000000-0000-4000-8000-000000000001',
    episodePurpose: 'INITIAL_CHECK',
    episodeCompletedAt: '2026-10-14T08:01:00Z',
    domainSupportEvaluationId: '40000000-0000-4000-8000-000000000001',
    supportGuideId: null,
    evidence: [
      {
        assessmentId: phq9Id,
        instrument: 'PHQ9',
        questionnaireVersion: 'phq9-vi-vn-capstone-v2',
        scoringVersion: 'phq9-standard-bands-v1',
        totalScore: phq9Level === 'MINIMAL' ? 1 : 5,
        screeningLevel: phq9Level,
        safetyStatus: safety
          ? 'POSITIVE_SAFETY_SCREEN'
          : 'NEGATIVE_SAFETY_SCREEN',
      },
      {
        assessmentId: gad7Id,
        instrument: 'GAD7',
        questionnaireVersion: 'gad7-vi-vn-adult-v1',
        scoringVersion: 'gad7-standard-bands-v1',
        totalScore: gad7Level === 'MINIMAL' ? 0 : 6,
        screeningLevel: gad7Level,
        safetyStatus: 'NOT_APPLICABLE',
      },
    ],
    supportTier: safety ? 'SAFETY_FOLLOW_UP_RECOMMENDED' : baseTier,
    baseMeaning: {
      code: `PHQ9_${phq9Level}_GAD7_${gad7Level}`,
      text: 'Nội dung trình bày do chủ sở hữu cung cấp.',
      rationale: 'Căn cứ vào đúng hai kết quả đã lưu.',
      supportTier: baseTier,
    },
    presentationPriority: safety
      ? 'SAFETY'
      : baseTier === 'PROFESSIONAL_SUPPORT_RECOMMENDED'
        ? 'PROFESSIONAL_SUPPORT'
        : 'SELF_GUIDED',
    nextStep: {
      code: 'NEXT_REVIEWED_STEP',
      contentVersion: 'existing-next-step-v1',
      text: 'Bước tiếp theo do chủ sở hữu cung cấp.',
      boundary: 'Bạn chủ động quyết định.',
    },
    safetyGuidance: safety ? 'Hướng dẫn an toàn đã được duyệt.' : null,
    disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
    disclaimer:
      'Đây là kết quả sàng lọc triệu chứng, không phải chẩn đoán y khoa. MentalBridge không cung cấp dịch vụ ứng cứu khẩn cấp, không giám sát con người 24/7 và không tự động liên hệ bên thứ ba.',
  }
}

function adapterFor(
  data: unknown,
  requests: InternalAxiosRequestConfig[] = [],
): AxiosAdapter {
  return async (request) => {
    requests.push(request)
    return { config: request, data, headers: {}, status: 200, statusText: 'OK' }
  }
}

describe('mobile combined meaning read boundary', () => {
  it.each(phq9Levels.flatMap((phq9) => gad7Levels.map((gad7) => [phq9, gad7])))(
    'retains the provider-owned %s / %s presentation',
    (phq9, gad7) => {
      const value = result(phq9, gad7)
      expect(combinedScreeningMeaningSchema.parse(value)).toEqual(value)
    },
  )

  it('keeps safety override separate from low base bands', () => {
    const value = result('MINIMAL', 'MINIMAL', true)
    expect(combinedScreeningMeaningSchema.parse(value)).toEqual(value)
    expect(
      combinedScreeningMeaningSchema.safeParse({
        ...value,
        presentationPriority: 'SELF_GUIDED',
      }).success,
    ).toBe(false)
    expect(
      combinedScreeningMeaningSchema.safeParse({
        ...value,
        safetyGuidance: null,
      }).success,
    ).toBe(false)
  })

  it('rejects a missing, duplicate, or incompatible evidence pair', () => {
    const value = result()
    expect(
      combinedScreeningMeaningSchema.safeParse({
        ...value,
        evidence: value.evidence.slice(0, 1),
      }).success,
    ).toBe(false)
    expect(
      combinedScreeningMeaningSchema.safeParse({
        ...value,
        evidence: [
          value.evidence[0],
          { ...value.evidence[1], assessmentId: phq9Id },
        ],
      }).success,
    ).toBe(false)
    expect(
      combinedScreeningMeaningSchema.safeParse(
        result('MILD', 'MODERATELY_SEVERE'),
      ).success,
    ).toBe(false)
    expect(
      combinedScreeningMeaningSchema.safeParse({
        ...value,
        baseMeaning: { ...value.baseMeaning, code: 'PHQ9_SEVERE_GAD7_SEVERE' },
      }).success,
    ).toBe(false)
  })

  it('requires complete exact-episode provenance and allows an optional persisted Guide', () => {
    const value = result()
    expect(
      combinedScreeningMeaningSchema.safeParse({
        ...value,
        supportGuideId: '50000000-0000-4000-8000-000000000001',
      }).success,
    ).toBe(true)
    expect(
      combinedScreeningMeaningSchema.safeParse({
        ...value,
        episodeCompletedAt: null,
      }).success,
    ).toBe(false)
    expect(
      combinedScreeningMeaningSchema.safeParse({
        ...value,
        episodeId: null,
      }).success,
    ).toBe(false)

    expect(
      combinedScreeningMeaningSchema.safeParse({
        ...value,
        episodeId: null,
        episodePurpose: null,
        episodeCompletedAt: null,
        domainSupportEvaluationId: null,
        supportGuideId: null,
      }).success,
    ).toBe(true)
  })

  it('rejects unknown policy, extra private payload, unbounded copy and forged safety', () => {
    const value = result()
    expect(
      combinedScreeningMeaningSchema.safeParse({
        ...value,
        contentVersion: 'unreviewed',
      }).success,
    ).toBe(false)
    expect(
      combinedScreeningMeaningSchema.safeParse({
        ...value,
        sourcePolicyVersion: 'unreviewed',
      }).success,
    ).toBe(false)
    expect(
      combinedScreeningMeaningSchema.safeParse({ ...value, accountId: phq9Id })
        .success,
    ).toBe(false)
    expect(
      combinedScreeningMeaningSchema.safeParse({ ...value, combinedScore: 1 })
        .success,
    ).toBe(false)
    expect(
      combinedScreeningMeaningSchema.safeParse({
        ...value,
        evidence: [{ ...value.evidence[0], totalScore: 28 }, value.evidence[1]],
      }).success,
    ).toBe(false)
    expect(
      combinedScreeningMeaningSchema.safeParse({
        ...value,
        baseMeaning: { ...value.baseMeaning, text: 'x'.repeat(1001) },
      }).success,
    ).toBe(false)
    expect(
      combinedScreeningMeaningSchema.safeParse({
        ...value,
        supportTier: 'SAFETY_FOLLOW_UP_RECOMMENDED',
      }).success,
    ).toBe(false)
  })

  it.each(['   ', '\uFFFD', 'broken\u0000copy', 'broken\u0085copy'])(
    'rejects unreadable user-facing copy: %j',
    (unreadable) => {
      const value = result()
      expect(
        combinedScreeningMeaningSchema.safeParse({
          ...value,
          baseMeaning: { ...value.baseMeaning, text: unreadable },
        }).success,
      ).toBe(false)
      expect(
        combinedScreeningMeaningSchema.safeParse({
          ...value,
          baseMeaning: { ...value.baseMeaning, rationale: unreadable },
        }).success,
      ).toBe(false)
      expect(
        combinedScreeningMeaningSchema.safeParse({
          ...value,
          nextStep: { ...value.nextStep, text: unreadable },
        }).success,
      ).toBe(false)
      expect(
        combinedScreeningMeaningSchema.safeParse({
          ...result('MINIMAL', 'MINIMAL', true),
          safetyGuidance: unreadable,
        }).success,
      ).toBe(false)
    },
  )

  it('uses one owner-scoped GET without body, user ID or idempotency key', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const api = createCombinedMeaningApi(
      create({ adapter: adapterFor(result(), requests) }),
    )
    await expect(
      api.getCombinedScreeningMeaning(evaluationId),
    ).resolves.toEqual(result())
    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe(
      `/api/v1/support-evaluations/${evaluationId}/combined-meaning`,
    )
    expect(requests[0]?.method).toBe('get')
    expect(requests[0]?.data).toBeUndefined()
    expect(requests[0]?.params).toBeUndefined()
    expect(requests[0]?.headers.get('Idempotency-Key')).toBeUndefined()
  })

  it('rejects malformed input before making a request', async () => {
    const requests: InternalAxiosRequestConfig[] = []
    const api = createCombinedMeaningApi(
      create({ adapter: adapterFor(result(), requests) }),
    )
    await expect(
      api.getCombinedScreeningMeaning('not-a-uuid'),
    ).rejects.toBeDefined()
    expect(requests).toHaveLength(0)
  })

  it('rejects a valid payload for a different saved evaluation', async () => {
    const api = createCombinedMeaningApi(
      create({
        adapter: adapterFor({ ...result(), supportEvaluationId: phq9Id }),
      }),
    )
    await expect(api.getCombinedScreeningMeaning(evaluationId)).rejects.toThrow(
      'does not match the requested result',
    )
  })

  it.each([404, 503])(
    'leaves provider %s unavailable instead of inventing meaning',
    async (status) => {
      const failure = {
        response: {
          status,
          data: {
            code:
              status === 404
                ? 'SUPPORT_EVALUATION_NOT_FOUND'
                : 'COMBINED_SCREENING_MEANING_UNAVAILABLE',
          },
        },
      }
      const api = createCombinedMeaningApi(
        create({
          adapter: async () => {
            throw failure
          },
        }),
      )
      await expect(api.getCombinedScreeningMeaning(evaluationId)).rejects.toBe(
        failure,
      )
    },
  )
})
