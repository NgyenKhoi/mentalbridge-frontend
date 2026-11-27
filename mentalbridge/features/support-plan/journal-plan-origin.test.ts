import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  ActionOccurrence,
  ActionOccurrenceList,
  SupportPlanV3,
} from './api/support-plan-contract'
import {
  emotionOccurrenceFixture,
  nativeSupportPlanFixture,
} from './testing/native-support-plan-fixture'

const api = vi.hoisted(() => ({ current: vi.fn(), occurrences: vi.fn() }))
vi.mock('./api/browser-support-plan-actions', () => ({
  getCurrentSupportPlanActions: api.current,
  getSupportPlanActionOccurrences: api.occurrences,
}))
import {
  journalPlanHref,
  parseJournalPlanOrigin,
  resolveJournalPlanOrigin,
  type JournalPlanOrigin,
} from './journal-plan-origin'

const journalId = '70000000-0000-4000-8000-000000000642'
const origin: JournalPlanOrigin = {
  source: 'journal',
  occurrenceId: '30000000-0000-4000-8000-000000000642',
  actionId: '20000000-0000-4000-8000-000000000642',
  localDate: '2026-10-13',
}

function planFixture(): SupportPlanV3 {
  const plan = nativeSupportPlanFixture()
  const action = plan.focuses[0].actions[0]
  action.actionId = origin.actionId
  action.actionType = 'JOURNAL'
  action.purposeCode = 'WRITE_SHORT_REFLECTION'
  action.source = {
    ...action.source!,
    ownerDomain: 'JOURNAL_AI',
    sourceKind: 'JOURNAL_TEMPLATE',
    sourceId: 'short-reflection',
    sourcePolicyVersion: 'journal-writing-intent-v1',
  }
  action.presentation.title = 'Viết một suy nghĩ ngắn'
  return plan
}

function occurrenceFixture(): ActionOccurrence {
  return {
    ...emotionOccurrenceFixture(),
    occurrenceId: origin.occurrenceId,
    actionId: origin.actionId,
    actionType: 'JOURNAL',
  }
}

function windowFixture(occurrence = occurrenceFixture()): ActionOccurrenceList {
  return {
    supportPlanId: planFixture().supportPlanId,
    supportPlanStatus: 'ACTIVE',
    representationMode: 'NATIVE_V3',
    from: origin.localDate,
    through: origin.localDate,
    occurrences: [occurrence],
    interpretationCode:
      'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
  }
}

