import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  EmotionCheckIn,
  EmotionCheckInProgress,
} from '@/lib/emotion-check-in/contract'
import {
  getEmotionCheckInProgress,
  listEmotionCheckIns,
} from './api/browser-emotion-check-in'
import { EmotionProgress } from './EmotionProgress'

vi.mock('./api/browser-emotion-check-in', () => ({
  getEmotionCheckInProgress: vi.fn(),
  listEmotionCheckIns: vi.fn(),
}))

const getProgress = vi.mocked(getEmotionCheckInProgress)
const list = vi.mocked(listEmotionCheckIns)
const distributions = {
  7: { GREAT: 1, GOOD: 2, OKAY: 0, LOW: 1, VERY_LOW: 0 },
  14: { GREAT: 2, GOOD: 3, OKAY: 1, LOW: 1, VERY_LOW: 0 },
  30: { GREAT: 3, GOOD: 4, OKAY: 2, LOW: 1, VERY_LOW: 1 },
} as const
const progress: EmotionCheckInProgress = {
  asOfLocalDate: '2026-09-27',
  timezone: 'Asia/Ho_Chi_Minh',
  currentEmotion: 'GOOD',
  currentStreak: 4,
  longestStreak: 9,
  windows: ([7, 14, 30] as const).map((days) => ({
    days,
    startLocalDate:
      days === 7 ? '2026-09-21' : days === 14 ? '2026-09-14' : '2026-08-29',
    endLocalDate: '2026-09-27',
    checkedInDays: Object.values(distributions[days]).reduce<number>(
      (sum, count) => sum + count,
      0,
    ),
    totalDays: days,
    distribution: distributions[days],
  })),
  label: 'SELF_REPORTED_EMOTION',
  interpretation: 'FACTUAL_COUNTS_NOT_DIAGNOSIS_OR_RECOVERY',
}
const history: EmotionCheckIn[] = [
  {
    id: '40000000-0000-4000-8000-000000000001',
    localDate: '2026-09-27',
    timezone: 'Asia/Ho_Chi_Minh',
    emotion: 'GOOD',
    intensity: 4,
    note: 'private note must not render',
    sourceLabel: 'SELF_REPORTED_EMOTION',
    clinicalUse: 'NOT_A_DIAGNOSIS_OR_SAFETY_CLASSIFIER',
    revision: 2,
    recordedAt: '2026-09-27T02:00:00.000Z',
    createdAt: '2026-09-27T01:00:00.000Z',
    updatedAt: '2026-09-27T02:00:00.000Z',
  },
]

describe('EmotionProgress', () => {
  beforeEach(() => {
    getProgress.mockReset()
    list.mockReset()
    getProgress.mockResolvedValue(progress)
    list.mockResolvedValue({
      items: history,
      page: { limit: 30, hasMore: false },
      label: 'SELF_REPORTED_EMOTION',
      interpretation: 'NOT_DIAGNOSIS_OR_RECOVERY',
    })
  })

  it('renders authoritative factual streaks, rolling counts, and history', async () => {
    const user = userEvent.setup()
    render(<EmotionProgress />)

    expect(await screen.findByText('Chuỗi hiện tại')).toBeVisible()
    expect(screen.getByText('4 ngày')).toBeVisible()
    expect(screen.getByText('9 ngày')).toBeVisible()
    expect(screen.getByText('Đã ghi nhận 4/7 ngày')).toBeVisible()
    expect(screen.getByText('27/09/2026')).toBeVisible()
    expect(screen.getByText('Mức cảm nhận 4/5')).toBeVisible()
    expect(
      screen.queryByText('private note must not render'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(
        'Đây không phải chẩn đoán, đánh giá tiến bộ hay mức độ hồi phục.',
      ),
    ).toBeVisible()

    await user.click(screen.getByRole('button', { name: '14 ngày' }))
    expect(screen.getByText('Đã ghi nhận 7/14 ngày')).toBeVisible()
  })

  it('renders truthful zero and empty states without inventing a trend', async () => {
    getProgress.mockResolvedValue({
      ...progress,
      currentEmotion: null,
      currentStreak: 0,
      longestStreak: 0,
      windows: progress.windows.map((window) => ({
        ...window,
        checkedInDays: 0,
        distribution: {
          GREAT: 0,
          GOOD: 0,
          OKAY: 0,
          LOW: 0,
          VERY_LOW: 0,
        },
      })),
    })
    list.mockResolvedValue({
      items: [],
      page: { limit: 30, hasMore: false },
      label: 'SELF_REPORTED_EMOTION',
      interpretation: 'NOT_DIAGNOSIS_OR_RECOVERY',
    })

    render(<EmotionProgress />)

    expect(
      await screen.findByText('Chưa có ghi nhận trong khoảng thời gian này.'),
    ).toBeVisible()
    expect(
      screen.getByText(/Lịch sử sẽ xuất hiện sau lần lưu đầu tiên/),
    ).toBeVisible()
    expect(screen.queryByText(/xu hướng/iu)).not.toBeInTheDocument()
  })

  it('keeps a bounded recoverable error state', async () => {
    getProgress.mockRejectedValueOnce(new Error('private dependency detail'))
    render(<EmotionProgress />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Lịch sử cảm xúc tạm thời chưa tải được.',
    )
    expect(
      screen.queryByText('private dependency detail'),
    ).not.toBeInTheDocument()
  })
})
