import { describe, expect, it } from 'vitest'
import { emotionOccurrenceFixture } from '@/features/support-plan/testing/native-support-plan-fixture'
import {
  parseActionOccurrence,
  parsePlanResourceActions,
} from './support-plan-action-validation'

const action = {
  actionId: '20000000-0000-4000-8000-000000000670',
  actionVersion: 0,
  title: 'Thở chậm',
  resource: {
    resourceId: '30000000-0000-4000-8000-000000000670',
    resourceVersion: '7',
    publicationId: '40000000-0000-4000-8000-000000000670',
  },
  schedule: null,
  today: null,
}
const projection = {
  planState: 'ACTIVE',
  supportPlanId: '10000000-0000-4000-8000-000000000670',
  supportPlanVersion: 1,
  representationMode: 'NATIVE_V3',
  timeZone: 'Asia/Ho_Chi_Minh',
  localDate: '2026-10-21',
  actions: [action],
}
const evidence = {
  kind: 'RESOURCE_PRACTICE_SESSION',
  ownerDomain: 'CONTENT',
  factId: '50000000-0000-4000-8000-000000000670',
  factRevision: '7',
  occurredAt: '2026-10-21T02:00:00Z',
  verifiedAt: '2026-10-21T02:01:00Z',
}

describe('MB-670 minimized plan resource boundary', () => {
  it.each(['ACTIVE', 'PAUSED'])(
    'accepts %s actions and adapter actions without occurrences',
    (planState) => {
      expect(
        parsePlanResourceActions({ ...projection, planState }),
      ).not.toBeNull()
      expect(
        parsePlanResourceActions({
          ...projection,
          planState,
          representationMode: 'V2_RESOURCE_ADAPTER',
        }),
      ).not.toBeNull()
    },
  )
  it('accepts no current plan without inferring one', () => {
    expect(
      parsePlanResourceActions({
        planState: 'NONE',
        localDate: '2026-10-21',
        actions: [],
      }),
    ).not.toBeNull()
    expect(
      parsePlanResourceActions({ ...projection, planState: 'NONE' }),
    ).toBeNull()
  })
  it('accepts journey fields only for ACTIVE or PAUSED and validates them', () => {
    const journey = {
      targetDomains: ['DEPRESSIVE_SYMPTOMS', 'ANXIETY_SYMPTOMS'],
      activatedAt: '2026-10-01T00:00:00Z',
    }
    for (const planState of ['ACTIVE', 'PAUSED'])
      expect(
        parsePlanResourceActions({ ...projection, planState, ...journey }),
      ).toMatchObject(journey)
    for (const bad of [
      { targetDomains: ['STRESS'] },
      { targetDomains: [] },
      { targetDomains: ['ANXIETY_SYMPTOMS', 'ANXIETY_SYMPTOMS'] },
      { targetDomains: 'ANXIETY_SYMPTOMS' },
      { activatedAt: 'yesterday' },
      { activatedAt: null },
    ])
      expect(
        parsePlanResourceActions({ ...projection, ...journey, ...bad }),
      ).toBeNull()
    for (const extra of [
      { targetDomains: ['ANXIETY_SYMPTOMS'] },
      { activatedAt: '2026-10-01T00:00:00Z' },
    ])
      expect(
        parsePlanResourceActions({
          planState: 'NONE',
          localDate: '2026-10-21',
          actions: [],
          ...extra,
        }),
      ).toBeNull()
  })
  it('preserves an occurrence zone separately from the plan week zone', () => {
    const today = {
      occurrenceId: '50000000-0000-4000-8000-000000000670',
      occurrenceVersion: 0,
      displayState: 'SCHEDULED',
      completionEvidence: null,
      timeZone: 'America/Los_Angeles',
    }
    expect(
      parsePlanResourceActions({
        ...projection,
        actions: [{ ...action, today }],
      })?.actions[0].today?.timeZone,
    ).toBe('America/Los_Angeles')
    expect(
      parsePlanResourceActions({
        ...projection,
        actions: [{ ...action, today: { ...today, timeZone: '' } }],
      }),
    ).toBeNull()
  })
  it('rejects rationale and unknown cross-owner payloads', () => {
    expect(
      parsePlanResourceActions({
        ...projection,
        actions: [{ ...action, rationale: 'private' }],
      }),
    ).toBeNull()
    expect(
      parsePlanResourceActions({
        ...projection,
        actions: [
          { ...action, resource: { ...action.resource, body: 'payload' } },
        ],
      }),
    ).toBeNull()
  })
  it('validates Content evidence and rejects fabricated attribution', () => {
    const completed = {
      ...emotionOccurrenceFixture(),
      actionType: 'RESOURCE',
      state: 'COMPLETED',
      displayState: 'COMPLETED',
      completionEvidence: evidence,
      outcomeRecordedAt: evidence.verifiedAt,
    }
    expect(parseActionOccurrence(completed)).not.toBeNull()
    expect(
      parseActionOccurrence({
        ...completed,
        completionEvidence: { ...evidence, kind: 'RESOURCE_COMPLETION' },
      }),
    ).not.toBeNull()
    expect(
      parseActionOccurrence({
        ...completed,
        completionEvidence: { ...evidence, ownerDomain: 'CARE' },
      }),
    ).toBeNull()
    expect(
      parseActionOccurrence({ ...completed, actionType: 'JOURNAL' }),
    ).toBeNull()
  })
})
