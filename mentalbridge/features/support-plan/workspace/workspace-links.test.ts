import { describe, expect, it } from 'vitest'
import type { PlanAction } from '../api/support-plan-contract'
import {
  emotionOccurrenceFixture,
  nativeSupportPlanFixture,
} from '../testing/native-support-plan-fixture'
import { actionDestination } from './workspace-links'
import { rowCapability } from './workspace-model'

const plan = nativeSupportPlanFixture()
const emotion = plan.focuses[0].actions[0]
const occurrence = emotionOccurrenceFixture()

function action(overrides: Partial<PlanAction>): PlanAction {
  return { ...emotion, ...overrides } as PlanAction
}

describe('workspace destinations', () => {
  it('sends an open emotion activity to the check-in with its exact origin', () => {
    expect(
      actionDestination(plan, { occurrence, action: emotion }, '2026-10-13'),
    ).toEqual({
      href: `/dashboard?occurrenceId=${occurrence.occurrenceId}&actionId=${emotion.actionId}&localDate=2026-10-13#emotion-check-in`,
      label: 'Ghi lại cảm xúc',
    })
  })

  it('offers no destination for a paused plan or a skipped emotion activity', () => {
    expect(
      actionDestination(
        { ...plan, status: 'PAUSED' },
        { occurrence, action: emotion },
        '2026-10-13',
      ),
    ).toBeUndefined()
    expect(
      actionDestination(
        plan,
        { occurrence: { ...occurrence, state: 'SKIPPED' }, action: emotion },
        '2026-10-13',
      ),
    ).toBeUndefined()
  })

  it('opens writing only for the reviewed journal intention on its own day', () => {
    const journal = action({
      actionType: 'JOURNAL',
      source: {
        ownerDomain: 'JOURNAL_AI',
        sourceKind: 'JOURNAL_TEMPLATE',
        sourceId: 'short-reflection',
        sourceRevision: '1',
        sourcePolicyVersion: 'journal-writing-intent-v1',
        publicationId: null,
        eligibilityPolicyVersion: null,
        verifiedAt: '2026-10-13T05:00:00Z',
      },
    })
    const item = {
      occurrence: { ...occurrence, actionType: 'JOURNAL' as const },
      action: journal,
    }
    expect(actionDestination(plan, item, '2026-10-13')?.href).toMatch(
      /^\/journal\?source=journal&/,
    )
    expect(actionDestination(plan, item, '2026-10-14')).toBeUndefined()
  })

  it('carries the resource version and occurrence back from Resources', () => {
    const resource = action({
      actionType: 'RESOURCE',
      source: {
        ownerDomain: 'CONTENT',
        sourceKind: 'RESOURCE_VERSION',
        sourceId: 'b0000000-0000-4000-8000-000000000669',
        sourceRevision: '4',
        sourcePolicyVersion: null,
        publicationId: null,
        eligibilityPolicyVersion: null,
        verifiedAt: '2026-10-13T05:00:00Z',
      },
    })
    const destination = actionDestination(
      plan,
      {
        occurrence: { ...occurrence, actionType: 'RESOURCE' },
        action: resource,
      },
      '2026-10-13',
    )
    const url = new URL(destination?.href ?? '', 'http://localhost')
    expect(url.pathname).toBe('/resources/b0000000-0000-4000-8000-000000000669')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      from: 'support-plan',
      contentVersion: '4',
      occurrenceId: occurrence.occurrenceId,
      actionId: emotion.actionId,
      localDate: '2026-10-13',
    })
    expect(
      rowCapability(
        plan,
        {
          occurrence: { ...occurrence, actionType: 'RESOURCE' },
          action: resource,
        },
        true,
      ).complete,
    ).toBe(true)
  })

  it('never offers a manual done for emotion or journal activities', () => {
    expect(
      rowCapability(plan, { occurrence, action: emotion }, true).complete,
    ).toBe(false)
  })
})
