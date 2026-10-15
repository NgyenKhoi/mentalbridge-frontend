import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mockServer } from '@/tests/mocks/server'

import { careClient } from './care-client'
import {
  parseCombinedScreeningMeaning,
  parseScreeningEpisodeHistory,
} from './combined-meaning-validation'

const evaluationId = '10000000-0000-4000-8000-000000000003'
const phq9Id = '20000000-0000-4000-8000-000000000001'
const gad7Id = '20000000-0000-4000-8000-000000000002'
const episodeId = '30000000-0000-4000-8000-000000000001'
const domainEvaluationId = '30000000-0000-4000-8000-000000000002'
const guideId = '30000000-0000-4000-8000-000000000003'
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
    episodeId,
    episodePurpose: 'INITIAL_CHECK',
    episodeCompletedAt: '2026-10-14T08:00:00Z',
    domainSupportEvaluationId: domainEvaluationId,
    supportGuideId: guideId,
    evidence: [
      {
        assessmentId: phq9Id,
        instrument: 'PHQ9',
        questionnaireVersion: 'phq9-vi-vn-capstone-v2',
        scoringVersion: 'phq9-standard-bands-v1',
        totalScore: phq9Level === 'MINIMAL' ? 2 : 8,
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
        totalScore: gad7Level === 'MINIMAL' ? 1 : 7,
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

function availableHistoryItem(meaning = result()) {
  return {
    episodeId,
    purpose: 'INITIAL_CHECK',
    status: 'COMPLETED',
    startedAt: '2026-10-14T07:45:00Z',
    updatedAt: meaning.episodeCompletedAt,
    completedAt: meaning.episodeCompletedAt,
    presentationEvaluationId: evaluationId,
    meaningState: 'AVAILABLE',
    evidence: meaning.evidence.map((entry) => ({
      instrument: entry.instrument,
      state: 'AVAILABLE',
      assessmentId: entry.assessmentId,
      totalScore: entry.totalScore,
      screeningLevel: entry.screeningLevel,
      safetyStatus: entry.safetyStatus,
    })),
    meaning,
  }
}

describe('Care-owned combined screening meaning boundary', () => {
  afterEach(() => vi.unstubAllEnvs())

  it.each(phq9Levels.flatMap((phq9) => gad7Levels.map((gad7) => [phq9, gad7])))(
    'retains the exact %s / %s presentation without calculating copy',
    (phq9, gad7) => {
      const value = result(phq9, gad7)
      expect(parseCombinedScreeningMeaning(value, evaluationId)).toEqual(value)
    },
  )

  it('retains safety precedence even for low score bands', () => {
    const value = result('MINIMAL', 'MINIMAL', true)
    const parsed = parseCombinedScreeningMeaning(value, evaluationId)
    expect(parsed).toEqual(value)
    expect(parsed?.baseMeaning.supportTier).toBe('SELF_GUIDED_SUPPORT')
    expect(parsed?.presentationPriority).toBe('SAFETY')
  })

  it('rejects another evaluation, incomplete pair, duplicates, and unsupported GAD band', () => {
    const value = result()
    expect(parseCombinedScreeningMeaning(value, phq9Id)).toBeNull()
    expect(
      parseCombinedScreeningMeaning(
        { ...value, evidence: value.evidence.slice(0, 1) },
        evaluationId,
      ),
    ).toBeNull()
    expect(
      parseCombinedScreeningMeaning(
        {
          ...value,
          evidence: [
            value.evidence[0],
            { ...value.evidence[1], assessmentId: phq9Id },
          ],
        },
        evaluationId,
      ),
    ).toBeNull()
    expect(
      parseCombinedScreeningMeaning(
        result('MILD', 'MODERATELY_SEVERE'),
        evaluationId,
      ),
    ).toBeNull()
  })

  it('rejects mismatched content code, private fields, and invalid scores', () => {
    const value = result()
    expect(
      parseCombinedScreeningMeaning(
        {
          ...value,
          baseMeaning: {
            ...value.baseMeaning,
            code: 'PHQ9_SEVERE_GAD7_SEVERE',
          },
        },
        evaluationId,
      ),
    ).toBeNull()
    expect(
      parseCombinedScreeningMeaning(
        { ...value, accountId: phq9Id },
        evaluationId,
      ),
    ).toBeNull()
    expect(
      parseCombinedScreeningMeaning(
        { ...value, combinedScore: 1 },
        evaluationId,
      ),
    ).toBeNull()
    expect(
      parseCombinedScreeningMeaning(
        {
          ...value,
          evidence: [
            { ...value.evidence[0], totalScore: 28 },
            value.evidence[1],
          ],
        },
        evaluationId,
      ),
    ).toBeNull()
    expect(
      parseCombinedScreeningMeaning(
        {
          ...value,
          evidence: [{ ...value.evidence[0], answers: [] }, value.evidence[1]],
        },
        evaluationId,
      ),
    ).toBeNull()
  })

  it('rejects unsafe contradictory priority and unknown presentation versions', () => {
    const positive = result('MINIMAL', 'MINIMAL', true)
    expect(
      parseCombinedScreeningMeaning(
        { ...positive, presentationPriority: 'SELF_GUIDED' },
        evaluationId,
      ),
    ).toBeNull()
    expect(
      parseCombinedScreeningMeaning(
        { ...positive, safetyGuidance: null },
        evaluationId,
      ),
    ).toBeNull()
    expect(
      parseCombinedScreeningMeaning(
        { ...result(), supportTier: 'SAFETY_FOLLOW_UP_RECOMMENDED' },
        evaluationId,
      ),
    ).toBeNull()
    expect(
      parseCombinedScreeningMeaning(
        { ...result(), contentVersion: 'unreviewed' },
        evaluationId,
      ),
    ).toBeNull()
    expect(
      parseCombinedScreeningMeaning(
        { ...result(), sourcePolicyVersion: 'unreviewed' },
        evaluationId,
      ),
    ).toBeNull()
    expect(
      parseCombinedScreeningMeaning(
        {
          ...result(),
          baseMeaning: { ...result().baseMeaning, text: 'x'.repeat(1001) },
        },
        evaluationId,
      ),
    ).toBeNull()
  })

  it.each(['   ', '\uFFFD', 'broken\u0000copy', 'broken\u0085copy'])(
    'rejects unreadable user-facing copy: %j',
    (unreadable) => {
      const value = result()
      expect(
        parseCombinedScreeningMeaning(
          { ...value, baseMeaning: { ...value.baseMeaning, text: unreadable } },
          evaluationId,
        ),
      ).toBeNull()
      expect(
        parseCombinedScreeningMeaning(
          {
            ...value,
            baseMeaning: { ...value.baseMeaning, rationale: unreadable },
          },
          evaluationId,
        ),
      ).toBeNull()
      expect(
        parseCombinedScreeningMeaning(
          { ...value, nextStep: { ...value.nextStep, text: unreadable } },
          evaluationId,
        ),
      ).toBeNull()
      expect(
        parseCombinedScreeningMeaning(
          { ...result('MINIMAL', 'MINIMAL', true), safetyGuidance: unreadable },
          evaluationId,
        ),
      ).toBeNull()
    },
  )

  it('reads only the exact requested result with server authentication and no cache', async () => {
    vi.stubEnv('CARE_API_BASE_URL', 'http://care.test')
    mockServer.use(
      http.get(
        `http://care.test/api/v1/support-evaluations/${evaluationId}/combined-meaning`,
        ({ request }) => {
          expect(request.headers.get('authorization')).toBe(
            'Bearer server-token',
          )
          expect(request.headers.get('idempotency-key')).toBeNull()
          expect(request.cache).toBe('no-store')
          expect(request.method).toBe('GET')
          return HttpResponse.json(result())
        },
      ),
    )

    await expect(
      careClient.getCombinedScreeningMeaning(
        'server-token',
        evaluationId,
        'correlation',
      ),
    ).resolves.toEqual(result())
  })

  it('fails closed when the provider returns a different saved result', async () => {
    vi.stubEnv('CARE_API_BASE_URL', 'http://care.test')
    mockServer.use(
      http.get(
        `http://care.test/api/v1/support-evaluations/${evaluationId}/combined-meaning`,
        () => HttpResponse.json({ ...result(), supportEvaluationId: phq9Id }),
      ),
    )

    await expect(
      careClient.getCombinedScreeningMeaning(
        'server-token',
        evaluationId,
        'correlation',
      ),
    ).rejects.toMatchObject({ status: 502, code: 'CARE_MALFORMED_RESPONSE' })
  })

  it('keeps available and legacy-unavailable episode rows without substituting evidence', () => {
    const meaning = result()
    const page = {
      items: [
        availableHistoryItem(meaning),
        {
          episodeId: '30000000-0000-4000-8000-000000000010',
          purpose: 'REASSESSMENT',
          status: 'COMPLETED',
          startedAt: '2026-09-14T07:45:00Z',
          updatedAt: '2026-09-14T08:00:00Z',
          completedAt: '2026-09-14T08:00:00Z',
          presentationEvaluationId: null,
          meaningState: 'UNAVAILABLE',
          evidence: [
            {
              instrument: 'PHQ9',
              state: 'UNAVAILABLE',
              assessmentId: phq9Id,
              totalScore: null,
              screeningLevel: null,
              safetyStatus: null,
            },
            {
              instrument: 'GAD7',
              state: 'MISSING',
              assessmentId: null,
              totalScore: null,
              screeningLevel: null,
              safetyStatus: null,
            },
          ],
          meaning: null,
        },
      ],
      nextCursor: null,
      hasMore: false,
    }

    expect(parseScreeningEpisodeHistory(page)).toEqual(page)
    expect(
      parseScreeningEpisodeHistory({
        ...page,
        items: [
          {
            ...page.items[0],
            episodeId: '30000000-0000-4000-8000-000000000099',
          },
        ],
      }),
    ).toBeNull()
    expect(
      parseScreeningEpisodeHistory({
        ...page,
        items: [
          {
            ...page.items[1],
            meaning,
          },
        ],
      }),
    ).toBeNull()
  })

  it('accepts a truthful incomplete pair and rejects guessed or contradictory evidence', () => {
    const incomplete = {
      episodeId: '30000000-0000-4000-8000-000000000011',
      purpose: 'REASSESSMENT',
      status: 'IN_PROGRESS',
      startedAt: '2026-10-15T08:00:00Z',
      updatedAt: '2026-10-15T08:05:00Z',
      completedAt: null,
      presentationEvaluationId: null,
      meaningState: 'INCOMPLETE',
      evidence: [
        {
          instrument: 'PHQ9',
          state: 'AVAILABLE',
          assessmentId: phq9Id,
          totalScore: 2,
          screeningLevel: 'MINIMAL',
          safetyStatus: 'POSITIVE_SAFETY_SCREEN',
        },
        {
          instrument: 'GAD7',
          state: 'MISSING',
          assessmentId: null,
          totalScore: null,
          screeningLevel: null,
          safetyStatus: null,
        },
      ],
      meaning: null,
    }

    expect(
      parseScreeningEpisodeHistory({
        items: [incomplete],
        nextCursor: null,
        hasMore: false,
      }),
    ).toEqual({ items: [incomplete], nextCursor: null, hasMore: false })
    expect(
      parseScreeningEpisodeHistory({
        items: [
          {
            ...incomplete,
            evidence: [
              incomplete.evidence[0],
              {
                ...incomplete.evidence[1],
                state: 'AVAILABLE',
                assessmentId: gad7Id,
                totalScore: 4,
                screeningLevel: 'MINIMAL',
                safetyStatus: 'NOT_APPLICABLE',
              },
            ],
          },
        ],
        nextCursor: null,
        hasMore: false,
      }),
    ).toBeNull()
    expect(
      parseScreeningEpisodeHistory({
        items: [{ ...incomplete, answers: [] }],
        nextCursor: null,
        hasMore: false,
      }),
    ).toBeNull()
  })

  it('reads bounded episode history with server authentication and no cache', async () => {
    vi.stubEnv('CARE_API_BASE_URL', 'http://care.test')
    mockServer.use(
      http.get(
        'http://care.test/api/v1/screening-episodes/history',
        ({ request }) => {
          expect(request.headers.get('authorization')).toBe(
            'Bearer server-token',
          )
          expect(request.cache).toBe('no-store')
          expect(new URL(request.url).searchParams.get('limit')).toBe('5')
          expect(new URL(request.url).searchParams.get('cursor')).toBe('next')
          return HttpResponse.json({
            items: [],
            nextCursor: null,
            hasMore: false,
          })
        },
      ),
    )

    await expect(
      careClient.screeningEpisodeHistory(
        'server-token',
        'next',
        5,
        'correlation',
      ),
    ).resolves.toEqual({ items: [], nextCursor: null, hasMore: false })
  })

  it.each([
    [404, 'SUPPORT_EVALUATION_NOT_FOUND'],
    [503, 'COMBINED_SCREENING_MEANING_UNAVAILABLE'],
  ])(
    'preserves provider %s instead of fabricating meaning',
    async (status, code) => {
      vi.stubEnv('CARE_API_BASE_URL', 'http://care.test')
      mockServer.use(
        http.get(
          `http://care.test/api/v1/support-evaluations/${evaluationId}/combined-meaning`,
          () =>
            HttpResponse.json(
              {
                type: '/problems/unavailable',
                title: 'Unavailable',
                status,
                code,
                correlationId: '10000000-0000-4000-8000-000000000001',
              },
              { status },
            ),
        ),
      )
      await expect(
        careClient.getCombinedScreeningMeaning(
          'server-token',
          evaluationId,
          'correlation',
        ),
      ).rejects.toMatchObject({ status, code })
    },
  )
})
