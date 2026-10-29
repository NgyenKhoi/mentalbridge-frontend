import { homePresentation } from './home-model'
import {
  activePlanHome,
  firstUseHome,
  freeGuideHome,
  ids,
  pausedPlanHome,
} from './home-test-fixtures'

describe('Home presentation', () => {
  it('keeps first use and FREE guidance useful without a plan', () => {
    expect(homePresentation(firstUseHome)).toMatchObject({
      primaryLabel: 'Bắt đầu sàng lọc',
      primaryHref: '/(user)/assessment',
    })
    expect(homePresentation(freeGuideHome)).toMatchObject({
      primaryLabel: 'Khám phá tài nguyên',
      primaryHref: '/(user)/resources',
    })
    expect(
      homePresentation({
        ...freeGuideHome,
        lastCompletedPlan: {
          supportPlanId: ids.completedPlan,
          completedAt: '2026-10-28T03:00:00.000Z',
        },
      }).title,
    ).toBe('Kế hoạch gần nhất đã kết thúc')
  })

  it.each([
    ['REVIEW_SAFETY_SUPPORT', 'Xem hướng dẫn hỗ trợ', '/(user)/assessment'],
    ['FIND_SPECIALIST', 'Tìm chuyên gia', '/(user)/specialists'],
  ] as const)(
    'preserves server precedence for %s',
    (nextAction, primaryLabel, primaryHref) => {
      const home = {
        ...freeGuideHome,
        journey: {
          ...freeGuideHome.journey,
          nextAction,
          entitlementStatus: 'NOT_REQUIRED' as const,
        },
      }
      expect(homePresentation(home)).toMatchObject({
        primaryLabel,
        primaryHref,
      })
    },
  )

  it('routes proposal and draft review without activating either locally', () => {
    expect(
      homePresentation({
        ...freeGuideHome,
        journey: {
          ...freeGuideHome.journey,
          nextAction: 'START_PLAN_PROPOSAL',
          entitlementStatus: 'VERIFIED',
        },
      }),
    ).toMatchObject({
      primaryLabel: 'Xem lựa chọn kế hoạch',
      primaryHref: '/(user)/support-plan',
    })
    expect(
      homePresentation({
        ...freeGuideHome,
        journey: {
          ...freeGuideHome.journey,
          nextAction: 'REVIEW_PLAN_DRAFT',
          currentSupportPlanId: ids.plan,
          entitlementStatus: 'NOT_REQUIRED',
        },
      }),
    ).toMatchObject({
      primaryLabel: 'Xem kế hoạch đề xuất',
      primaryHref: '/(user)/support-plan',
    })
  })

  it.each([
    [pausedPlanHome, 'Xem và tiếp tục kế hoạch'],
    [
      {
        ...activePlanHome(),
        plan: {
          ...activePlanHome().plan!,
          focus: 'REVIEW_DUE' as const,
          nextOccurrence: null,
        },
      },
      'Xem lại kế hoạch',
    ],
    [
      {
        ...activePlanHome(),
        plan: {
          ...activePlanHome().plan!,
          focus: 'TODAY_DONE' as const,
          nextOccurrence: null,
        },
      },
      'Xem tiến độ hôm nay',
    ],
    [
      {
        ...activePlanHome(),
        plan: {
          ...activePlanHome().plan!,
          focus: 'NOTHING_TODAY' as const,
          nextOccurrence: null,
          today: { total: 0, completed: 0 },
        },
      },
      'Xem kế hoạch',
    ],
  ])(
    'uses the authoritative plan focus for a neutral plan state',
    (home, label) => {
      expect(homePresentation(home).primaryLabel).toBe(label)
    },
  )

  it.each([
    [
      'EMOTION_CHECK_IN',
      {
        pathname: '/(user)/emotion',
        params: { occurrenceId: ids.occurrence, actionId: ids.action },
      },
    ],
    [
      'PROFESSIONAL_SUPPORT',
      {
        pathname: '/(user)/specialists',
        params: { planActionId: ids.action },
      },
    ],
    ['REASSESSMENT_SCREENING', '/(user)/assessment'],
  ] as const)('deep-links supported %s actions', (actionType, expected) => {
    expect(homePresentation(activePlanHome(actionType)).primaryHref).toEqual(
      expected,
    )
  })
})
