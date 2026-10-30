import {
  parseHomePlanOrigin,
  resolveLegacyHomePlanOrigin,
  resolveNativeHomePlanOrigin,
  type HomePlanOrigin,
} from './home-plan-context'
import {
  nativeIds,
  nativeOccurrence,
  nativePlan,
} from './native-plan-test-fixtures'
import type { SupportPlanActions } from './support-plan-contract'
import { makeOccurrenceList, makePlan } from './support-plan-test-fixtures'

const nativeOrigin: HomePlanOrigin = {
  source: 'home',
  occurrenceId: nativeIds.occurrence,
  actionId: nativeIds.action,
  actionType: 'RESOURCE',
  localDate: '2026-10-13',
}

function nativeResourceContext(
  actionType: HomePlanOrigin['actionType'] = 'RESOURCE',
) {
  const plan = nativePlan()
  const action = plan.focuses[0]!.actions[0]!
  action.actionType = actionType
  action.source =
    actionType === 'RESOURCE'
      ? {
          ownerDomain: 'CONTENT',
          sourceKind: 'RESOURCE_VERSION',
          sourceId: '70000000-0000-4000-8000-000000000641',
          sourceRevision: '1',
          sourcePolicyVersion: 'content-publication-v1',
          publicationId: '80000000-0000-4000-8000-000000000641',
          eligibilityPolicyVersion: 'content-eligibility-v1',
          verifiedAt: '2026-10-13T01:00:00Z',
        }
      : null
  const occurrence = nativeOccurrence({ actionType })
  return {
    plan,
    occurrence,
    list: {
      supportPlanId: plan.supportPlanId,
      supportPlanStatus: plan.status as 'ACTIVE',
      representationMode: 'NATIVE_V3' as const,
      from: occurrence.localDate,
      through: occurrence.localDate,
      occurrences: [occurrence],
      interpretationCode:
        'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE' as const,
    },
  }
}

function legacyActions(): SupportPlanActions {
  const plan = makePlan()
  return {
    supportPlanId: plan.supportPlanId,
    modelVersion: 3,
    planPolicyVersion: 'mb-support-plan-selection-v1',
    representationMode: 'V2_RESOURCE_ADAPTER',
    status: 'ACTIVE',
    version: plan.version,
    updatedAt: plan.updatedAt,
    focuses: [
      {
        focusId: 'resources',
        title: 'Tài nguyên',
        rationale: null,
        personalizationProvenance: null,
        actions: [
          {
            actionId: 'breathing-core',
            actionType: 'RESOURCE',
            actionVersion: 1,
            representationMode: 'V2_RESOURCE_ADAPTER',
            status: 'ACTIVE',
            pathRole: 'PRIMARY',
            purposeCode: 'GROUNDING',
            rationale: null,
            ordinal: 1,
            presentation: {
              title: 'Thở chậm trong 3 phút',
              summary: 'Một bài thở ngắn.',
            },
            schedules: [],
          },
        ],
      },
    ],
  }
}

describe('Home plan entry origin', () => {
  it('parses the closed discriminator and accepts a supported non-UUID v2 action identity', () => {
    expect(
      parseHomePlanOrigin({
        source: 'home',
        occurrenceId: nativeIds.occurrence,
        actionId: 'breathing-core',
        actionType: 'RESOURCE',
        localDate: '2026-10-13',
      }),
    ).toEqual({
      state: 'valid',
      value: {
        source: 'home',
        occurrenceId: nativeIds.occurrence,
        actionId: 'breathing-core',
        actionType: 'RESOURCE',
        localDate: '2026-10-13',
      },
    })
    expect(
      parseHomePlanOrigin({
        source: 'home',
        occurrenceId: nativeIds.occurrence,
        actionId: nativeIds.action,
        actionType: 'EMOTION_CHECK_IN',
        localDate: '2026-10-13',
      }),
    ).toEqual({ state: 'invalid' })
  })

  it.each([
    'RESOURCE',
    'ROUTINE_SELF_MANAGEMENT',
    'SELF_REPORT_REVIEW',
  ] as const)(
    'resolves exact native owner action and occurrence for %s',
    (actionType) => {
      const context = nativeResourceContext(actionType)
      expect(
        resolveNativeHomePlanOrigin(context.plan, context.list, {
          ...nativeOrigin,
          actionType,
        }),
      ).toEqual(context.occurrence)
    },
  )

  it('resolves a v2 Resource slot against the owner plan projection and occurrence', () => {
    const plan = makePlan()
    const list = makeOccurrenceList()
    expect(
      resolveLegacyHomePlanOrigin(plan, legacyActions(), list, {
        source: 'home',
        occurrenceId: list.occurrences[0]!.occurrenceId,
        actionId: 'breathing-core',
        actionType: 'RESOURCE',
        localDate: list.occurrences[0]!.localDate,
      }),
    ).toEqual(list.occurrences[0])
  })

  it('fails closed when the owner occurrence no longer matches the Home identity', () => {
    const context = nativeResourceContext()
    expect(
      resolveNativeHomePlanOrigin(context.plan, context.list, {
        ...nativeOrigin,
        actionId: 'different-action',
      }),
    ).toBeNull()
  })
})
