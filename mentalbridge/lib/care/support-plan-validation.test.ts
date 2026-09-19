import { describe, expect, it } from 'vitest'

import { supportPlanFixture } from '@/features/support-plan/testing/support-plan-fixture'
import {
  parseSupportEvaluationV2,
  parseSupportPlanDraft,
} from './support-plan-validation'

const evaluation = {
  supportEvaluationId: '70000000-0000-4000-8000-000000000372',
  evaluationVersion: 2,
  policyVersion: 'mb-support-routing-capstone-v2',
  evaluatedAt: '2026-09-19T04:00:00Z',
  contributingDomains: [
    {
      assessmentId: '71000000-0000-4000-8000-000000000372',
      questionnaireDefinitionId: '72000000-0000-4000-8000-000000000372',
      instrument: 'PHQ9',
      domain: 'DEPRESSIVE_SYMPTOMS',
      questionnaireVersion: 'phq9-v2',
      scoringVersion: 'phq9-standard-bands-v1',
      screeningLevel: 'MILD',
      supportPathway: 'SELF_GUIDED_SUPPORT',
      reasonCodes: ['PHQ9_LEVEL_MILD'],
    },
    {
      assessmentId: '73000000-0000-4000-8000-000000000372',
      questionnaireDefinitionId: '74000000-0000-4000-8000-000000000372',
      instrument: 'GAD7',
      domain: 'ANXIETY_SYMPTOMS',
      questionnaireVersion: 'gad7-v1',
      scoringVersion: 'gad7-standard-bands-v1',
      screeningLevel: 'MINIMAL',
      supportPathway: 'SELF_GUIDED_SUPPORT',
      reasonCodes: ['GAD7_LEVEL_MINIMAL'],
    },
  ],
  safetyEvidence: {
    sourceAssessmentId: '71000000-0000-4000-8000-000000000372',
    instrument: 'PHQ9',
    trigger: 'PHQ9_ITEM_9',
    status: 'NEGATIVE_SAFETY_SCREEN',
    policyVersion: 'MB-SAFETY-PHQ9-001-v1',
    reasonCode: 'PHQ9_ITEM9_NEGATIVE',
  },
  disclaimerCode: 'SCREENING_NOT_DIAGNOSIS',
  disclaimer: 'Screening support only.',
}

describe('SupportPlan validation', () => {
  it('accepts the governed persisted draft shape', () => {
    expect(parseSupportPlanDraft(supportPlanFixture())).not.toBeNull()
  })

  it.each([
    ['wrong evaluation policy', { evaluationPolicyVersion: 'legacy-v1' }],
    ['wrong selection policy', { selectionPolicyVersion: 'legacy-v1' }],
  ])('rejects %s', (_label, sourceChange) => {
    const fixture = supportPlanFixture()
    expect(
      parseSupportPlanDraft({
        ...fixture,
        source: { ...fixture.source, ...sourceChange },
      }),
    ).toBeNull()
  })

  it('rejects a client-visible FREE draft', () => {
    const fixture = supportPlanFixture()
    expect(
      parseSupportPlanDraft({
        ...fixture,
        entitlement: { ...fixture.entitlement, packageCode: 'FREE' },
      }),
    ).toBeNull()
  })

  it('accepts only the exact two-domain SupportEvaluation v2 evidence', () => {
    expect(parseSupportEvaluationV2(evaluation)).not.toBeNull()
    expect(
      parseSupportEvaluationV2({
        ...evaluation,
        contributingDomains: [
          evaluation.contributingDomains[0],
          evaluation.contributingDomains[0],
        ],
      }),
    ).toBeNull()
  })
})
