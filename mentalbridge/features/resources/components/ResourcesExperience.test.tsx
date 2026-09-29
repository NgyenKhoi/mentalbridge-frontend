import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ResourcesExperience from './ResourcesExperience'

const api = vi.hoisted(() => ({
  getResourceCatalogue: vi.fn(),
  getResourceProgress: vi.fn(),
  saveResourceProgress: vi.fn(),
  getResourceJourney: vi.fn(),
}))

vi.mock('../api/browser-resources', () => ({
  getResourceCatalogue: api.getResourceCatalogue,
}))
vi.mock('../api/browser-resource-progress', () => ({
  getResourceProgress: api.getResourceProgress,
  saveResourceProgress: api.saveResourceProgress,
}))
vi.mock('../api/browser-resource-journey', () => ({
  getResourceJourney: api.getResourceJourney,
  ResourceJourneyBrowserError: class ResourceJourneyBrowserError extends Error {
    constructor(readonly status: number) {
      super('Resource journey request failed')
    }
  },
}))

const resources = [
  {
    id: '00000000-0000-4000-8000-000000000201',
    category: 'ARTICLE' as const,
    locale: 'vi-VN',
    title: 'Một khoảng nghỉ cho tâm trí',
    summary: 'Đọc một vài gợi ý nhỏ để chậm lại.',
    status: 'PUBLISHED' as const,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000202',
    category: 'VIDEO' as const,
    locale: 'vi-VN',
    title: 'Video thở chậm',
    summary: 'Một video thực hành ngắn.',
    status: 'PUBLISHED' as const,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000203',
    category: 'BREATHING' as const,
    locale: 'vi-VN',
    title: 'Nhịp thở 4–4–6',
    summary: 'Thở theo nhịp dịu dàng.',
    status: 'PUBLISHED' as const,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
  {
    id: '00000000-0000-4000-8000-000000000204',
    category: 'JOURNALING' as const,
    locale: 'vi-VN',
    title: 'Ba dòng cho hôm nay',
    summary: 'Ghi lại điều đang hiện diện.',
    status: 'PUBLISHED' as const,
    createdAt: '2026-09-01T00:00:00.000Z',
  },
]

describe('ResourcesExperience', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date('2026-09-29T09:00:00+07:00'))
    sessionStorage.clear()
    vi.stubGlobal('scrollTo', vi.fn())
    api.getResourceCatalogue.mockResolvedValue({
      items: resources,
      hasMore: false,
    })
    api.getResourceProgress.mockResolvedValue([])
    api.getResourceJourney.mockImplementation(async (date: string) => ({
      assignmentId: '00000000-0000-4000-8000-000000000301',
      localDate: date,
      planId: '00000000-0000-4000-8000-000000000302',
      planVersion: 1,
      items: resources.map((resource, index) => ({
        position: index + 1,
        resource,
        reason: index === 0 ? 'PLAN_SELECTED' : 'BALANCE',
      })),
      progress: {
        dailyCompleted: 0,
        dailyTotal: resources.length,
        learningCompleted: 0,
        learningTotal: 2,
        practiceStreakDays: 0,
      },
      weekStart: '2026-09-28',
      bingo: resources.map((resource, index) => ({
        position: index + 1,
        resourceId: resource.id,
        label: resource.title,
        stamped: false,
      })),
    }))
    api.saveResourceProgress.mockImplementation(
      async (resourceId: string, localDate: string, update: object) => ({
        resourceId,
        localDate,
        contentVersion: '1',
        ...update,
        completedAt: '2026-09-29T02:00:00.000Z',
        updatedAt: '2026-09-29T02:00:00.000Z',
        version: '1',
      }),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('renders the daily journey, filters, bingo, and recent section', async () => {
    render(<ResourcesExperience />)

    expect(
      await screen.findByRole('heading', { name: /một chút bình yên/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: /chọn điều bạn cần/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: /bingo tuần này/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: /vừa hoàn thành/i }),
    ).toBeVisible()
    expect(screen.getAllByRole('checkbox')).toHaveLength(4)
    expect(screen.getByRole('button', { name: 'Nhẹ nhàng' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Video' })).toBeVisible()
  })

  it('persists a checked daily item and gives a small reward', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ResourcesExperience />)

    const challenge = await screen.findByRole('heading', {
      name: /một chút bình yên/i,
    })
    const section = challenge.closest('section')
    expect(section).not.toBeNull()
    const checkbox = within(section as HTMLElement).getAllByRole('checkbox')[0]
    await user.click(checkbox)

    expect(api.saveResourceProgress).toHaveBeenCalledWith(
      expect.any(String),
      '2026-09-29',
      {
        status: 'COMPLETED',
        completedActionIds: ['overview-complete'],
      },
    )
    expect(await screen.findByText(/một bước nhỏ đã hoàn thành/i)).toBeVisible()
  })
})
