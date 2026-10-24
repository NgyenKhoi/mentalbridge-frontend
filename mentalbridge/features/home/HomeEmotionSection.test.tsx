import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  EmotionCheckIn,
  EmotionCheckInProgress,
  EmotionCheckInList,
} from '@/lib/emotion-check-in/contract'
import {
  getEmotionCheckInProgress,
  listEmotionCheckIns,
} from '@/features/emotion-check-in/api/browser-emotion-check-in'
import { HomeEmotionWeek } from './HomeEmotionSection'

vi.mock('@/features/emotion-check-in/PlanEmotionCheckIn', () => ({
  PlanEmotionCheckIn: () => null,
}))
vi.mock('@/features/emotion-check-in/api/browser-emotion-check-in', () => ({
  getEmotionCheckInProgress: vi.fn(),
  listEmotionCheckIns: vi.fn(),
}))

const progress: EmotionCheckInProgress = {
  asOfLocalDate: '2026-10-22',
  timezone: 'Asia/Ho_Chi_Minh',
  currentEmotion: null,
  currentStreak: 0,
  longestStreak: 0,
  windows: [],
  label: 'SELF_REPORTED_EMOTION',
  interpretation: 'FACTUAL_COUNTS_NOT_DIAGNOSIS_OR_RECOVERY',
}
function record(localDate: string): EmotionCheckIn {
  return {
    id: '40000000-0000-4000-8000-000000000001',
    localDate,
    timezone: 'Asia/Ho_Chi_Minh',
    emotion: 'GOOD',
    intensity: 4,
    factors: ['sleep'],
    note: 'private context must not appear',
    sourceLabel: 'SELF_REPORTED_EMOTION',
    clinicalUse: 'NOT_A_DIAGNOSIS_OR_SAFETY_CLASSIFIER',
    revision: 1,
    recordedAt: '2026-10-22T02:00:00Z',
    createdAt: '2026-10-22T02:00:00Z',
    updatedAt: '2026-10-22T02:00:00Z',
  }
}
const list = (items: EmotionCheckIn[]): EmotionCheckInList => ({
  items,
  page: { limit: 7, hasMore: false },
  label: 'SELF_REPORTED_EMOTION',
  interpretation: 'NOT_DIAGNOSIS_OR_RECOVERY',
})

describe('HomeEmotionWeek', () => {
  beforeEach(() => {
    vi.mocked(getEmotionCheckInProgress).mockReset().mockResolvedValue(progress)
    vi.mocked(listEmotionCheckIns)
      .mockReset()
      .mockResolvedValue(list([record('2026-10-21')]))
  })

  it('renders real seven-day faces and yesterday copy without private context', async () => {
    render(<HomeEmotionWeek />)
    const days = await screen.findByRole('list', {
      name: 'Cảm xúc 7 ngày gần đây',
    })
    expect(within(days).getAllByRole('listitem')).toHaveLength(7)
    expect(
      screen.getByText('Hôm qua bạn chọn', { exact: false }),
    ).toHaveTextContent('Hôm qua bạn chọn Tốt.')
    expect(within(days).getAllByLabelText(/Chưa ghi nhận/)).toHaveLength(6)
    expect(screen.getByRole('link', { name: 'Xem tiến độ →' })).toHaveAttribute(
      'href',
      '/analytics',
    )
    expect(
      screen.queryByText('private context must not appear'),
    ).not.toBeInTheDocument()
    expect(listEmotionCheckIns).toHaveBeenCalledWith(7)
  })

  it('shows a neutral empty week and a card-local retry after a read failure', async () => {
    vi.mocked(getEmotionCheckInProgress).mockRejectedValueOnce(
      new Error('offline'),
    )
    vi.mocked(listEmotionCheckIns).mockResolvedValue(list([]))
    render(<HomeEmotionWeek />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa tải được cảm xúc tuần này.',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    const days = await screen.findByRole('list')
    expect(within(days).getAllByLabelText(/Chưa ghi nhận/)).toHaveLength(7)
    expect(
      screen.getByText('Hôm qua chưa có ghi nhận.', { exact: false }),
    ).toBeVisible()
  })

  it('keeps the week skeleton visible until both reads finish', async () => {
    let finish!: (value: EmotionCheckInList) => void
    vi.mocked(listEmotionCheckIns).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    render(<HomeEmotionWeek />)
    await act(async () => Promise.resolve())
    const week = screen.getByRole('region', { name: 'Tuần này của bạn' })
    expect(week).toHaveAttribute('aria-busy', 'true')
    expect(
      screen.getByRole('status', { name: 'Đang tải cảm xúc 7 ngày gần đây' }),
    ).toBeVisible()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    await act(async () => finish(list([])))
    expect(await screen.findByRole('list')).toBeVisible()
    expect(week).toHaveAttribute('aria-busy', 'false')
  })

  it('refreshes today from persisted data when a check-in changes', async () => {
    render(<HomeEmotionWeek />)
    await screen.findByRole('list')
    expect(
      screen.getByLabelText('2026-10-22 · Hôm nay: Chưa ghi nhận'),
    ).toBeVisible()
    vi.mocked(listEmotionCheckIns).mockResolvedValue(
      list([record('2026-10-21'), record('2026-10-22')]),
    )
    await act(async () => {
      window.dispatchEvent(new CustomEvent('mb:emotion-check-in-updated'))
    })
    expect(
      await screen.findByLabelText('2026-10-22 · Hôm nay: Tốt'),
    ).toBeVisible()
  })
})
