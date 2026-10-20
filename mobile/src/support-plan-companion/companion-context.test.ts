import {
  mobileCompanionNavigation,
  nextStepCopy,
  selectMobileCompanionContext,
} from './companion-context'
import {
  nativeIds,
  nativeOccurrence,
  nativePlan,
} from '@/support-plan/native-plan-test-fixtures'

describe('mobile SupportPlan companion context', () => {
  it('selects an exact occurrence as TODAY context without private data', () => {
    const plan = nativePlan()
    const occurrence = nativeOccurrence()
    const context = selectMobileCompanionContext(plan, [occurrence])
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
    const context = selectMobileCompanionContext(plan, [occurrence])!
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
    const context = selectMobileCompanionContext(plan, [])!
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
      selectMobileCompanionContext(plan, [])!,
    )
    expect(navigation).toEqual({
      label: `Mở ${action.presentation.title}`,
      href: '/(user)/resources/[resourceId]',
      params: { resourceId: 'resource-slug' },
    })
  })
})
