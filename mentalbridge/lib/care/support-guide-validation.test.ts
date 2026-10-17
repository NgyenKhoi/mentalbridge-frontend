import { describe, expect, it } from 'vitest'

import {
  parseSupportGuide,
  parseSupportGuideHistory,
} from './support-guide-validation'

const guide = {
  supportGuideId: '10000000-0000-4000-8000-000000000511',
  guideVersion: 1,
  guidePolicyVersion: 'mb-support-guide-capstone-v1',
  supportEvaluationId: '20000000-0000-4000-8000-000000000511',
  generatedAt: '2026-09-17T06:00:00Z',
  guideType: 'ONE_TIME_SUPPORT_GUIDE',
  explanation: {
    code: 'STANDARD_POST_SCREENING_GUIDANCE',
    text: 'Approved explanation.',
  },
  safety: {
    status: 'NEGATIVE_SAFETY_SCREEN',
    reasonCode: 'PHQ9_ITEM9_NEGATIVE',
    policyVersion: 'MB-SAFETY-PHQ9-001-v1',
    guidanceCode: 'STANDARD_SAFETY_REMINDER',
    guidance: 'Approved synchronous safety guidance.',
  },
  resourceResolution: {
    status: 'AVAILABLE',
    policyVersion: 'content-eligibility-v1',
    resolvedAt: '2026-09-17T06:00:00Z',
  },
  resources: [
    {
      resourceId: '30000000-0000-4000-8000-000000000511',
      contentVersion: '0',
      publicationId: '40000000-0000-4000-8000-000000000511',
      domain: 'DEPRESSIVE_SYMPTOMS',
      role: 'PRIMARY',
      category: 'ARTICLE',
      title: 'Reviewed resource',
      summary: 'Reviewed summary.',
      externalUrl: null,
    },
  ],
  provenance: {
    supportEvaluationPolicyVersion: 'mb-support-routing-capstone-v2',
    assessmentResults: [
      {
        assessmentId: '50000000-0000-4000-8000-000000000511',
        instrument: 'PHQ9',
        questionnaireVersion: 'phq9-v2',
        scoringVersion: 'phq9-standard-bands-v1',
        screeningLevel: 'MILD',
      },
      {
        assessmentId: '60000000-0000-4000-8000-000000000511',
        instrument: 'GAD7',
        questionnaireVersion: 'gad7-v1',
        scoringVersion: 'gad7-standard-bands-v1',
        screeningLevel: 'MINIMAL',
      },
    ],
  },
  phrasing: {
    source: 'CARE_APPROVED_STANDARD',
    status: 'AI_UNAVAILABLE_FALLBACK',
  },
} as const

describe('Support Guide validation', () => {
  it('accepts the immutable guide and paginated history contract', () => {
    expect(parseSupportGuide(guide)).toEqual(guide)
    expect(
      parseSupportGuideHistory({
        items: [guide],
        nextCursor: null,
        hasMore: false,
      }),
    ).toEqual({
      items: [guide],
      nextCursor: null,
      hasMore: false,
    })
  })

  it('rejects persistent-plan claims, oversized resource sets, and malformed provenance', () => {
    expect(
      parseSupportGuide({ ...guide, guideType: 'SUPPORT_PLAN' }),
    ).toBeNull()
    expect(
      parseSupportGuide({
        ...guide,
        resources: Array.from({ length: 5 }, () => guide.resources[0]),
      }),
    ).toBeNull()
    expect(
      parseSupportGuide({
        ...guide,
        provenance: {
          ...guide.provenance,
          assessmentResults: guide.provenance.assessmentResults.slice(0, 1),
        },
      }),
    ).toBeNull()
  })

  it('rejects an unsafe resource URL before it reaches a rendered link', () => {
    expect(
      parseSupportGuide({
        ...guide,
        resources: [
          { ...guide.resources[0], externalUrl: 'javascript:alert(1)' },
        ],
      }),
    ).toBeNull()
  })

  it('rejects undeclared sensitive fields instead of forwarding them through the BFF', () => {
    expect(
      parseSupportGuide({
        ...guide,
        answers: [{ questionId: 'hidden', value: 3 }],
      }),
    ).toBeNull()
    expect(
      parseSupportGuide({
        ...guide,
        provenance: {
          ...guide.provenance,
          assessmentResults: [
            { ...guide.provenance.assessmentResults[0], totalScore: 12 },
            guide.provenance.assessmentResults[1],
          ],
        },
      }),
    ).toBeNull()
  })
})
