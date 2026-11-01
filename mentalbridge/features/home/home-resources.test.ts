import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getResourceCatalogue,
  getResourceDetail,
} from '@/features/resources/api/browser-resources'
import { getSupportGuide } from '@/features/support-guide/api/browser-support-guide'
import { getCurrentPlanResourceActions } from '@/features/support-plan/api/browser-support-plan-actions'
import { homeResourceMeta, loadHomeResources } from './home-resources'
import {
  homeNextStepFixture,
  homePlanFixture,
} from './testing/home-next-step-fixture'
import {
  homeGuideFixture,
  homePlanResourcesFixture,
  homeResourceDetailFixture,
  homeResourceFixture,
} from './testing/home-secondary-fixtures'

vi.mock('@/features/resources/api/browser-resources', () => ({
  getResourceCatalogue: vi.fn(),
  getResourceDetail: vi.fn(),
}))
vi.mock('@/features/support-guide/api/browser-support-guide', () => ({
  getSupportGuide: vi.fn(),
}))
vi.mock('@/features/support-plan/api/browser-support-plan-actions', () => ({
  getCurrentPlanResourceActions: vi.fn(),
}))

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getCurrentPlanResourceActions).mockResolvedValue(
    homePlanResourcesFixture(),
  )
  vi.mocked(getSupportGuide).mockResolvedValue(homeGuideFixture())
  vi.mocked(getResourceCatalogue).mockResolvedValue({
    items: [homeResourceFixture()],
    hasMore: false,
  })
  vi.mocked(getResourceDetail).mockImplementation(async (id, version) =>
    homeResourceDetailFixture({
      id,
      contentVersion: version,
      title: `Nội dung ${id}`,
    }),
  )
})

