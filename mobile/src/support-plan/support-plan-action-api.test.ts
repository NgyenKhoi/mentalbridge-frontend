import {
  create,
  type AxiosAdapter,
  type InternalAxiosRequestConfig,
} from 'axios'
import { createSupportPlanActionApi } from './support-plan-action-api'
import {
  actionOccurrenceSchema,
  canonicalSupportPlanSchema,
  emotionReconciliationSchema,
  journalReconciliationSchema,
  supportPlanCompanionMessageSchema,
  type CanonicalSupportPlan,
} from './support-plan-action-contract'
import { makePlan, makeReassessmentSummary } from './support-plan-test-fixtures'

const planId = '10000000-0000-4000-8000-000000000641'
const actionId = '20000000-0000-4000-8000-000000000641'
const occurrenceId = '30000000-0000-4000-8000-000000000641'
const journalId = '40000000-0000-4000-8000-000000000642'
const instant = '2026-10-13T05:00:00Z'
function planFixture(): CanonicalSupportPlan {
  return {
    supportPlanId: planId,
    modelVersion: 3,
    planPolicyVersion: 'support-plan-emotion-actions-v1',
    representationMode: 'NATIVE_V3',
    status: 'ACTIVE',
    version: 1,
    safety: makePlan('ACTIVE').safety,
    focuses: [
      {
        focusId: 'emotion',
        title: 'Ghi nhận cảm xúc',
        rationale: null,
        ordinal: 1,
        personalizationProvenance: null,
        actions: [
          {
            actionId,
            actionType: 'EMOTION_CHECK_IN',
            actionVersion: 1,
            representationMode: 'NATIVE_V3',
            status: 'ACTIVE',
            pathRole: 'PRIMARY',
            purposeCode: 'NOTICE_SELF_REPORTED_EMOTIONS',
            rationale: null,
            ordinal: 1,
            source: {
              ownerDomain: 'JOURNAL_AI',
              sourceKind: 'EMOTION_CHECK_IN_CAPABILITY',
              sourceId: 'daily-emotion-check-in',
              sourceRevision: '1',
              sourcePolicyVersion: 'daily-emotion-check-in-v1',
              publicationId: null,
              eligibilityPolicyVersion: null,
              verifiedAt: instant,
            },
            provenance: {
              category: 'USER_SELECTED',
              referenceId: null,
              referenceVersion: null,
              acceptedAt: instant,
            },
            presentation: {
              title: 'Ghi nhận cảm xúc',
              summary: null,
              instructions: null,
              externalUrl: null,
            },
            schedules: [],
            createdAt: instant,
            updatedAt: instant,
            activatedAt: instant,
            endedAt: null,
          },
        ],
      },
    ],
    createdAt: instant,
    updatedAt: instant,
    activatedAt: instant,
    completedAt: null,
    completionReason: null,
    supersededAt: null,
    discardedAt: null,
    disclaimerCode: 'WELLBEING_SUPPORT_NOT_TREATMENT',
    disclaimer: 'Hỗ trợ sức khỏe tổng quát.',
  }
}
function evidenceFixture() {
  return {
    kind: 'EMOTION_CHECK_IN',
    ownerDomain: 'JOURNAL_AI',
    factId: '40000000-0000-4000-8000-000000000641',
    factRevision: '1',
    occurredAt: instant,
    verifiedAt: instant,
  } as const
}
function reconciliationFixture() {
  return {
    schemaVersion: 'emotion-check-in-occurrence-reconciliation-v1',
    occurrenceId,
    actionId,
    localDate: '2026-10-13',
    sourceState: 'DELETED',
    occurrenceState: 'COMPLETED',
    version: 1,
    completedAt: instant,
    completionEvidence: evidenceFixture(),
  } as const
}
function occurrenceFixture() {
  return {
    occurrenceId,
    actionId,
    actionType: 'EMOTION_CHECK_IN',
    actionVersion: 1,
    scheduleId: '50000000-0000-4000-8000-000000000641',
    scheduleVersion: 1,
    representationMode: 'NATIVE_V3',
    version: 0,
    localDate: '2026-10-13',
    scheduledAt: instant,
    state: 'SCHEDULED',
    displayState: 'OVERDUE',
    stateReason: null,
    completionEvidence: null,
    outcomeRecordedAt: null,
  } as const
}
function journalReconciliationFixture() {
  return {
    schemaVersion: 'journal-entry-occurrence-reconciliation-v1',
    occurrenceId,
    actionId,
    localDate: '2026-10-13',
    journalId,
    sourceState: 'RECORDED',
    occurrenceState: 'COMPLETED',
    version: 1,
    completedAt: instant,
    completionEvidence: {
      ...evidenceFixture(),
      kind: 'JOURNAL_ENTRY',
      factId: journalId,
    },
  } as const
}
function companionFixture() {
  return {
    schemaVersion: 'support-plan-companion-message-v1',
    supportPlanId: planId,
    actionId,
    intent: 'EXPLAIN_ACTION',
    surface: 'TODAY',
    text: 'Hoạt động này đến từ kế hoạch đã được bạn duyệt.',
    delivery: 'GENERATED',
    policyVersion: 'support-plan-companion-policy-v1',
    promptVersion: 'support-plan-companion-prompt-v1',
    templateVersion: 'support-plan-companion-template-v1',
    provider: 'OPENAI',
    model: 'bounded-test-model',
    fallbackReason: null,
  } as const
}
function apiFixture(responses: unknown[]) {
  const requests: InternalAxiosRequestConfig[] = []
  const adapter: AxiosAdapter = async (request) => {
    requests.push(request)
    return {
      config: request,
      data: responses[requests.length - 1],
      headers: {},
      status: 200,
      statusText: 'OK',
    }
  }
  return { api: createSupportPlanActionApi(create({ adapter })), requests }
}

