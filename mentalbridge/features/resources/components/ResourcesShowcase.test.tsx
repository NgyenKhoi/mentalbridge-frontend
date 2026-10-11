import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ResourceJourneyBrowserError } from '../api/browser-resource-journey'
import type { ResourceProgressItem } from '../api/browser-resource-progress'
import type { PublicResourceSummary } from '../api/browser-resources'
import ResourcesShowcase from './ResourcesShowcase'

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
      this.name = 'ResourceJourneyBrowserError'
    }
  },
}))

const resource: PublicResourceSummary = {
  id: '00000000-0000-4000-8000-000000000201',
  category: 'BREATHING',
  resourceKind: 'PRACTICE',
  interactionType: 'BREATHING_PACER',
  repeatability: 'REPEATABLE',
  completionMode: 'EXPLICIT',
  streakEligible: true,
  expectedDurationMinutes: 4,
  cooldownDays: 0,
  recommendedFrequencyPerWeek: 5,
  planTags: ['ANXIETY_SYMPTOMS'],
  locale: 'vi-VN',
  title: 'Nhịp thở chậm',
  summary: 'Một bài thực hành dịu dàng để trở về với hiện tại.',
  sourceOrganization: 'MentalBridge Content Review',
  status: 'PUBLISHED',
  reviewedAt: '2026-09-20T00:00:00.000Z',
  createdAt: '2026-09-01T00:00:00.000Z',
}

function journey(date: string, completed = 0, streak = 0) {
  return {
    assignmentId: '00000000-0000-4000-8000-000000000301',
    localDate: date,
    planId: '00000000-0000-4000-8000-000000000302',
    planVersion: 7,
    planDay: 10,
    planStage: 'MAINTENANCE' as const,
    items: [{ position: 1, resource, reason: 'PLAN_SELECTED' as const }],
    progress: {
      dailyCompleted: completed,
      dailyTotal: 1,
      learningCompleted: 0,
      learningTotal: 0,
      practiceStreakDays: streak,
    },
    weekStart: '2026-09-28',
    bingo: [
      {
        position: 1,
        resourceId: resource.id,
        label: resource.title,
        stamped: completed > 0,
      },
    ],
  }
}

function completedProgress(localDate = '2026-09-29'): ResourceProgressItem {
  return {
    resourceId: resource.id,
    localDate,
    contentVersion: 'content-v7',
    status: 'COMPLETED',
    completedActionIds: ['overview-complete'],
    completedAt: '2026-09-29T02:15:00.000Z',
    updatedAt: '2026-09-29T02:15:00.000Z',
    version: '3',
  }
}

