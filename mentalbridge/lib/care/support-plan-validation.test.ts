import { describe, expect, it } from 'vitest'

import { nativeSupportPlanFixture } from '@/features/support-plan/testing/native-support-plan-fixture'
import { supportPlanFixture } from '@/features/support-plan/testing/support-plan-fixture'
import {
  supportPlanOccurrenceFixture,
  supportPlanOccurrenceListFixture,
} from '@/features/support-plan/testing/support-plan-occurrence-fixture'
import {
  parseSupportEvaluationV2,
  parseSupportPlan,
  parseSupportPlanDraft,
  parseSupportPlanHistoryPage,
  parseSupportPlanOccurrence,
  parseSupportPlanOccurrenceList,
  parseSupportPlanV3,
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
  it('accepts the complete backend primary professional-support projection', () => {
    const projection = {
      supportPlanId: '10000000-0000-4000-8000-000000000643',
      modelVersion: 3,
      planPolicyVersion: 'mb-support-plan-selection-v1',
      representationMode: 'V2_RESOURCE_ADAPTER',
      status: 'ACTIVE',
      version: 1,
      safety: {
        status: 'NEGATIVE_SAFETY_SCREEN',
        reasonCode: 'PHQ9_ITEM9_NEGATIVE',
        policyVersion: 'MB-SAFETY-PHQ9-001-v1',
        guidanceCode: 'STANDARD_SAFETY_REMINDER',
        guidance: 'Hướng dẫn an toàn luôn được ưu tiên.',
      },
      focuses: [
        {
          focusId: 'professional-support',
          title: 'Hỗ trợ tâm trạng',
          rationale: 'Kết nối với chuyên gia là hướng hỗ trợ chính.',
          ordinal: 1,
          actions: [
            {
              actionId: '20000000-0000-4000-8000-000000000643',
              actionType: 'PROFESSIONAL_SUPPORT',
              actionVersion: 0,
              representationMode: 'V2_RESOURCE_ADAPTER',
              status: 'ACTIVE',
              pathRole: 'PRIMARY',
              purposeCode: 'CONNECT_WITH_PROFESSIONAL_SUPPORT',
              rationale: 'Hỗ trợ chuyên môn là hướng hỗ trợ chính.',
              ordinal: 1,
              source: {
                ownerDomain: 'CONSULTATION',
                sourceKind: 'PROFESSIONAL_SUPPORT_PATHWAY',
                sourceId: 'professional-support-pathway',
                sourceRevision: null,
                sourcePolicyVersion: 'mb-support-routing-capstone-v2',
                publicationId: null,
                eligibilityPolicyVersion: null,
                verifiedAt: '2026-10-11T08:00:00Z',
              },
              provenance: {
                category: 'SYSTEM_POLICY',
                referenceId: '70000000-0000-4000-8000-000000000643',
                referenceVersion: '2',
                acceptedAt: '2026-10-11T08:00:00Z',
              },
              presentation: {
                title: 'Kết nối với chuyên gia',
                summary: 'Hỗ trợ chuyên môn là hướng hỗ trợ chính.',
                instructions: null,
                externalUrl: null,
              },
              schedules: [],
              createdAt: '2026-10-11T08:00:00Z',
              updatedAt: '2026-10-11T08:00:00Z',
              activatedAt: '2026-10-11T08:00:00Z',
              endedAt: null,
            },
          ],
        },
      ],
      createdAt: '2026-10-11T08:00:00Z',
      updatedAt: '2026-10-11T08:00:00Z',
      activatedAt: '2026-10-11T08:00:00Z',
      completedAt: null,
      completionReason: null,
      supersededAt: null,
      discardedAt: null,
      disclaimerCode: 'WELLBEING_SUPPORT_NOT_TREATMENT',
      disclaimer:
        'Kế hoạch hỗ trợ sức khỏe tổng quát và không phải kế hoạch điều trị.',
    }

    expect(
      parseSupportPlanV3(projection)?.focuses[0]?.actions[0],
    ).toMatchObject({
      actionType: 'PROFESSIONAL_SUPPORT',
      pathRole: 'PRIMARY',
      source: {
        ownerDomain: 'CONSULTATION',
        sourceKind: 'PROFESSIONAL_SUPPORT_PATHWAY',
      },
    })
    expect(
      parseSupportPlanV3({
        ...projection,
        focuses: [
          {
            ...projection.focuses[0],
            actions: [
              { ...projection.focuses[0].actions[0], pathRole: 'EQUIVALENT' },
            ],
          },
        ],
      }),
    ).toBeNull()
  })

  it('accepts the bounded non-UUID action identity of a v2 adapter', () => {
    const base = nativeSupportPlanFixture()
    const withActionId = (actionId: string) => ({
      ...base,
      representationMode: 'V2_RESOURCE_ADAPTER',
      focuses: [
        {
          ...base.focuses[0],
          actions: [{ ...base.focuses[0].actions[0], actionId }],
        },
      ],
    })
    // Care's adapter emits stable virtual identities of 1 to 128 characters.
    expect(
      parseSupportPlanV3(withActionId('slot:resource-3:rev-2'))?.focuses[0]
        .actions[0].actionId,
    ).toBe('slot:resource-3:rev-2')
    expect(parseSupportPlanV3(withActionId(''))).toBeNull()
    expect(parseSupportPlanV3(withActionId('a'.repeat(129)))).toBeNull()
  })

  it('accepts the governed persisted draft shape', () => {
    expect(parseSupportPlanDraft(supportPlanFixture())).not.toBeNull()
  })

  it('accepts an authoritative active plan but not as a draft', () => {
    const fixture = supportPlanFixture()
    const active = {
      ...fixture,
      status: 'ACTIVE',
      activatedAt: '2026-09-20T05:00:00Z',
    }
    expect(parseSupportPlanDraft(active)).toBeNull()
    expect(parseSupportPlan(active)).not.toBeNull()
  })

  it('accepts only lifecycle-consistent immutable terminal history', () => {
    const fixture = supportPlanFixture()
    const completed = {
      ...fixture,
      status: 'COMPLETED',
      version: 2,
      activatedAt: '2026-09-20T05:00:00Z',
      completedAt: '2026-09-21T05:00:00Z',
      completionReason: 'USER_DECISION',
    }

    expect(
      parseSupportPlanHistoryPage({
        items: [completed],
        nextCursor: null,
        hasMore: false,
      }),
    ).not.toBeNull()
    expect(
      parseSupportPlan({
        ...completed,
        status: 'ACTIVE',
      }),
    ).toBeNull()
    expect(
      parseSupportPlanHistoryPage({
        items: [{ ...completed, completionReason: 'RECOVERED' }],
        nextCursor: null,
        hasMore: false,
      }),
    ).toBeNull()
  })

  it('accepts a removed optional selection with an exact resource count', () => {
    const fixture = supportPlanFixture()
    expect(
      parseSupportPlan({
        ...fixture,
        slots: [
          ...fixture.slots,
          {
            ...fixture.slots[0],
            slotId: 'optional-practice',
            kind: 'OPTIONAL',
            selectedResource: null,
            allowedAlternatives: [],
          },
        ],
      }),
    ).not.toBeNull()
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

  it('accepts bounded resource and standalone wellbeing prompt occurrences', () => {
    expect(
      parseSupportPlanOccurrenceList(supportPlanOccurrenceListFixture()),
    ).not.toBeNull()
    expect(
      parseSupportPlanOccurrence(
        supportPlanOccurrenceFixture({
          source: {
            ...supportPlanOccurrenceFixture().source,
            type: 'JOURNAL_PROMPT',
            slotId: null,
            resourceId: null,
            contentVersion: null,
          },
        }),
      ),
    ).not.toBeNull()
  })

  it('rejects occurrence payloads that lose source provenance or meaning', () => {
    expect(
      parseSupportPlanOccurrence(
        supportPlanOccurrenceFixture({
          interpretationCode: 'TREATMENT_ADHERENCE' as never,
        }),
      ),
    ).toBeNull()
    expect(
      parseSupportPlanOccurrence({
        ...supportPlanOccurrenceFixture(),
        source: {
          ...supportPlanOccurrenceFixture().source,
          contentVersion: 'latest',
        },
      }),
    ).toBeNull()
  })
})
