import { describe, expect, it } from 'vitest'
import {
  emotionCompletionFixture,
  emotionOccurrenceFixture,
  nativeSupportPlanFixture,
} from '@/features/support-plan/testing/native-support-plan-fixture'
import {
  adaptiveConfirmationFixture,
  adaptiveReviewFixture,
} from '@/features/support-plan/testing/adaptive-review-fixture'
import {
  isSupportPlanLocalDate,
  parseActionOccurrence,
  parseAdaptiveReviewConfirmation,
  parseAdaptiveSupportPlanReview,
  parseActionOccurrenceList,
  parseCanonicalSupportPlan,
  parseCompletionEvidence,
  parseEmotionCheckInReconciliation,
  parseJournalReconciliation,
  parseSupportPlanActionHistory,
  parseSupportPlanContextualCompanionMessage,
} from './support-plan-action-validation'

describe('Canonical native SupportPlan boundaries', () => {
  it('binds contextual Companion output to a strict bounded response shape', () => {
    const message = {
      schemaVersion: 'support-plan-companion-message-v1',
      supportPlanId: '10000000-0000-4000-8000-000000000650',
      actionId: '20000000-0000-4000-8000-000000000650',
      intent: 'EXPLAIN_ACTION',
      surface: 'PLAN',
      text: 'Lời giải thích đã được kiểm duyệt.',
      delivery: 'GENERATED',
      policyVersion: 'support-plan-companion-policy-v1',
      promptVersion: 'support-plan-companion-prompt-v1',
      templateVersion: 'support-plan-companion-template-v1',
      provider: 'OPENAI',
      model: 'test-model',
      fallbackReason: null,
    }
    expect(parseSupportPlanContextualCompanionMessage(message)).toEqual(message)
    expect(
      parseSupportPlanContextualCompanionMessage({
        ...message,
        privateContext: 'must not cross the boundary',
      }),
    ).toBeNull()
    expect(
      parseSupportPlanContextualCompanionMessage({
        ...message,
        delivery: 'TEMPLATE',
      }),
    ).toBeNull()
  })
  it('accepts the source-owned full action shape and rejects unknown payload or wrong source attribution', () => {
    const plan = nativeSupportPlanFixture()
    expect(parseCanonicalSupportPlan(plan)).toEqual(plan)
    expect(
      parseCanonicalSupportPlan({ ...plan, rawEmotion: 'private' }),
    ).toBeNull()
    const wrong = structuredClone(plan)
    const action = wrong.focuses[0].actions[0]
    if (!action.source) throw new Error('Expected a capability reference')
    action.source.ownerDomain = 'CARE'
    expect(parseCanonicalSupportPlan(wrong)).toBeNull()
    const malformed = structuredClone(plan)
    malformed.focuses[0].actions[0].actionVersion = -1
    expect(parseCanonicalSupportPlan(malformed)).toBeNull()
  })
  it('accepts the additive 14-day cycle only in its exact shape, and its absence', () => {
    const cycle = {
      policyVersion: 'support-plan-cycle-v1',
      lengthDays: 14,
      timezone: 'Asia/Ho_Chi_Minh',
      cycleNumber: 1,
      startedOn: '2026-10-17',
      reviewDueOn: '2026-10-30',
      currentDay: 1,
      pausedDays: 0,
      state: 'IN_PROGRESS',
    } as const
    const plan = nativeSupportPlanFixture()
    expect(parseCanonicalSupportPlan(plan)).not.toBeNull()
    expect(parseCanonicalSupportPlan({ ...plan, cycle: null })).not.toBeNull()
    expect(parseCanonicalSupportPlan({ ...plan, cycle })).not.toBeNull()
    for (const wrong of [
      { ...cycle, lengthDays: 30 },
      { ...cycle, state: 'FINISHED' },
      { ...cycle, startedOn: '2026-02-30' },
      { ...cycle, score: 80 },
    ])
      expect(parseCanonicalSupportPlan({ ...plan, cycle: wrong })).toBeNull()
  })
  it('tolerates additive native engagement fields but validates their values', () => {
    const occurrence = emotionOccurrenceFixture()
    const engaged = {
      ...occurrence,
      hidden: false,
      helpfulness: null,
      barrierCode: null,
      reflection: null,
      summaryReuseApproved: false,
      engagementUpdatedAt: null,
    }
    expect(parseActionOccurrence(occurrence)).toEqual(occurrence)
    expect(parseActionOccurrence(engaged)).toEqual(engaged)
    expect(
      parseActionOccurrence({ ...engaged, helpfulness: 'AMAZING' }),
    ).toBeNull()
    expect(
      parseActionOccurrence({ ...engaged, helpfulness: ['HELPFUL'] }),
    ).toBeNull()
    expect(
      parseActionOccurrence({ ...engaged, barrierCode: ['OTHER'] }),
    ).toBeNull()
    expect(parseActionOccurrence({ ...engaged, rawEmotion: 5 })).toBeNull()
  })

  it('validates real local dates and bounded, nonduplicated owner occurrence windows', () => {
    expect(isSupportPlanLocalDate('2026-02-30')).toBe(false)
    expect(isSupportPlanLocalDate('2028-02-29')).toBe(true)
    const occurrence = emotionOccurrenceFixture()
    const window = {
      supportPlanId: nativeSupportPlanFixture().supportPlanId,
      supportPlanStatus: 'ACTIVE',
      representationMode: 'NATIVE_V3',
      from: '2026-10-13',
      through: '2026-10-19',
      occurrences: [occurrence],
      interpretationCode:
        'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
    }
    expect(parseActionOccurrenceList(window)).toEqual(window)
    expect(
      parseActionOccurrenceList({
        ...window,
        occurrences: [occurrence, occurrence],
      }),
    ).toBeNull()
    expect(
      parseActionOccurrenceList({ ...window, through: '2026-11-13' }),
    ).toBeNull()
    expect(
      parseActionOccurrenceList({ ...window, from: '2026-10-14' }),
    ).toBeNull()
    expect(
      parseActionOccurrenceList({
        ...window,
        representationMode: 'V2_RESOURCE_ADAPTER',
      }),
    ).toBeNull()
  })

  it('requires the authoritative fact kind/owner for a completed Emotion action', () => {
    const evidence = emotionCompletionFixture()
    const occurrence = {
      ...emotionOccurrenceFixture(),
      state: 'COMPLETED',
      displayState: 'COMPLETED',
      version: 1,
      completionEvidence: evidence,
      outcomeRecordedAt: evidence.verifiedAt,
    }
    expect(parseActionOccurrence(occurrence)).toEqual(occurrence)
    expect(
      parseActionOccurrence({
        ...occurrence,
        completionEvidence: {
          ...evidence,
          ownerDomain: 'CARE',
          kind: 'USER_ACKNOWLEDGEMENT',
        },
      }),
    ).toBeNull()
    expect(
      parseActionOccurrence({ ...occurrence, completionEvidence: null }),
    ).toBeNull()
    expect(
      parseActionOccurrence({ ...occurrence, displayState: 'OVERDUE' }),
    ).toBeNull()
    expect(
      parseActionOccurrence({
        ...emotionOccurrenceFixture(),
        completionEvidence: evidence,
      }),
    ).toBeNull()
    expect(
      parseCompletionEvidence({
        ...evidence,
        verifiedAt: '2026-10-12T13:01:00Z',
      }),
    ).toBeNull()
    expect(
      parseCompletionEvidence({
        ...evidence,
        privateNote: 'must not enter Care',
      }),
    ).toBeNull()
  })

  it('keeps fresh source absence separate from immutable accepted completion', () => {
    const occurrence = emotionOccurrenceFixture()
    const result = {
      schemaVersion: 'emotion-check-in-occurrence-reconciliation-v1',
      occurrenceId: occurrence.occurrenceId,
      actionId: occurrence.actionId,
      localDate: occurrence.localDate,
      sourceState: 'DELETED',
      occurrenceState: 'COMPLETED',
      version: 1,
      completedAt: '2026-10-13T13:01:00Z',
      completionEvidence: emotionCompletionFixture(),
    }
    expect(parseEmotionCheckInReconciliation(result)).toEqual(result)
    expect(
      parseEmotionCheckInReconciliation({ ...result, sourceState: 'MISSING' }),
    ).not.toBeNull()
    expect(
      parseEmotionCheckInReconciliation({
        ...result,
        sourceState: 'UNAVAILABLE',
      }),
    ).toBeNull()
    expect(
      parseEmotionCheckInReconciliation({
        ...result,
        occurrenceState: 'SCHEDULED',
      }),
    ).toBeNull()
    expect(
      parseEmotionCheckInReconciliation({
        ...result,
        occurrenceState: 'SCHEDULED',
        completionEvidence: null,
        completedAt: null,
      }),
    ).not.toBeNull()
  })

  it('returns only bounded terminal history, never a live current plan as archived evidence', () => {
    const active = nativeSupportPlanFixture()
    const page = {
      items: [
        { ...active, status: 'COMPLETED', completedAt: '2026-10-13T14:00:00Z' },
      ],
      nextCursor: null,
      hasMore: false,
    }
    expect(parseSupportPlanActionHistory(page)).not.toBeNull()
    expect(
      parseSupportPlanActionHistory({ ...page, items: [active] }),
    ).toBeNull()
    expect(parseSupportPlanActionHistory({ ...page, hasMore: true })).toBeNull()
  })
})

