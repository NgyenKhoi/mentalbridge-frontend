import {
  mobileCompanionNavigation,
  nextStepCopy,
  selectMobileCompanionContext,
} from './companion-context'
import {
  nativeIds,
  nativeOccurrence,
  nativePlan,
  reconciliation,
} from '@/support-plan/native-plan-test-fixtures'

const selection = { now: new Date('2026-10-13T12:00:00Z') }

describe('mobile SupportPlan companion context', () => {
  it('selects an exact occurrence as TODAY context without private data', () => {
    const plan = nativePlan()
    const occurrence = nativeOccurrence()
    const context = selectMobileCompanionContext(plan, [occurrence], selection)
    expect(context).toEqual({
      supportPlanId: nativeIds.plan,
      action: plan.focuses[0]?.actions[0],
      occurrence,
      surface: 'TODAY',
    })
    expect(Object.keys(context ?? {})).toEqual([
      'supportPlanId',
      'action',
      'occurrence',
      'surface',
    ])
  })

  it('preserves owner route parameters and never claims navigation completes work', () => {
    const plan = nativePlan()
    const occurrence = nativeOccurrence()
    const context = selectMobileCompanionContext(plan, [occurrence], selection)!
    expect(mobileCompanionNavigation(context)).toEqual({
      label: 'Mở Ghi nhận cảm xúc',
      href: '/(user)/emotion',
      params: {
        occurrenceId: occurrence.occurrenceId,
        actionId: occurrence.actionId,
      },
    })
    expect(nextStepCopy(context)).toContain('không tự hoàn thành')
  })

  it.each([
    ['JOURNAL', '/(user)/journal'],
    ['PROFESSIONAL_SUPPORT', '/(user)/specialists'],
    ['REASSESSMENT_SCREENING', '/(user)/assessment'],
  ] as const)('maps %s to its canonical owner route', (actionType, href) => {
    const plan = nativePlan()
    plan.focuses[0]!.actions[0]!.actionType = actionType
    const context = selectMobileCompanionContext(plan, [], selection)!
    expect(mobileCompanionNavigation(context)?.href).toBe(href)
  })

  it('opens an authoritative Content resource identity, not its external URL', () => {
    const plan = nativePlan()
    const action = plan.focuses[0]!.actions[0]!
    action.actionType = 'RESOURCE'
    action.source = {
      ownerDomain: 'CONTENT',
      sourceKind: 'RESOURCE_VERSION',
      sourceId: 'resource-slug',
      sourceRevision: '3',
      sourcePolicyVersion: null,
      publicationId: '90000000-0000-4000-8000-000000000654',
      eligibilityPolicyVersion: 'resource-eligibility-v1',
      verifiedAt: '2026-10-13T05:00:00Z',
    }
    action.presentation.externalUrl = 'https://outside.invalid/private'
    const navigation = mobileCompanionNavigation(
      selectMobileCompanionContext(plan, [], selection)!,
    )
    expect(navigation).toEqual({
      label: `Mở ${action.presentation.title}`,
      href: '/(user)/resources/[resourceId]',
      params: { resourceId: 'resource-slug' },
    })
  })

  it('selects only an eligible plan-local today occurrence regardless of input order', () => {
    const plan = nativePlan()
    const past = nativeOccurrence({
      occurrenceId: '30000000-0000-4000-8000-000000000642',
      localDate: '2026-10-12',
      scheduledAt: '2026-10-12T12:00:00Z',
    })
    const cancelled = nativeOccurrence({
      occurrenceId: '30000000-0000-4000-8000-000000000643',
      state: 'CANCELLED',
      displayState: 'CANCELLED',
      stateReason: 'SCHEDULE_CHANGED',
    })
    const future = nativeOccurrence({
      occurrenceId: '30000000-0000-4000-8000-000000000644',
      localDate: '2026-10-14',
      scheduledAt: '2026-10-14T12:00:00Z',
    })
    const today = nativeOccurrence()

    const context = selectMobileCompanionContext(
      plan,
      [future, cancelled, past, today],
      { now: new Date('2026-10-12T18:00:00Z') },
    )

    expect(context?.surface).toBe('TODAY')
    expect(context?.occurrence?.occurrenceId).toBe(nativeIds.occurrence)
  })

  it('preserves an eligible validated return origin ahead of schedule order', () => {
    const plan = nativePlan()
    const completed = reconciliation()
    const first = nativeOccurrence({
      occurrenceId: '30000000-0000-4000-8000-000000000642',
      scheduledAt: '2026-10-13T11:00:00Z',
    })
    const returned = nativeOccurrence({
      occurrenceId: '30000000-0000-4000-8000-000000000643',
      scheduledAt: '2026-10-13T13:00:00Z',
      state: 'COMPLETED',
      displayState: 'COMPLETED',
      version: completed.version,
      completionEvidence: completed.completionEvidence,
      outcomeRecordedAt: completed.completedAt,
    })

    const context = selectMobileCompanionContext(plan, [first, returned], {
      ...selection,
      preferredOccurrenceId: returned.occurrenceId,
    })

    expect(context?.occurrence?.occurrenceId).toBe(returned.occurrenceId)
  })

  it('falls back to grounded PLAN context when no occurrence is due and usable today', () => {
    const plan = nativePlan()
    const context = selectMobileCompanionContext(
      plan,
      [
        nativeOccurrence({ localDate: '2026-10-12' }),
        nativeOccurrence({
          occurrenceId: '30000000-0000-4000-8000-000000000642',
          state: 'SKIPPED',
          displayState: 'SKIPPED',
        }),
      ],
      selection,
    )

    expect(context).toMatchObject({
      action: plan.focuses[0]!.actions[0],
      surface: 'PLAN',
    })
    expect(context).not.toHaveProperty('occurrence')
  })

  it('never uses an ended action or a stale action/schedule version', () => {
    const plan = nativePlan()
    const ended = plan.focuses[0]!.actions[0]!
    ended.status = 'ENDED'
    ended.endedAt = '2026-10-13T11:00:00Z'
    const active = {
      ...ended,
      actionId: '20000000-0000-4000-8000-000000000642',
      actionVersion: 2,
      status: 'ACTIVE' as const,
      ordinal: 2,
      endedAt: null,
      schedules: [
        {
          ...ended.schedules[0]!,
          scheduleId: '40000000-0000-4000-8000-000000000642',
          version: 2,
        },
      ],
    }
    plan.focuses[0]!.actions.push(active)
    const stale = nativeOccurrence({
      actionId: active.actionId,
      actionVersion: 1,
      scheduleId: active.schedules[0]!.scheduleId,
      scheduleVersion: 1,
    })

    const context = selectMobileCompanionContext(plan, [stale], selection)

    expect(context?.action.actionId).toBe(active.actionId)
    expect(context?.surface).toBe('PLAN')
  })
})