describe('Journal plan origin hints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.current.mockResolvedValue(planFixture())
    api.occurrences.mockResolvedValue(windowFixture())
  })

  it('requires the Journal discriminator, exact identifiers and a real local date', () => {
    expect(parseJournalPlanOrigin(new URLSearchParams())).toBeNull()
    expect(parseJournalPlanOrigin(new URLSearchParams(origin))).toEqual(origin)
    for (const [key, value] of [
      ['source', 'emotion'],
      ['occurrenceId', 'not-a-uuid'],
      ['actionId', 'virtual-action'],
      ['localDate', '2026-02-30'],
      ['journalId', ''],
      ['journalId', 'not-a-uuid'],
    ]) {
      const params = new URLSearchParams(origin)
      params.set(key, value)
      expect(parseJournalPlanOrigin(params)).toBeNull()
    }
  })

  it.each(['source', 'occurrenceId', 'actionId', 'localDate', 'journalId'])(
    'rejects duplicate %s hints instead of selecting the first value',
    (key) => {
      const params = new URLSearchParams({ ...origin, journalId })
      params.append(key, params.get(key)!)
      expect(parseJournalPlanOrigin(params)).toBeNull()
    },
  )

  it('keeps only allowed metadata and fixed route targets, never private or arbitrary URL fields', () => {
    const polluted = {
      ...origin,
      journalId,
      returnTo: 'https://evil.invalid',
      timezone: 'UTC',
      text: 'private reflection',
      preview: 'private preview',
      mood: 'LOW',
    }
    const parsed = parseJournalPlanOrigin(new URLSearchParams(polluted))
    expect(parsed).toEqual({ ...origin, journalId })
    expect(journalPlanHref(polluted, '/journal')).toBe(
      `/journal?source=journal&occurrenceId=${origin.occurrenceId}&actionId=${origin.actionId}&localDate=2026-10-13&journalId=${journalId}`,
    )
    expect(journalPlanHref(polluted, '/support-plan')).toBe(
      `/support-plan?source=journal&occurrenceId=${origin.occurrenceId}&actionId=${origin.actionId}&localDate=2026-10-13&journalId=${journalId}#activity-${origin.occurrenceId}`,
    )
    expect(journalPlanHref(origin, '/journal')).not.toContain('journalId')
    expect(journalPlanHref(polluted, '/support-plan')).not.toMatch(
      /evil|private|timezone|preview|mood/,
    )
  })

  it('resolves fresh owned native Journal context and carries a candidate without claiming completion', async () => {
    const resolved = await resolveJournalPlanOrigin({ ...origin, journalId })
    expect(resolved).toMatchObject({
      ...origin,
      journalId,
      timezone: 'Asia/Ho_Chi_Minh',
      title: 'Viết một suy nghĩ ngắn',
      canOpenWriting: true,
      occurrence: { state: 'SCHEDULED', completionEvidence: null },
    })
    expect(api.current).toHaveBeenCalledTimes(1)
    expect(api.occurrences).toHaveBeenCalledWith('2026-10-13', '2026-10-13')
  })

  it('rejects legacy plans, wrong plan windows, nearby activities and mismatched dates/schedules', async () => {
    api.current.mockResolvedValueOnce({
      ...planFixture(),
      representationMode: 'V2_RESOURCE_ADAPTER',
    })
    await expect(resolveJournalPlanOrigin(origin)).rejects.toThrow(
      'JOURNAL_PLAN_ORIGIN_UNAVAILABLE',
    )
    api.occurrences.mockResolvedValueOnce({
      ...windowFixture(),
      supportPlanId: '10000000-0000-4000-8000-000000000642',
    })
    await expect(resolveJournalPlanOrigin(origin)).rejects.toThrow()
    for (const patch of [
      { actionId: '20000000-0000-4000-8000-000000000643' },
      { actionType: 'EMOTION_CHECK_IN' as const },
      { representationMode: 'V2_RESOURCE_ADAPTER' as const },
      { localDate: '2026-10-14' },
      { scheduleId: '40000000-0000-4000-8000-000000000643' },
      { scheduleVersion: 2 },
      { state: 'CANCELLED' as const },
      { state: 'SKIPPED' as const },
    ]) {
      api.occurrences.mockResolvedValueOnce(
        windowFixture({ ...occurrenceFixture(), ...patch }),
      )
      await expect(resolveJournalPlanOrigin(origin)).rejects.toThrow()
    }
  })

  it('requires an exact native action with compatible Journal source', async () => {
    for (const patch of [
      { actionId: '20000000-0000-4000-8000-000000000643' },
      { actionType: 'EMOTION_CHECK_IN' as const },
      { representationMode: 'V2_RESOURCE_ADAPTER' as const },
      { source: nativeSupportPlanFixture().focuses[0].actions[0].source },
    ]) {
      const plan = planFixture()
      Object.assign(plan.focuses[0].actions[0], patch)
      api.current.mockResolvedValueOnce(plan)
      await expect(resolveJournalPlanOrigin(origin)).rejects.toThrow()
    }
  })

  it('rejects missing or unsupported bounded writing intent without inventing context', async () => {
    const nullSource = planFixture()
    nullSource.focuses[0].actions[0].source = null
    api.current.mockResolvedValueOnce(nullSource)
    await expect(resolveJournalPlanOrigin(origin)).rejects.toThrow(
      'JOURNAL_PLAN_ORIGIN_UNAVAILABLE',
    )
    for (const patch of [
      { sourceId: 'unsupported-writing-intent' },
      { sourceRevision: '2' },
      { sourcePolicyVersion: 'unsupported-writing-policy' },
    ]) {
      const plan = planFixture()
      Object.assign(plan.focuses[0].actions[0].source!, patch)
      api.current.mockResolvedValueOnce(plan)
      await expect(resolveJournalPlanOrigin(origin)).rejects.toThrow(
        'JOURNAL_PLAN_ORIGIN_UNAVAILABLE',
      )
    }
  })

  it('rejects inactive or unactivated scheduled context rather than granting a new writing handoff', async () => {
    for (const status of ['PAUSED', 'COMPLETED', 'SUPERSEDED'] as const) {
      api.current.mockResolvedValueOnce({ ...planFixture(), status })
      await expect(resolveJournalPlanOrigin(origin)).rejects.toThrow()
    }
    const unactivatedPlan = planFixture()
    unactivatedPlan.activatedAt = null
    api.current.mockResolvedValueOnce(unactivatedPlan)
    await expect(resolveJournalPlanOrigin(origin)).rejects.toThrow()
    for (const patch of [
      { status: 'ENDED' as const },
      { status: 'DRAFT' as const },
      { activatedAt: null },
    ]) {
      const plan = planFixture()
      Object.assign(plan.focuses[0].actions[0], patch)
      api.current.mockResolvedValueOnce(plan)
      await expect(resolveJournalPlanOrigin(origin)).rejects.toThrow()
    }
  })

  it('resolves accepted completed history on ended/inactive context without granting new writing', async () => {
    const plan = planFixture()
    plan.status = 'PAUSED'
    const action = plan.focuses[0].actions[0]
    action.status = 'ENDED'
    action.actionVersion = 2
    action.endedAt = '2026-10-14T01:00:00Z'
    action.schedules[0].status = 'ENDED'
    const completed: ActionOccurrence = {
      ...occurrenceFixture(),
      state: 'COMPLETED',
      displayState: 'COMPLETED',
      version: 1,
      completionEvidence: {
        kind: 'JOURNAL_ENTRY',
        ownerDomain: 'JOURNAL_AI',
        factId: journalId,
        factRevision: '1',
        occurredAt: '2026-10-13T13:00:00Z',
        verifiedAt: '2026-10-13T13:01:00Z',
      },
      outcomeRecordedAt: '2026-10-13T13:01:00Z',
    }
    api.current.mockResolvedValueOnce(plan)
    api.occurrences.mockResolvedValueOnce(windowFixture(completed))
    const resolved = await resolveJournalPlanOrigin({ ...origin, journalId })
    expect(resolved).toMatchObject({
      planStatus: 'PAUSED',
      actionStatus: 'ENDED',
      canOpenWriting: false,
      occurrence: { state: 'COMPLETED', actionVersion: 1 },
    })
    expect(resolved.occurrence.completionEvidence).toEqual(
      completed.completionEvidence,
    )
  })

  it('never trusts query timezone/private extensions and refuses invalid owner timezone', async () => {
    const resolved = await resolveJournalPlanOrigin({
      ...origin,
      timezone: 'UTC',
      text: 'private',
    } as JournalPlanOrigin)
    expect(resolved.timezone).toBe('Asia/Ho_Chi_Minh')
    expect(resolved).not.toHaveProperty('text')
    const plan = planFixture()
    plan.focuses[0].actions[0].schedules[0].timezone = 'not/a-timezone'
    api.current.mockResolvedValueOnce(plan)
    await expect(resolveJournalPlanOrigin(origin)).rejects.toThrow(
      'JOURNAL_PLAN_ORIGIN_UNAVAILABLE',
    )
  })

  it('preserves dependency errors instead of describing an unavailable owner as missing context', async () => {
    const outage = new Error('Controlled owner unavailable')
    api.current.mockRejectedValueOnce(outage)
    await expect(resolveJournalPlanOrigin(origin)).rejects.toBe(outage)
    api.occurrences.mockRejectedValueOnce(outage)
    await expect(resolveJournalPlanOrigin(origin)).rejects.toBe(outage)
  })
})