describe('Minimized Journal occurrence reconciliation', () => {
  const journalId = '50000000-0000-4000-8000-000000000642'
  const value = {
    schemaVersion: 'journal-entry-occurrence-reconciliation-v1',
    occurrenceId: '40000000-0000-4000-8000-000000000642',
    actionId: '30000000-0000-4000-8000-000000000642',
    localDate: '2026-10-14',
    journalId,
    sourceState: 'RECORDED',
    occurrenceState: 'COMPLETED',
    version: 1,
    completedAt: '2026-10-14T02:01:00Z',
    completionEvidence: {
      ownerDomain: 'JOURNAL_AI',
      kind: 'JOURNAL_ENTRY',
      factId: journalId,
      factRevision: '1',
      occurredAt: '2026-10-14T02:00:00Z',
      verifiedAt: '2026-10-14T02:01:00Z',
    },
  }
  it('retains accepted creation evidence separately from current deleted or missing source state', () => {
    for (const sourceState of ['RECORDED', 'MISSING', 'DELETED']) {
      const result = { ...value, sourceState }
      expect(parseJournalReconciliation(result)).toEqual(result)
    }
  })
  it('never accepts manual, swapped-entry, mutable-revision or content-bearing evidence', () => {
    for (const completionEvidence of [
      null,
      {
        ...value.completionEvidence,
        ownerDomain: 'CARE',
        kind: 'USER_ACKNOWLEDGEMENT',
      },
      { ...value.completionEvidence, factId: value.actionId },
      { ...value.completionEvidence, factRevision: '2' },
      { ...value.completionEvidence, journalText: 'private reflection' },
    ])
      expect(
        parseJournalReconciliation({ ...value, completionEvidence }),
      ).toBeNull()
    expect(
      parseJournalReconciliation({ ...value, journalText: 'private' }),
    ).toBeNull()
    expect(
      parseJournalReconciliation({ ...value, journalId: [journalId] }),
    ).toBeNull()
  })
  it('keeps authoritative absence open and rejects false recorded completion', () => {
    const open = {
      ...value,
      sourceState: 'MISSING',
      occurrenceState: 'SCHEDULED',
      version: 0,
      completedAt: null,
      completionEvidence: null,
    }
    expect(parseJournalReconciliation(open)).toEqual(open)
    expect(
      parseJournalReconciliation({ ...open, sourceState: 'RECORDED' }),
    ).toBeNull()
    expect(
      parseJournalReconciliation({ ...value, localDate: '2026-02-30' }),
    ).toBeNull()
  })
})