describe('Native SupportPlan mobile transport', () => {
  it('uses the exact completed reassessment episode for native replacement discovery', async () => {
    const episode = {
      episodeId: actionId,
      purpose: 'REASSESSMENT',
      status: 'COMPLETED',
      supportEvaluationId: planId,
      createdAt: instant,
      updatedAt: instant,
      version: 1,
    }
    const { api, requests } = apiFixture([
      episode,
      { ...episode, purpose: 'INITIAL_CHECK' },
    ])
    expect(await api.getProposalEvaluationId('REASSESSMENT')).toBe(planId)
    expect(requests[0]?.url).toBe('/api/v1/screening-episodes/current')
    expect(requests[0]?.params).toEqual({ purpose: 'REASSESSMENT' })
    await expect(api.getProposalEvaluationId('REASSESSMENT')).rejects.toThrow(
      'Complete the current screening',
    )
  })
  it('reuses owner reassessment and schedule commands without manufacturing a legacy plan', async () => {
    const summary = makeReassessmentSummary()
    const { api, requests } = apiFixture([summary, planFixture()])
    expect((await api.getReassessmentSummary()).summaryId).toBe(
      summary.summaryId,
    )
    await api.replaceSchedule(
      planId,
      1,
      actionId,
      { schedule: null },
      'native-schedule-retry-01',
    )
    expect(requests[0]?.url).toBe('/api/v1/reassessment-summaries/current')
    expect(requests[1]?.url).toBe(
      `/api/v2/support-plans/${planId}/actions/${actionId}/schedule`,
    )
    expect(requests[1]?.headers.get('If-Match')).toBe('"1"')
    expect(JSON.parse(requests[1]?.data)).toEqual({ schedule: null })
  })
  it('creates a separate native draft and activates with strong validators, preserving legacy model', async () => {
    const active = planFixture()
    const draft = { ...active, status: 'DRAFT', activatedAt: null }
    const { api, requests } = apiFixture([draft, active])
    expect(
      (await api.propose(actionId, 'native-proposal-retry-01'))
        .representationMode,
    ).toBe('NATIVE_V3')
    await api.activate(planId, 1, 'native-activate-retry-01')
    expect(requests.map((request) => request.url)).toEqual([
      '/api/v2/support-plans',
      `/api/v2/support-plans/${planId}/activate`,
    ])
    expect(JSON.parse(requests[0]?.data)).toEqual({
      sourceSupportEvaluationId: actionId,
    })
    expect(requests[1]?.data).toBeUndefined()
    expect(requests[1]?.headers.get('If-Match')).toBe('"1"')
    expect(requests[1]?.headers.get('Idempotency-Key')).toBe(
      'native-activate-retry-01',
    )
  })
  it('reconciles an exact occurrence without a caller fact or payload, keeping source deletion separate', async () => {
    const result = reconciliationFixture()
    const { api, requests } = apiFixture([result])
    expect(await api.reconcileEmotion(occurrenceId)).toEqual(result)
    expect(requests[0]?.url).toBe(
      `/api/v2/support-plan-occurrences/${occurrenceId}/emotion-check-in/reconcile`,
    )
    expect(requests[0]?.data).toBeUndefined()
    expect(requests[0]?.headers.get('If-Match')).toBeUndefined()
    expect(requests[0]?.headers.get('Idempotency-Key')).toBeUndefined()
  })
  it('rejects mismatched owner identities rather than completing another occurrence', async () => {
    const { api } = apiFixture([
      { ...reconciliationFixture(), occurrenceId: actionId },
    ])
    await expect(api.reconcileEmotion(occurrenceId)).rejects.toThrow(
      'identity mismatch',
    )
  })
  it('keeps missing/deleted explicit and rejects false completion, raw payload, or wrong owner', () => {
    expect(
      emotionReconciliationSchema.safeParse({
        ...reconciliationFixture(),
        sourceState: 'MISSING',
      }).success,
    ).toBe(true)
    expect(
      emotionReconciliationSchema.safeParse({
        ...reconciliationFixture(),
        sourceState: 'UNAVAILABLE',
      }).success,
    ).toBe(false)
    expect(
      emotionReconciliationSchema.safeParse({
        ...reconciliationFixture(),
        completionEvidence: null,
      }).success,
    ).toBe(false)
    expect(
      emotionReconciliationSchema.safeParse({
        ...reconciliationFixture(),
        note: 'private',
      }).success,
    ).toBe(false)
    expect(
      emotionReconciliationSchema.safeParse({
        ...reconciliationFixture(),
        completionEvidence: { ...evidenceFixture(), ownerDomain: 'CARE' },
      }).success,
    ).toBe(false)
  })
  it('validates bounded dates and source attribution before rendering a canonical plan', async () => {
    const wrong = planFixture()
    const source = wrong.focuses[0]?.actions[0]?.source
    if (!source) throw new Error('Expected capability')
    source.ownerDomain = 'CARE'
    expect(canonicalSupportPlanSchema.safeParse(wrong).success).toBe(false)
    expect(
      canonicalSupportPlanSchema.safeParse({ ...planFixture(), rawEmotion: 5 })
        .success,
    ).toBe(false)
    const { api, requests } = apiFixture([])
    await expect(
      api.getOccurrences('2026-02-30', '2026-03-01'),
    ).rejects.toThrow()
    await expect(
      api.getOccurrences('2026-10-01', '2026-11-01'),
    ).rejects.toThrow()
    expect(requests).toHaveLength(0)
  })
  it('skips or reopens with exact occurrence version and never treats viewing as completion', async () => {
    const occurrence = occurrenceFixture()
    const { api, requests } = apiFixture([occurrence])
    await api.changeOccurrenceState(occurrenceId, 0, 'SCHEDULED')
    expect(requests[0]?.url).toBe(
      `/api/v2/support-plan-occurrences/${occurrenceId}/state`,
    )
    expect(requests[0]?.headers.get('If-Match')).toBe('"0"')
    expect(JSON.parse(requests[0]?.data)).toEqual({ state: 'SCHEDULED' })
    expect(
      actionOccurrenceSchema.safeParse({
        ...occurrence,
        state: 'COMPLETED',
        displayState: 'COMPLETED',
      }).success,
    ).toBe(false)
  })
  it('does not retry uncertain owner failure automatically', async () => {
    let calls = 0
    const adapter: AxiosAdapter = async () => {
      calls += 1
      throw new Error('Evidence unavailable')
    }
    await expect(
      createSupportPlanActionApi(create({ adapter })).reconcileEmotion(
        occurrenceId,
      ),
    ).rejects.toThrow('Evidence unavailable')
    expect(calls).toBe(1)
  })
  it('sends only an exact Journal candidate ID, not private content or a client completion assertion', async () => {
    const result = journalReconciliationFixture()
    const { api, requests } = apiFixture([result])
    expect(await api.reconcileJournal(occurrenceId, journalId)).toEqual(result)
    expect(requests[0]?.url).toBe(
      `/api/v2/support-plan-occurrences/${occurrenceId}/journal/reconcile`,
    )
    expect(JSON.parse(requests[0]?.data)).toEqual({ journalId })
    expect(requests[0]?.headers.get('If-Match')).toBeUndefined()
    expect(requests[0]?.headers.get('Idempotency-Key')).toBeUndefined()
  })
  it.each(['occurrenceId', 'journalId'] as const)(
    'rejects a Journal response with a different %s',
    async (field) => {
      const result = {
        ...journalReconciliationFixture(),
        [field]: actionId,
        completionEvidence: {
          ...journalReconciliationFixture().completionEvidence,
          factId: field === 'journalId' ? actionId : journalId,
        },
      }
      const { api } = apiFixture([result])
      await expect(
        api.reconcileJournal(occurrenceId, journalId),
      ).rejects.toThrow('identity mismatch')
    },
  )
  it.each(['RECORDED', 'MISSING', 'DELETED'] as const)(
    'retains accepted Journal evidence separately from %s source state',
    (sourceState) => {
      expect(
        journalReconciliationSchema.safeParse({
          ...journalReconciliationFixture(),
          sourceState,
        }).success,
      ).toBe(true)
    },
  )
  it.each(['MISSING', 'DELETED'] as const)(
    'does not manufacture Journal completion when the source is %s',
    (sourceState) => {
      expect(
        journalReconciliationSchema.safeParse({
          ...journalReconciliationFixture(),
          sourceState,
          occurrenceState: 'SCHEDULED',
          completedAt: null,
          completionEvidence: null,
        }).success,
      ).toBe(true)
    },
  )
  it('rejects private fields, revision-based evidence and malformed Journal outcomes', () => {
    const result = journalReconciliationFixture()
    const invalid = [
      {
        ...result,
        schemaVersion: 'journal-entry-occurrence-reconciliation-v2',
      },
      { ...result, journalId: 'not-an-id' },
      { ...result, sourceState: 'UNAVAILABLE' },
      { ...result, content: { text: 'private' } },
      { ...result, mood: 'GOOD' },
      { ...result, tags: ['private'] },
      { ...result, completedAt: null },
      { ...result, completionEvidence: null },
      {
        ...result,
        occurrenceState: 'SCHEDULED',
        completedAt: null,
        completionEvidence: null,
      },
      ...[
        { kind: 'EMOTION_CHECK_IN' },
        { ownerDomain: 'CARE' },
        { factId: actionId },
        { factRevision: '2' },
        { text: 'private' },
      ].map((change) => ({
        ...result,
        completionEvidence: { ...result.completionEvidence, ...change },
      })),
    ]
    for (const value of invalid)
      expect(journalReconciliationSchema.safeParse(value).success).toBe(false)
  })
  it('validates both Journal candidate and occurrence before issuing a request', async () => {
    const { api, requests } = apiFixture([])
    await expect(
      api.reconcileJournal(occurrenceId, 'not-an-id'),
    ).rejects.toThrow()
    await expect(
      api.reconcileJournal('https://outside.test', journalId),
    ).rejects.toThrow()
    expect(requests).toHaveLength(0)
  })
  it('does not retry an uncertain Journal reconciliation automatically', async () => {
    let calls = 0
    const adapter: AxiosAdapter = async () => {
      calls += 1
      throw new Error('Journal evidence unavailable')
    }
    await expect(
      createSupportPlanActionApi(create({ adapter })).reconcileJournal(
        occurrenceId,
        journalId,
      ),
    ).rejects.toThrow('Journal evidence unavailable')
    expect(calls).toBe(1)
  })
  it('requests only the bounded companion surface and verifies response identity', async () => {
    const response = companionFixture()
    const { api, requests } = apiFixture([response])
    expect(
      await api.requestCompanionExplanation(planId, actionId, 'TODAY'),
    ).toEqual(response)
    expect(requests[0]?.url).toBe(
      `/api/v2/support-plans/${planId}/actions/${actionId}/companion-explanation`,
    )
    expect(JSON.parse(requests[0]?.data)).toEqual({ surface: 'TODAY' })
    expect(requests[0]?.headers.get('If-Match')).toBeUndefined()
    expect(requests[0]?.headers.get('Idempotency-Key')).toBeUndefined()
  })
  it('fails closed for companion contract drift or a different owner identity', async () => {
    const invalid = [
      { ...companionFixture(), supportPlanId: actionId },
      { ...companionFixture(), surface: 'PLAN' as const },
      { ...companionFixture(), navigation: { destination: 'JOURNAL' } },
      { ...companionFixture(), delivery: 'GENERATED' as const, provider: null },
      { ...companionFixture(), text: 'x'.repeat(481) },
    ]
    for (const value of invalid) {
      const { api } = apiFixture([value])
      await expect(
        api.requestCompanionExplanation(planId, actionId, 'TODAY'),
      ).rejects.toThrow()
    }
    expect(
      supportPlanCompanionMessageSchema.safeParse(companionFixture()).success,
    ).toBe(true)
  })
})
