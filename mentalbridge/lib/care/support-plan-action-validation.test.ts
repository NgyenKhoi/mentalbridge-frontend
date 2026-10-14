import { describe, expect, it } from 'vitest'
import {
  emotionCompletionFixture,
  emotionOccurrenceFixture,
  nativeSupportPlanFixture,
} from '@/features/support-plan/testing/native-support-plan-fixture'
import {
  isSupportPlanLocalDate,
  parseActionOccurrence,
  parseActionOccurrenceList,
  parseCanonicalSupportPlan,
  parseCompletionEvidence,
  parseEmotionCheckInReconciliation,
  parseJournalReconciliation,
  parseSupportPlanActionHistory,
} from './support-plan-action-validation'

describe('Canonical native SupportPlan boundaries', () => {
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
