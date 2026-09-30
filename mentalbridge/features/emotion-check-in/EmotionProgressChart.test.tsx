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
import EmotionProgressChart from './EmotionProgressChart'

vi.mock('./api/browser-emotion-check-in', () => ({
  getEmotionCheckInProgress: vi.fn(),
  listEmotionCheckIns: vi.fn(),
}))

const getProgress = vi.mocked(getEmotionCheckInProgress)
const list = vi.mocked(listEmotionCheckIns)

const progress: EmotionCheckInProgress = {
  asOfLocalDate: '2026-09-30',
  timezone: 'Asia/Ho_Chi_Minh',
  currentEmotion: 'GREAT',
  currentStreak: 2,
  longestStreak: 4,
  windows: [
    {
      days: 7,
      startLocalDate: '2026-09-24',
      endLocalDate: '2026-09-30',
      checkedInDays: 2,
      totalDays: 7,
      distribution: {
        GREAT: 1,
        GOOD: 1,
        OKAY: 0,
        LOW: 0,
        VERY_LOW: 0,
      },
    },
  ],
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
  note: null,
  sourceLabel: 'SELF_REPORTED_EMOTION',
  clinicalUse: 'NOT_A_DIAGNOSIS_OR_SAFETY_CLASSIFIER',
  revision: 1,
  recordedAt: `${localDate}T02:00:00.000Z`,
  createdAt: `${localDate}T02:00:00.000Z`,
  updatedAt: `${localDate}T02:00:00.000Z`,
})

const historyResponse = (items: EmotionCheckIn[]) => ({
  items,
  page: { limit: 30, hasMore: false },
  label: 'SELF_REPORTED_EMOTION' as const,
  interpretation: 'NOT_DIAGNOSIS_OR_RECOVERY' as const,
})

describe('EmotionProgressChart', () => {
  beforeEach(() => {
    getProgress.mockReset()
    list.mockReset()
    getProgress.mockResolvedValue(progress)
    list.mockResolvedValue(
      historyResponse([
        checkIn(
          '40000000-0000-4000-8000-000000000003',
          '2026-09-30',
          'GREAT',
          5,
        ),
        checkIn(
          '40000000-0000-4000-8000-000000000002',
          '2026-09-29',
          'GOOD',
          4,
        ),
        checkIn('40000000-0000-4000-8000-000000000001', '2026-09-23', 'LOW', 2),
      ]),
    )
  })

  it('plots only persisted check-ins in the authoritative 7-day window', async () => {
    render(<EmotionProgressChart onOpenDetails={vi.fn()} />)

    expect(
      await screen.findByRole('img', {
        name: /Cảm xúc đã ghi nhận trong 7 ngày gần nhất/,
      }),
    ).toBeVisible()
    expect(
      screen.getByLabelText(
        /Thứ Tư,? 30 tháng 9, cảm xúc Rất tốt, mức cảm nhận 5 trên 5/i,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText(
        /Thứ Ba,? 29 tháng 9, cảm xúc Tốt, mức cảm nhận 4 trên 5/i,
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByLabelText(/23 tháng 9, cảm xúc Không tốt/i),
    ).not.toBeInTheDocument()
    expect(
      screen.getByText(/bạn đã ghi nhận 2 trên 7 ngày/i),
    ).toBeInTheDocument()
  })

  it('keeps the details action connected to the modal trigger', async () => {
    const user = userEvent.setup()
    const onOpenDetails = vi.fn()
    render(<EmotionProgressChart onOpenDetails={onOpenDetails} />)

    await screen.findByRole('img')
    await user.click(screen.getByRole('button', { name: /xem chi tiết/i }))

    expect(onOpenDetails).toHaveBeenCalledOnce()
  })

  it('offers a useful first-record action when the window is empty', async () => {
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
    list.mockResolvedValue(historyResponse([]))

    render(<EmotionProgressChart onOpenDetails={vi.fn()} />)

    expect(
      await screen.findByText('Chưa có ghi nhận trong 7 ngày gần nhất'),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Ghi lại cảm xúc' }),
    ).toHaveAttribute('href', '/dashboard#emotion-check-in')
  })

  it('allows retrying without exposing dependency details', async () => {
    const user = userEvent.setup()
    getProgress.mockRejectedValueOnce(new Error('private dependency detail'))

    render(<EmotionProgressChart onOpenDetails={vi.fn()} />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa thể tải dữ liệu cảm xúc',
    )
    expect(
      screen.queryByText('private dependency detail'),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByRole('img')).toBeVisible()
    expect(getProgress).toHaveBeenCalledTimes(2)
  })
})
