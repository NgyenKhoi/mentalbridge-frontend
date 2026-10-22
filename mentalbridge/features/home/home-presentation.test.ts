import { describe, expect, it } from 'vitest'
import {
  homeGreeting,
  homeIllustration,
  homeJourneyTrail,
} from './home-presentation'
import {
  homeFirstUseFixture,
  homeJourneyFixture,
  homeNextStepFixture,
  homePlanFixture,
} from './testing/home-next-step-fixture'

describe('homeGreeting', () => {
  it.each([
    [0, 'Chào buổi tối'],
    [4, 'Chào buổi tối'],
    [5, 'Chào buổi sáng'],
    [11, 'Chào buổi sáng'],
    [12, 'Chào buổi chiều'],
    [17, 'Chào buổi chiều'],
    [18, 'Chào buổi tối'],
    [23, 'Chào buổi tối'],
  ])('greets local hour %i with %s', (hour, expected) => {
    expect(homeGreeting(hour)).toBe(expected)
  })
})

describe('homeJourneyTrail', () => {
  it.each([
    ['ASSESSMENT_REQUIRED', ['current', 'upcoming', 'upcoming']],
    ['GUIDE_REQUIRED', ['done', 'current', 'upcoming']],
  ] as const)(
    'keeps %s as the current trail step even with a plan',
    (stage, statuses) => {
      const home = homeNextStepFixture({
        journey: homeJourneyFixture({ stage, supportGuideId: null }),
        plan: homePlanFixture('DO_TODAY'),
      })
      expect(homeJourneyTrail(home).map((step) => step.status)).toEqual(
        statuses,
      )
    },
  )

  it('starts from the authoritative assessment stage even when a plan exists', () => {
    const home = homeFirstUseFixture()
    home.plan = homePlanFixture('DO_TODAY')
    expect(homeJourneyTrail(home).map((step) => step.status)).toEqual([
      'current',
      'upcoming',
      'upcoming',
    ])
  })

  it.each(['GUIDE_REQUIRED', 'GUIDE_READY'] as const)(
    'places %s at the Guide until a plan/draft exists',
    (stage) => {
      const home = homeNextStepFixture({
        journey: homeJourneyFixture({ stage }),
      })
      expect(homeJourneyTrail(home).map((step) => step.status)).toEqual([
        'done',
        'current',
        'upcoming',
      ])
    },
  )

  it('marks an authoritative draft as the plan step without inventing a day', () => {
    const trail = homeJourneyTrail(
      homeNextStepFixture({
        journey: homeJourneyFixture({ nextAction: 'REVIEW_PLAN_DRAFT' }),
      }),
    )
    expect(trail.map((step) => step.status)).toEqual([
      'done',
      'done',
      'current',
    ])
    expect(trail[2].label).toBe('Kế hoạch (nếu phù hợp)')
  })

  it('shows the plan cycle day only when supplied by the contract', () => {
    expect(
      homeJourneyTrail(
        homeNextStepFixture({ plan: homePlanFixture('DO_TODAY') }),
      )[2],
    ).toEqual({ label: 'Kế hoạch · ngày 6', status: 'current' })
    expect(
      homeJourneyTrail(
        homeNextStepFixture({
          plan: homePlanFixture('NOTHING_TODAY', {
            cycleDay: null,
            cycleLengthDays: null,
          }),
        }),
      )[2].label,
    ).toBe('Kế hoạch')
  })
})

describe('homeIllustration', () => {
  it.each([
    ['ASSESSMENT_REQUIRED', 'questionnaire'],
    ['GUIDE_REQUIRED', 'book'],
  ] as const)(
    'uses the required %s illustration before an existing plan task',
    (stage, expected) => {
      const home = homeNextStepFixture({
        journey: homeJourneyFixture({ stage, supportGuideId: null }),
        plan: homePlanFixture('DO_TODAY'),
      })
      expect(homeIllustration(home, 'BREATHING')).toBe(expected)
    },
  )

  it.each([
    ['JOURNAL', 'journal'],
    ['EMOTION_CHECK_IN', 'face'],
    ['PROFESSIONAL_SUPPORT', 'person'],
    ['REASSESSMENT_SCREENING', 'questionnaire'],
  ] as const)('matches %s to its task illustration', (actionType, expected) => {
    const value = homePlanFixture('DO_TODAY')
    value.nextOccurrence = { ...value.nextOccurrence!, actionType }
    expect(homeIllustration(homeNextStepFixture({ plan: value }))).toBe(
      expected,
    )
  })
  it.each([
    ['BREATHING', 'breath'],
    ['ARTICLE', 'book'],
    ['JOURNALING', 'journal'],
    ['MEDITATION', 'leaf'],
  ] as const)(
    'uses the Content category %s for resource art',
    (category, expected) => {
      expect(
        homeIllustration(
          homeNextStepFixture({ plan: homePlanFixture('DO_TODAY') }),
          category,
        ),
      ).toBe(expected)
    },
  )
  it('keeps safety still and unillustrated even when a plan exists', () => {
    expect(
      homeIllustration(
        homeNextStepFixture({
          journey: homeJourneyFixture({ nextAction: 'REVIEW_SAFETY_SUPPORT' }),
          plan: homePlanFixture('DO_TODAY'),
        }),
      ),
    ).toBeNull()
  })

  it('uses a questionnaire for the initial check and a book for Guide resources', () => {
    expect(homeIllustration(homeFirstUseFixture())).toBe('questionnaire')
    expect(homeIllustration(homeNextStepFixture())).toBe('book')
  })

  it.each([
    ['RESUME_PAUSED', 'pause'],
    ['REVIEW_DUE', 'path'],
    ['TODAY_DONE', 'done'],
    ['NOTHING_TODAY', 'path'],
    ['DO_TODAY', 'leaf'],
  ] as const)('uses %s plan illustration %s', (focus, expected) => {
    expect(
      homeIllustration(homeNextStepFixture({ plan: homePlanFixture(focus) })),
    ).toBe(expected)
  })

  it('uses journal art for writing and preserves a higher-priority specialist action', () => {
    const plan = homePlanFixture('DO_TODAY')
    expect(plan.nextOccurrence).not.toBeNull()
    const home = homeNextStepFixture({
      plan: {
        ...plan,
        nextOccurrence: { ...plan.nextOccurrence!, actionType: 'JOURNAL' },
      },
    })
    expect(homeIllustration(home)).toBe('journal')
    home.journey = homeJourneyFixture({ nextAction: 'FIND_SPECIALIST' })
    expect(homeIllustration(home)).toBe('person')
  })
})
