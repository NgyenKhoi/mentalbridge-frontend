import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  hasContentCompletion,
  resolveResourcePlanOrigin,
} from './resource-plan-origin'

const resourceId = '70000000-0000-4000-8000-000000000670'
const occurrence = {
  ...emotionOccurrenceFixture(),
  actionType: 'RESOURCE' as const,
}
const origin = {
  occurrenceId: occurrence.occurrenceId,
  actionId: occurrence.actionId,
  localDate: occurrence.localDate,
}
const now = new Date('2026-10-13T05:00:00Z')

function planFixture() {
  const plan = nativeSupportPlanFixture()
  const action = plan.focuses[0].actions[0]
  action.actionType = 'RESOURCE'
  action.source = {
    ...action.source!,
    ownerDomain: 'CONTENT',
    sourceKind: 'RESOURCE_VERSION',
    sourceId: resourceId,
    sourceRevision: '4',
  }
  return plan
}

describe('Resource plan completion context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const plan = planFixture()
    api.current.mockResolvedValue(plan)
    api.occurrences.mockResolvedValue({
      supportPlanId: plan.supportPlanId,
      representationMode: 'NATIVE_V3',
      occurrences: [occurrence],
    })
  })

  it('resolves only the owned matching RESOURCE, pinned version and occurrence', async () => {
    await expect(
      resolveResourcePlanOrigin(origin, resourceId, '4', now),
    ).resolves.toEqual(occurrence)
    await expect(
      resolveResourcePlanOrigin(origin, resourceId, '5', now),
    ).resolves.toBeNull()
    await expect(
      resolveResourcePlanOrigin(
        { ...origin, actionId: resourceId },
        resourceId,
        '4',
        now,
      ),
    ).resolves.toBeNull()
    api.occurrences.mockResolvedValueOnce({
      supportPlanId: resourceId,
      representationMode: 'NATIVE_V3',
      occurrences: [occurrence],
    })
    await expect(
      resolveResourcePlanOrigin(origin, resourceId, '4', now),
    ).resolves.toBeNull()
  })

  it('uses the frozen schedule date instead of the browser or plan cycle date', async () => {
    // 01:00 the next day in the schedule timezone, while UTC is still the 13th.
    await expect(
      resolveResourcePlanOrigin(
        origin,
        resourceId,
        '4',
        new Date('2026-10-13T18:00:00Z'),
      ),
    ).resolves.toBeNull()
    const plan = planFixture()
    plan.cycle = {
      policyVersion: 'support-plan-cycle-v1',
      lengthDays: 14,
      timezone: 'Asia/Ho_Chi_Minh',
      cycleNumber: 1,
      startedOn: '2026-10-13',
      reviewDueOn: '2026-10-26',
      currentDay: 1,
      pausedDays: 0,
      state: 'IN_PROGRESS',
    }
    plan.focuses[0].actions[0].schedules[0].timezone = 'America/Los_Angeles'
    api.current.mockResolvedValue(plan)
    await expect(
      resolveResourcePlanOrigin(
        origin,
        resourceId,
        '4',
        new Date('2026-10-14T02:00:00Z'),
      ),
    ).resolves.toEqual(occurrence)
    // The same instant is already the 14th for the plan cycle and a second schedule.
    const action = plan.focuses[0].actions[0]
    const otherSchedule = {
      ...action.schedules[0],
      scheduleId: '40000000-0000-4000-8000-000000000670',
      timezone: 'Asia/Ho_Chi_Minh',
    }
    action.schedules.push(otherSchedule)
    api.occurrences.mockResolvedValueOnce({
      supportPlanId: plan.supportPlanId,
      representationMode: 'NATIVE_V3',
      occurrences: [{ ...occurrence, scheduleId: otherSchedule.scheduleId }],
    })
    await expect(
      resolveResourcePlanOrigin(
        origin,
        resourceId,
        '4',
        new Date('2026-10-14T02:00:00Z'),
      ),
    ).resolves.toBeNull()
  })

  it('does not offer reconciliation for paused plans, adapters, ended actions or the wrong frozen schedule', async () => {
    const plan = planFixture()
    api.current.mockResolvedValueOnce({ ...plan, status: 'PAUSED' })
    await expect(
      resolveResourcePlanOrigin(origin, resourceId, '4', now),
    ).resolves.toBeNull()
    api.current.mockResolvedValueOnce({
      ...plan,
      representationMode: 'V2_RESOURCE_ADAPTER',
    })
    await expect(
      resolveResourcePlanOrigin(origin, resourceId, '4', now),
    ).resolves.toBeNull()
    plan.focuses[0].actions[0].status = 'ENDED'
    api.current.mockResolvedValueOnce(plan)
    await expect(
      resolveResourcePlanOrigin(origin, resourceId, '4', now),
    ).resolves.toBeNull()
    api.current.mockResolvedValue(planFixture())
    api.occurrences.mockResolvedValueOnce({
      supportPlanId: plan.supportPlanId,
      representationMode: 'NATIVE_V3',
      occurrences: [{ ...occurrence, scheduleVersion: 999 }],
    })
    await expect(
      resolveResourcePlanOrigin(origin, resourceId, '4', now),
    ).resolves.toBeNull()
  })

  it('recognizes completion only from completed RESOURCE occurrences with accepted Content evidence', () => {
    const completed = {
      ...occurrence,
      state: 'COMPLETED' as const,
      completionEvidence: {
        kind: 'RESOURCE_COMPLETION' as const,
        ownerDomain: 'CONTENT' as const,
        factId: `${resourceId}:${origin.localDate}`,
        factRevision: '4',
        occurredAt: now.toISOString(),
        verifiedAt: now.toISOString(),
      },
    }
    expect(hasContentCompletion(completed)).toBe(true)
    expect(
      hasContentCompletion({
        ...completed,
        completionEvidence: {
          ...completed.completionEvidence,
          kind: 'RESOURCE_PRACTICE_SESSION',
        },
      }),
    ).toBe(true)
    expect(hasContentCompletion({ ...completed, state: 'SCHEDULED' })).toBe(
      false,
    )
    expect(
      hasContentCompletion({ ...completed, completionEvidence: null }),
    ).toBe(false)
    expect(
      hasContentCompletion({
        ...completed,
        completionEvidence: {
          ...completed.completionEvidence,
          kind: 'USER_ACKNOWLEDGEMENT',
          ownerDomain: 'CARE',
        },
      }),
    ).toBe(false)
  })
})