describe('Adaptive SupportPlan review boundary', () => {
  it('accepts the governed review and keeps every source separate', () => {
    const review = adaptiveReviewFixture()
    expect(parseAdaptiveSupportPlanReview(review)).toEqual(review)
  })
  it('rejects scores, inferred fields and inconsistent admission', () => {
    const review = adaptiveReviewFixture()
    for (const invalid of [
      { ...review, wellbeingScore: 72 },
      { ...review, schemaVersion: 'adaptive-support-plan-review-v2' },
      { ...review, currentAdmission: 'UNAVAILABLE' },
      { ...review, outcome: null },
      { ...review, reviewFingerprint: 'short' },
      { ...review, reassessment: { ...review.reassessment, summary: null } },
      {
        ...review,
        reassessment: { ...review.reassessment, state: 'NOT_STARTED' },
      },
      { ...review, patterns: [{ ...review.patterns[0], count: 1 }] },
      {
        ...review,
        contradictions: [
          {
            ...review.contradictions[0],
            evidenceRefs: [review.contradictions[0].evidenceRefs[0]],
          },
        ],
      },
      {
        ...review,
        options: [{ ...review.options[0], kind: 'AUTO_APPLY' }],
      },
      {
        ...review,
        options: [{ ...review.options[1], rationaleCodes: [] }],
      },
    ])
      expect(parseAdaptiveSupportPlanReview(invalid)).toBeNull()
    expect(
      parseAdaptiveSupportPlanReview({
        ...review,
        currentAdmission: 'UNAVAILABLE',
        outcome: null,
        reassessment: {
          state: 'NOT_STARTED',
          reasonCode: 'REASSESSMENT_NOT_SUBMITTED',
          summary: null,
        },
      }),
    ).not.toBeNull()
  })
  it('accepts a confirmation only with a draft exactly when one was prepared', () => {
    expect(
      parseAdaptiveReviewConfirmation(adaptiveConfirmationFixture()),
    ).not.toBeNull()
    const prepared = adaptiveConfirmationFixture('DRAFT_PREPARED', 'alt-1')
    expect(parseAdaptiveReviewConfirmation(prepared)).not.toBeNull()
    expect(
      parseAdaptiveReviewConfirmation({ ...prepared, result: 'REPLACED' }),
    ).toBeNull()
    expect(
      parseAdaptiveReviewConfirmation({
        ...adaptiveConfirmationFixture(),
        result: 'DRAFT_PREPARED',
      }),
    ).toBeNull()
  })
})

