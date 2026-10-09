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
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    )
    vi.spyOn(window.HTMLMediaElement.prototype, 'pause').mockImplementation(
      () => undefined,
    )
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
      planDay: 10,
      planStage: 'MAINTENANCE',
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
    vi.restoreAllMocks()
  })

  it('renders the daily journey, filters, bingo, and recent section', async () => {
    render(<ResourcesExperience />)

    expect(
      await screen.findByRole('heading', { name: /một chút bình yên/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: /kho tài nguyên/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: /bingo chăm sóc tuần này/i }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: /dấu ấn gần đây/i }),
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

  it('explains active filters and offers a direct way back to all activities', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ResourcesExperience />)

    await screen.findByRole('heading', { name: /kho tài nguyên/i })
    await user.click(screen.getByRole('button', { name: 'Thử thách' }))
    expect(screen.getByRole('status')).toHaveTextContent(
      '1 hoạt động để khám phá',
    )

    await user.click(screen.getByRole('button', { name: 'Video' }))
    expect(
      screen.getByRole('heading', { name: /chưa có hoạt động khớp bộ lọc/i }),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Tất cả' }))
    await user.click(screen.getByRole('button', { name: 'Mọi loại' }))
    expect(
      within(
        screen.getByRole('region', { name: 'Kho tài nguyên' }),
      ).getAllByRole('link', { name: /khám phá hoạt động:/i }),
    ).toHaveLength(4)
  })

  it('does not celebrate completion when the selected day has no activities', async () => {
    api.getResourceJourney.mockResolvedValueOnce({
      localDate: '2026-09-23',
      items: [],
      progress: { practiceStreakDays: 0 },
      bingo: [],
    })
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ResourcesExperience />)

    await screen.findByRole('heading', { name: /một chút bình yên/i })
    await user.click(
      within(
        screen.getByRole('complementary', {
          name: 'Nhịp chăm sóc của bạn',
        }),
      ).getAllByRole('button')[0],
    )

    expect(
      screen.getByText('Ngày này chưa có hoạt động được xếp lịch.'),
    ).toBeVisible()
    expect(
      screen.queryByText('Bạn đã dành trọn một khoảng nhỏ cho mình.'),
    ).toBeNull()
    expect(
      screen.getByRole('heading', { name: /kho tài nguyên/i }),
    ).toBeVisible()
  })
})
