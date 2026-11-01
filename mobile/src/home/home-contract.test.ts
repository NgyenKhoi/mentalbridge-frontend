import { homeNextStepSchema } from './home-contract'
import {
  activePlanHome,
  firstUseHome,
  freeGuideHome,
  pausedPlanHome,
  priorityPlanHome,
} from './home-test-fixtures'

describe('Home next-step contract', () => {
  it.each([firstUseHome, freeGuideHome, activePlanHome(), pausedPlanHome])(
    'accepts an authoritative Home state',
    (home) => expect(homeNextStepSchema.parse(home)).toEqual(home),
  )

  it.each(['REVIEW_SAFETY_SUPPORT', 'FIND_SPECIALIST'] as const)(
    'accepts an owner plan alongside priority journey action %s',
    (nextAction) => {
      const home = priorityPlanHome(nextAction)
      expect(homeNextStepSchema.parse(home)).toEqual(home)
    },
  )

  it('rejects invented fields and inconsistent plan context', () => {
    expect(() =>
      homeNextStepSchema.parse({ ...firstUseHome, recommendationScore: 91 }),
    ).toThrow()
    expect(() =>
      homeNextStepSchema.parse({
        ...activePlanHome(),
        journey: {
          ...activePlanHome().journey,
          currentSupportPlanId: '80000000-0000-4000-8000-000000000101',
        },
      }),
    ).toThrow()
  })

  it('rejects client-inconsistent occurrence and progress states', () => {
    expect(() =>
      homeNextStepSchema.parse({
        ...activePlanHome(),
        plan: { ...activePlanHome().plan, nextOccurrence: null },
      }),
    ).toThrow()
    expect(() =>
      homeNextStepSchema.parse({
        ...activePlanHome(),
        plan: {
          ...activePlanHome().plan,
          today: { total: 1, completed: 2 },
        },
      }),
    ).toThrow()
  })
})
