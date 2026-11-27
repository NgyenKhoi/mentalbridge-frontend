import type { SupportPlanDraft } from '../api/support-plan-contract'

export function supportPlanFixture(): SupportPlanDraft {
  return {
    supportPlanId: '10000000-0000-4000-8000-000000000372',
    status: 'DRAFT',
    version: 0,
    source: {
      supportEvaluationId: '20000000-0000-4000-8000-000000000372',
      evaluationVersion: 2,
      evaluationPolicyVersion: 'mb-support-routing-capstone-v2',
      evaluatedAt: '2026-09-19T04:00:00Z',
      selectionPolicyVersion: 'mb-support-plan-selection-v1',
      resourceEligibilityPolicyVersion: 'content-eligibility-v1',
      resourcesResolvedAt: '2026-09-19T04:01:00Z',
    },
    entitlement: {
      packageCode: 'PLUS',
      source: 'DEMO',
      policyVersion: 'service-entitlement-v1',
      version: 1,
      decidedAt: '2026-09-19T03:00:00Z',
    },
    rationale: {
      code: 'DOMAIN_AWARE_WELLBEING_SUPPORT',
      text: 'A bounded plan based on the reviewed screening domains.',
    },
    safety: {
      status: 'POSITIVE_SAFETY_SCREEN',
      reasonCode: 'PHQ9_ITEM9_POSITIVE',
      policyVersion: 'MB-SAFETY-PHQ9-001-v1',
      guidanceCode: 'REVIEW_SAFETY_GUIDANCE',
      guidance: 'Safety guidance remains available now.',
    },
    templateFamilies: [
      {
        family: 'DEPRESSIVE_SELF_GUIDED',
        templateVersion: 1,
        targetDomain: 'DEPRESSIVE_SYMPTOMS',
      },
    ],
    slots: [
      {
        slotId: 'depressive-psychoeducation',
        kind: 'CORE',
        targetDomain: 'DEPRESSIVE_SYMPTOMS',
        purposeCode: 'UNDERSTAND_CURRENT_PATTERN',
        selectedResource: {
          resourceId: '30000000-0000-4000-8000-000000000372',
          contentVersion: '4',
          publicationId: '40000000-0000-4000-8000-000000000372',
          role: 'PRIMARY',
          category: 'ARTICLE',
          title: 'Reviewed primary resource',
          summary: 'Reviewed summary.',
          externalUrl: null,
        },
        allowedAlternatives: [
          {
            resourceId: '50000000-0000-4000-8000-000000000372',
            contentVersion: '2',
            publicationId: '60000000-0000-4000-8000-000000000372',
            role: 'PRIMARY',
            category: 'VIDEO',
            title: 'Reviewed alternative',
            summary: 'Alternative summary.',
            externalUrl: null,
          },
        ],
      },
    ],
    selectedResourceCount: 1,
    createdAt: '2026-09-19T04:02:00Z',
    updatedAt: '2026-09-19T04:02:00Z',
    activatedAt: null,
    completedAt: null,
    completionReason: null,
    supersededAt: null,
    discardedAt: null,
    disclaimerCode: 'WELLBEING_SUPPORT_NOT_TREATMENT',
    disclaimer: 'This draft is wellbeing support, not diagnosis or treatment.',
  }
}