describe('Home resource source selection', () => {
  it.each(['ACTIVE', 'PAUSED'] as const)(
    'uses %s plan resources before Guide and library, capped at three',
    async (status) => {
      vi.mocked(getCurrentPlanResourceActions).mockResolvedValue({
        ...homePlanResourcesFixture(4),
        planState: status,
      })
      const data = await loadHomeResources(
        homeNextStepFixture({ plan: homePlanFixture('DO_TODAY', { status }) }),
      )
      expect(data.source).toBe('plan')
      expect(data.items).toHaveLength(3)
      expect(getSupportGuide).not.toHaveBeenCalled()
      expect(getResourceCatalogue).not.toHaveBeenCalled()
      expect(getResourceDetail).toHaveBeenNthCalledWith(
        1,
        'resource-0',
        '7',
        undefined,
      )
      const href = new URL(data.items[0].href, 'https://mentalbridge.test')
      expect(href.searchParams.get('from')).toBe('support-plan')
      expect(href.searchParams.get('occurrenceId')).toBe('occurrence-0')
      expect(href.searchParams.get('contentVersion')).toBe('7')
      expect(href.searchParams.get('localDate')).toBe('2026-10-22')
      expect(data.items[0].title).toBe('Nội dung resource-0')
      expect(data.items[0].meta).toBe('Bài tập thở · 5 phút')
    },
  )

  it('keeps one plan resource without filling the row from other sources', async () => {
    vi.mocked(getCurrentPlanResourceActions).mockResolvedValue(
      homePlanResourcesFixture(1),
    )
    expect(
      (
        await loadHomeResources(
          homeNextStepFixture({ plan: homePlanFixture('DO_TODAY') }),
        )
      ).items,
    ).toHaveLength(1)
    expect(getSupportGuide).not.toHaveBeenCalled()
  })

  it('excludes the next-step resource before choosing three items from the same plan', async () => {
    vi.mocked(getCurrentPlanResourceActions).mockResolvedValue(
      homePlanResourcesFixture(4),
    )
    const plan = homePlanFixture('DO_TODAY')
    const data = await loadHomeResources(
      homeNextStepFixture({
        plan: {
          ...plan,
          nextOccurrence: {
            ...plan.nextOccurrence!,
            actionId: 'action-0',
            occurrenceId: 'occurrence-0',
          },
        },
      }),
    )
    expect(data.source).toBe('plan')
    expect(data.items.map((item) => item.id)).toEqual([
      'resource-1',
      'resource-2',
      'resource-3',
    ])
    expect(getResourceDetail).toHaveBeenCalledTimes(3)
    expect(getResourceDetail).not.toHaveBeenCalledWith(
      'resource-0',
      expect.anything(),
      expect.anything(),
    )
    const href = new URL(data.items[0].href, 'https://mentalbridge.test')
    expect(href.searchParams.get('from')).toBe('support-plan')
    expect(href.searchParams.get('actionId')).toBe('action-1')
    expect(href.searchParams.get('occurrenceId')).toBe('occurrence-1')
    expect(href.searchParams.get('contentVersion')).toBe('7')
    expect(href.searchParams.get('localDate')).toBe('2026-10-22')
    expect(data.items[0].meta).toBe('Bài tập thở · 5 phút')
    expect(getSupportGuide).not.toHaveBeenCalled()
    expect(getResourceCatalogue).not.toHaveBeenCalled()
  })

  it('excludes every action using the next-step resource without falling through to another source', async () => {
    const source = homePlanResourcesFixture(2)
    source.actions[1].resource.resourceId =
      source.actions[0].resource.resourceId
    vi.mocked(getCurrentPlanResourceActions).mockResolvedValue(source)
    const plan = homePlanFixture('DO_TODAY')
    const data = await loadHomeResources(
      homeNextStepFixture({
        plan: {
          ...plan,
          nextOccurrence: {
            ...plan.nextOccurrence!,
            actionId: source.actions[0].actionId,
          },
        },
      }),
    )
    expect(data).toEqual({ source: 'plan', items: [] })
    expect(getResourceDetail).not.toHaveBeenCalled()
    expect(getSupportGuide).not.toHaveBeenCalled()
    expect(getResourceCatalogue).not.toHaveBeenCalled()
  })

  it('uses occurrence identity for an action projection and keeps an unrelated item with the same title', async () => {
    const source = homePlanResourcesFixture(2)
    source.actions[1].title = source.actions[0].title
    vi.mocked(getCurrentPlanResourceActions).mockResolvedValue(source)
    const plan = homePlanFixture('DO_TODAY')
    const data = await loadHomeResources(
      homeNextStepFixture({
        plan: {
          ...plan,
          nextOccurrence: {
            ...plan.nextOccurrence!,
            occurrenceId: source.actions[0].today!.occurrenceId,
          },
        },
      }),
    )
    expect(data.items.map((item) => item.id)).toEqual(['resource-1'])
    expect(data.source).toBe('plan')
  })

  it('falls through an empty plan to the saved Guide and preserves its return path', async () => {
    vi.mocked(getCurrentPlanResourceActions).mockResolvedValue(
      homePlanResourcesFixture(0),
    )
    const data = await loadHomeResources(
      homeNextStepFixture({ plan: homePlanFixture('DO_TODAY') }),
    )
    expect(data.source).toBe('guide')
    expect(getResourceDetail).toHaveBeenCalledWith(
      'guide-resource',
      '3',
      undefined,
    )
    const href = new URL(data.items[0].href, 'https://mentalbridge.test')
    expect(href.searchParams.get('from')).toBe('support-guide')
    expect(href.searchParams.get('supportGuideId')).toBe(
      homeGuideFixture().supportGuideId,
    )
    expect(href.searchParams.get('contentVersion')).toBe('3')
    expect(getResourceCatalogue).not.toHaveBeenCalled()
  })

  it('uses library items when the Guide is empty, without claiming personalization', async () => {
    vi.mocked(getSupportGuide).mockResolvedValue(homeGuideFixture(false))
    vi.mocked(getResourceCatalogue).mockResolvedValue({
      items: Array.from({ length: 4 }, (_, index) =>
        homeResourceFixture({ id: `library-${index}` }),
      ),
      hasMore: false,
    })
    const data = await loadHomeResources(homeNextStepFixture())
    expect(data.source).toBe('library')
    expect(data.items).toHaveLength(3)
    expect(data.items[0].href).toBe('/resources/library-0')
    expect(getCurrentPlanResourceActions).not.toHaveBeenCalled()
    expect(getResourceDetail).not.toHaveBeenCalled()
  })

  it('keeps the library available when the next-step read is unavailable', async () => {
    expect((await loadHomeResources(null)).source).toBe('library')
    expect(getSupportGuide).not.toHaveBeenCalled()
  })

  it('surfaces Content failure for retry instead of silently replacing personalized items', async () => {
    vi.mocked(getResourceDetail).mockRejectedValue(new Error('503'))
    await expect(
      loadHomeResources(
        homeNextStepFixture({ plan: homePlanFixture('DO_TODAY') }),
      ),
    ).rejects.toThrow('503')
    expect(getSupportGuide).not.toHaveBeenCalled()
    expect(getResourceCatalogue).not.toHaveBeenCalled()
  })

  it('treats a catalogue unavailable response as a local error', async () => {
    vi.mocked(getResourceCatalogue).mockResolvedValue({
      items: [],
      hasMore: false,
      unavailable: true,
    })
    await expect(loadHomeResources(null)).rejects.toThrow(
      'Resource catalogue unavailable',
    )
  })
})

describe('Home resource metadata', () => {
  it.each([
    { category: 'ARTICLE' as const },
    { expectedDurationMinutes: 6 },
    { category: 'ARTICLE' as const, expectedDurationMinutes: 0 },
  ])('omits absent type or duration without inventing a value', (resource) => {
    expect(homeResourceMeta(resource)).toBeNull()
  })
  it('uses the duration actually supplied by Content', () => {
    expect(
      homeResourceMeta({ category: 'ARTICLE', expectedDurationMinutes: 11 }),
    ).toBe('Bài đọc · 11 phút')
  })
})