describe('Adaptive review provider shapes', () => {
  it('accepts an unavailable Journal source whose optional ids are omitted', () => {
    const review = adaptiveReviewFixture()
    const summary = structuredClone(review.reassessment.summary!)
    const journal = summary.journalContext as Record<string, unknown>
    delete journal.jobId
    delete journal.analysisId
    journal.state = 'UNAVAILABLE'
    expect(
      parseAdaptiveSupportPlanReview({
        ...review,
        reassessment: { ...review.reassessment, summary },
      }),
    ).not.toBeNull()
  })
  it('accepts the exact-period evidence context without a summary and rejects a reinterpreted one', () => {
    const review = adaptiveReviewFixture()
    const withoutSummary = {
      ...review,
      reassessment: {
        state: 'NOT_STARTED',
        reasonCode: 'REASSESSMENT_NOT_SUBMITTED',
        summary: null,
      },
    }
    expect(parseAdaptiveSupportPlanReview(withoutSummary)).not.toBeNull()
    const context = review.evidenceContext!
    for (const broken of [
      { ...context, timezone: 'Asia/Ho_Chi_Minh' },
      { ...context, wellbeingScore: 3 },
      {
        ...context,
        engagementSources: [{ ...context.engagementSources[0], state: 'OPEN' }],
      },
    ])
      expect(
        parseAdaptiveSupportPlanReview({ ...review, evidenceContext: broken }),
      ).toBeNull()
  })
})
