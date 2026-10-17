import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import type { PublicResourceSummary } from '../api/browser-resources'
import ResourcesShowcase from './ResourcesShowcase'

vi.mock('@/features/emotion-check-in/TodayEmotionSummary', () => ({
  TodayEmotionSummary: () => <div data-testid="today-emotion-summary" />,
}))

const api = vi.hoisted(() => ({
  getResourceCatalogue: vi.fn(),
  getResourceProgress: vi.fn(),
  saveResourceProgress: vi.fn(),
  getResourceJourney: vi.fn(),
  getResourceBookmarks: vi.fn(),
  saveResourceBookmark: vi.fn(),
  deleteResourceBookmark: vi.fn(),
  getResourceBingo: vi.fn(),
  setResourceBingoSelfConfirmation: vi.fn(),
  getAchievements: vi.fn(),
}))
vi.mock('@/features/achievements/api/browser-achievements', () => ({
  getAchievements: api.getAchievements,
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
vi.mock('../api/browser-resource-engagement', () => ({
  getResourceBookmarks: api.getResourceBookmarks,
  saveResourceBookmark: api.saveResourceBookmark,
  deleteResourceBookmark: api.deleteResourceBookmark,
  getResourceBingo: api.getResourceBingo,
  setResourceBingoSelfConfirmation: api.setResourceBingoSelfConfirmation,
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
    bingo: [],
  }
}

function bingo(evidence: 'NONE' | 'SELF_CONFIRMED' = 'NONE') {
  return {
    weekStart: '2026-09-28',
    timeZone: 'Asia/Ho_Chi_Minh',
    version: '0',
    updatedAt: '2026-09-29T02:15:00.000Z',
    items: [
      {
        position: 1,
        resourceId: resource.id,
        contentVersion: '7',
        label: resource.title,
        evidence,
        selfConfirmedAt:
          evidence === 'SELF_CONFIRMED' ? '2026-09-29T02:15:00.000Z' : null,
        verifiedAt: null,
        verificationSource: null,
      },
    ],
  }
}

describe('ResourcesShowcase owner data', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(new Date(2026, 8, 29, 9))
    vi.clearAllMocks()
    api.getAchievements.mockResolvedValue({ collection: { items: [] } })
    api.getResourceCatalogue.mockResolvedValue({
      items: [resource],
      hasMore: false,
    })
    api.getResourceProgress.mockResolvedValue([])
    api.getResourceJourney.mockImplementation(async (date: string) =>
      journey(date),
    )
    api.getResourceBookmarks.mockResolvedValue([])
    api.saveResourceBookmark.mockResolvedValue({
      resourceId: resource.id,
      contentVersion: '7',
      savedAt: '2026-09-29T02:15:00.000Z',
      version: '0',
    })
    api.getResourceBingo.mockResolvedValue({ board: bingo(), etag: '"0"' })
    api.setResourceBingoSelfConfirmation.mockResolvedValue({
      board: bingo('SELF_CONFIRMED'),
      etag: '"1"',
    })
  })

  afterEach(() => vi.useRealTimers())

  it('does not invent unearned badges when the collection is unavailable', async () => {
    api.getAchievements.mockRejectedValue(new Error('unavailable'))
    render(<ResourcesShowcase />)
    expect(await screen.findByText(/Chưa tải được bộ sưu tập/)).toBeVisible()
    expect(screen.queryByText('Chưa đạt')).not.toBeInTheDocument()
    expect(screen.queryByText('Tài nguyên đầu tiên')).not.toBeInTheDocument()
  })

  it('shows saved plan activity without invented XP or streaks', async () => {
    render(<ResourcesShowcase />)
    expect(
      await screen.findByRole('heading', { level: 1, name: resource.title }),
    ).toBeVisible()
    expect(screen.getByText('Chưa có chuỗi thực hành')).toBeVisible()
    expect(screen.getByText('0/1 hoạt động đã hoàn thành')).toBeVisible()
    expect(screen.getByText('MentalBridge Content Review')).toBeVisible()
    expect(document.body).not.toHaveTextContent(/\bXP\b|420\/600|Cấp độ 2/)
  })

  it('keeps today visible when an older day fails to load', async () => {
    api.getResourceJourney.mockImplementation(async (date: string) => {
      if (date === '2026-09-25') throw new Error('Unavailable')
      return journey(date, date === '2026-09-29' ? 1 : 0, 4)
    })
    render(<ResourcesShowcase />)
    expect(await screen.findByText('4 ngày đã lưu')).toBeVisible()
    expect(screen.getByText('1/1 hoạt động đã hoàn thành')).toBeVisible()
    expect(
      screen.getByText(
        'Một số ngày trước chưa tải được. Tiến độ hôm nay vẫn là dữ liệu đã lưu.',
      ),
    ).toBeVisible()
  })

  it('persists bookmarks through the owner API', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<ResourcesShowcase />)
    await user.click(
      await screen.findByRole('button', { name: 'Lưu hoạt động nổi bật' }),
    )
    expect(api.saveResourceBookmark).toHaveBeenCalledWith(resource.id)
    expect(
      await screen.findByRole('button', { name: 'Bỏ lưu hoạt động nổi bật' }),
    ).toBeVisible()
  })

  it('separates a saved Bingo mark from a failed update', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    api.setResourceBingoSelfConfirmation
      .mockResolvedValueOnce({ board: bingo('SELF_CONFIRMED'), etag: '"1"' })
      .mockRejectedValueOnce(
        new ApiError({
          message: 'conflict',
          code: 'STALE_VERSION',
          status: 412,
        }),
      )
    render(<ResourcesShowcase />)
    await user.click(await screen.findByRole('button', { name: 'Tự đánh dấu' }))
    expect(await screen.findByText('Bạn tự đánh dấu')).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Bỏ tự đánh dấu' }))
    expect(
      await screen.findByText(
        'Thay đổi Bingo chưa được đối soát. Các dấu cũ đang được ẩn để tránh nhầm là trạng thái hiện tại.',
      ),
    ).toBeVisible()
    expect(screen.queryByText('Bạn tự đánh dấu')).not.toBeInTheDocument()
  })
})