describe('ResourcesShowcase truthful progress', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 8, 29, 9, 0, 0))
    vi.clearAllMocks()
    api.getResourceCatalogue.mockResolvedValue({
      items: [resource],
      hasMore: false,
    })
    api.getResourceProgress.mockResolvedValue([])
    api.getResourceJourney.mockImplementation(async (date: string) =>
      journey(date),
    )
    api.saveResourceProgress.mockResolvedValue(completedProgress())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows an honest empty state for a new owner without reward claims', async () => {
    render(<ResourcesShowcase />)

    expect(
      await screen.findByRole('heading', { name: 'Nhịp thực hành' }),
    ).toBeVisible()
    expect(screen.getByText('Chưa có chuỗi thực hành')).toBeVisible()
    expect(
      screen.getByText(
        'Chưa có hoạt động hoàn thành nào được lưu trong 14 ngày gần đây.',
      ),
    ).toBeVisible()
    expect(document.body).not.toHaveTextContent(/\bXP\b/i)
    expect(document.body).not.toHaveTextContent(/huy hiệu|cấp độ/i)
  })

  it('renders the persisted streak, source, plan version, and content version', async () => {
    api.getResourceProgress.mockResolvedValue([completedProgress()])
    api.getResourceJourney.mockImplementation(async (date: string) =>
      journey(date, date === '2026-09-29' ? 1 : 0, 4),
    )

    render(<ResourcesShowcase />)

    expect(await screen.findByText('4 ngày đã lưu')).toBeVisible()
    expect(screen.getByText('Dữ liệu từ kế hoạch phiên bản 7')).toBeVisible()
    expect(
      screen.getAllByText('Nguồn: MentalBridge Content Review').length,
    ).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/Đã lưu(?: hoàn thành)? · bản content-v7/).length,
    ).toBeGreaterThan(0)
    expect(api.getResourceJourney).toHaveBeenCalledWith(
      '2026-09-29',
      expect.any(String),
      expect.any(AbortSignal),
    )
  })

  it('keeps successful current progress when an older journey is unavailable', async () => {
    api.getResourceJourney.mockImplementation(async (date: string) => {
      if (date === '2026-09-25') throw new Error('content unavailable')
      return journey(date, date === '2026-09-29' ? 1 : 0, 3)
    })

    render(<ResourcesShowcase />)

    expect(await screen.findByText('3 ngày đã lưu')).toBeVisible()
    expect(
      screen.getByText(
        'Một số ngày trước chưa tải được. Tiến độ hôm nay vẫn là dữ liệu đã lưu.',
      ),
    ).toBeVisible()
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '1',
    )
  })

  it('does not turn a missing or failed journey into a zero-value history', async () => {
    api.getResourceJourney.mockImplementation(async (date: string) => {
      if (date === '2026-09-29') throw new ResourceJourneyBrowserError(404)
      throw new Error('content unavailable')
    })

    render(<ResourcesShowcase />)

    expect(
      await screen.findAllByText(
        'Chưa có dữ liệu hành trình cho ngày hôm nay.',
      ),
    ).not.toHaveLength(0)
    expect(
      screen.getByRole('button', { name: 'Tải lại tiến độ' }),
    ).toBeVisible()
    expect(screen.queryByText(/0 ngày/)).not.toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('acknowledges completion only after a confirmed save and only once', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    api.saveResourceProgress
      .mockRejectedValueOnce(new Error('save failed'))
      .mockResolvedValueOnce(completedProgress())
    render(<ResourcesShowcase />)

    const panel = await screen.findByRole('complementary', {
      name: 'Nhịp thực hành',
    })
    const saveButton = within(panel).getByRole('button', {
      name: `Ghi nhận hoàn thành và lưu: ${resource.title}`,
    })
    await user.click(saveButton)
    expect(
      await screen.findByText(
        'Chưa thể lưu tiến độ. Hãy thử lại sau một chút.',
      ),
    ).toBeVisible()
    expect(screen.queryByText(/Đã lưu hoàn thành “/)).not.toBeInTheDocument()

    await user.click(saveButton)
    expect(
      await screen.findByText(`✓ Đã lưu hoàn thành “${resource.title}”.`),
    ).toBeVisible()
    expect(api.saveResourceProgress).toHaveBeenCalledTimes(2)
    expect(saveButton).toBeDisabled()
  })

  it('rebuilds returning and deleted progress from the server in a new session', async () => {
    api.getResourceProgress.mockResolvedValue([completedProgress()])
    api.getResourceJourney.mockImplementation(async (date: string) =>
      journey(date, date === '2026-09-29' ? 1 : 0, 1),
    )
    const firstSession = render(<ResourcesShowcase />)

    expect(await screen.findByText('1 ngày đã lưu')).toBeVisible()
    expect(screen.queryByText(/✓ Đã lưu hoàn thành “/)).not.toBeInTheDocument()
    firstSession.unmount()

    api.getResourceProgress.mockResolvedValue([])
    api.getResourceJourney.mockImplementation(async (date: string) =>
      journey(date),
    )
    render(<ResourcesShowcase />)

    expect(await screen.findByText('Chưa có chuỗi thực hành')).toBeVisible()
    expect(
      screen.getByText(
        'Chưa có hoạt động hoàn thành nào được lưu trong 14 ngày gần đây.',
      ),
    ).toBeVisible()
    expect(screen.queryByText(/content-v7/)).not.toBeInTheDocument()
  })
})
