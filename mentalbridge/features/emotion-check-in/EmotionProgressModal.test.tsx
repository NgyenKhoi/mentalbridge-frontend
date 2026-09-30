import { render, screen, waitFor, within } from '@testing-library/react'
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
import EmotionProgressModal from './EmotionProgressModal'

vi.mock('./api/browser-emotion-check-in', () => ({
  getEmotionCheckInProgress: vi.fn(),
  listEmotionCheckIns: vi.fn(),
}))

const getProgress = vi.mocked(getEmotionCheckInProgress)
const list = vi.mocked(listEmotionCheckIns)

const distribution = {
  GREAT: 0,
  GOOD: 2,
  OKAY: 1,
  LOW: 1,
  VERY_LOW: 0,
} as const

const progress: EmotionCheckInProgress = {
  asOfLocalDate: '2026-09-30',
  timezone: 'Asia/Ho_Chi_Minh',
  currentEmotion: null,
  currentStreak: 2,
  longestStreak: 5,
  windows: ([7, 14, 30] as const).map((days) => ({
    days,
    startLocalDate:
      days === 7 ? '2026-09-24' : days === 14 ? '2026-09-17' : '2026-09-01',
    endLocalDate: '2026-09-30',
    checkedInDays: 4,
    totalDays: days,
    distribution,
  })),
  label: 'SELF_REPORTED_EMOTION',
  interpretation: 'FACTUAL_COUNTS_NOT_DIAGNOSIS_OR_RECOVERY',
}

const checkIn = (
  id: string,
  localDate: string,
  emotion: EmotionCheckIn['emotion'],
  intensity: number,
): EmotionCheckIn => ({
  id,
  localDate,
  timezone: 'Asia/Ho_Chi_Minh',
  emotion,
  intensity,
  note: `ghi chú riêng tư ${id}`,
  sourceLabel: 'SELF_REPORTED_EMOTION',
  clinicalUse: 'NOT_A_DIAGNOSIS_OR_SAFETY_CLASSIFIER',
  revision: 1,
  recordedAt: `${localDate}T02:00:00.000Z`,
  createdAt: `${localDate}T02:00:00.000Z`,
  updatedAt: `${localDate}T02:00:00.000Z`,
})

const history = [
  checkIn('40000000-0000-4000-8000-000000000004', '2026-09-29', 'GOOD', 5),
  checkIn('40000000-0000-4000-8000-000000000003', '2026-09-28', 'LOW', 2),
  checkIn('40000000-0000-4000-8000-000000000002', '2026-09-26', 'OKAY', 3),
  checkIn('40000000-0000-4000-8000-000000000001', '2026-09-24', 'GOOD', 4),
]

const historyResponse = (items: EmotionCheckIn[]) => ({
  items,
  page: { limit: 30, hasMore: false },
  label: 'SELF_REPORTED_EMOTION' as const,
  interpretation: 'NOT_DIAGNOSIS_OR_RECOVERY' as const,
})

describe('EmotionProgressModal', () => {
  beforeEach(() => {
    getProgress.mockReset()
    list.mockReset()
    getProgress.mockResolvedValue(progress)
    list.mockResolvedValue(historyResponse(history))
  })

  it('renders factual sparse 7/14/30-day data without private or inferred content', async () => {
    const user = userEvent.setup()
    render(<EmotionProgressModal isOpen onClose={vi.fn()} />)

    expect(await screen.findByText('4/7 ngày')).toBeVisible()
    const summary = screen.getByLabelText('Tổng quan ghi nhận cảm xúc')
    expect(within(summary).getByText('2 ngày')).toBeVisible()
    expect(within(summary).getByText('5 ngày')).toBeVisible()
    expect(
      screen.getByText('Chuỗi vẫn được giữ nếu hôm nay bạn chưa ghi.'),
    ).toBeVisible()
    expect(
      screen.getByRole('button', {
        name: /Thứ Sáu,? 25 tháng 9, chưa ghi nhận/i,
      }),
    ).toBeVisible()
    expect(
      screen.getByRole('button', {
        name: /Thứ Ba,? 29 tháng 9, cảm xúc Tốt, mức cảm nhận 5 trên 5/i,
      }),
    ).toBeVisible()
    expect(screen.queryByText(/ghi chú riêng tư/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/trung bình/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/tích cực hơn/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/không phải chẩn đoán/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '90 ngày' }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '14 ngày' }))
    expect(screen.getByText('4/14 ngày')).toBeVisible()
    expect(screen.getByText('17/09 – 30/09')).toBeVisible()
  })

  it('shows a calm first-use state without zero-value summary cards', async () => {
    getProgress.mockResolvedValue({
      ...progress,
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
    list.mockResolvedValue(historyResponse([]))

    render(<EmotionProgressModal isOpen onClose={vi.fn()} />)

    expect(await screen.findByText('Chưa có ghi nhận nào')).toBeVisible()
    expect(
      screen.getByText('Khi bạn ghi lại cảm xúc, chúng sẽ hiện ở đây.'),
    ).toBeVisible()
    expect(screen.queryByText('Chuỗi hiện tại')).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Ghi lại cảm xúc hôm nay' }),
    ).toHaveAttribute('href', '/dashboard#emotion-check-in')
  })

  it('keeps dependency failure recoverable and does not expose its details', async () => {
    const user = userEvent.setup()
    getProgress.mockRejectedValueOnce(new Error('private dependency detail'))

    render(<EmotionProgressModal isOpen onClose={vi.fn()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không thể tải dữ liệu lúc này',
    )
    expect(
      screen.queryByText('private dependency detail'),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('4/7 ngày')).toBeVisible()
    expect(getProgress).toHaveBeenCalledTimes(2)
  })

  it('refetches on reopen so a deleted check-in becomes a missing day', async () => {
    const updatedProgress: EmotionCheckInProgress = {
      ...progress,
      currentStreak: 0,
      windows: progress.windows.map((window) => ({
        ...window,
        checkedInDays: 3,
        distribution: { ...distribution, GOOD: 1 },
      })),
    }
    getProgress
      .mockResolvedValueOnce(progress)
      .mockResolvedValueOnce(updatedProgress)
    list
      .mockResolvedValueOnce(historyResponse(history))
      .mockResolvedValueOnce(historyResponse(history.slice(1)))

    const { rerender } = render(
      <EmotionProgressModal isOpen onClose={vi.fn()} />,
    )
    expect(await screen.findByText('4/7 ngày')).toBeVisible()

    rerender(<EmotionProgressModal isOpen={false} onClose={vi.fn()} />)
    rerender(<EmotionProgressModal isOpen onClose={vi.fn()} />)

    expect(await screen.findByText('3/7 ngày')).toBeVisible()
    await waitFor(() =>
      expect(
        screen.getByRole('button', {
          name: /Thứ Ba,? 29 tháng 9, chưa ghi nhận/i,
        }),
      ).toBeVisible(),
    )
  })
})
