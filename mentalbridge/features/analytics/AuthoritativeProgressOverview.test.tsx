import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AnalyticsOverview } from './api/analytics-overview-contract'
import { getAnalyticsOverview } from './api/browser-analytics-overview'
import AuthoritativeProgressOverview from './AuthoritativeProgressOverview'

vi.mock('./api/browser-analytics-overview', () => ({
  getAnalyticsOverview: vi.fn(),
}))

const getOverview = vi.mocked(getAnalyticsOverview)

const overview: AnalyticsOverview = {
  asOfLocalDate: '2026-09-30',
  timezone: 'Asia/Bangkok',
  emotion: {
    state: 'available',
    data: { currentStreak: 3, checkedInDays: 8, windowDays: 30 },
  },
  assessments: {
    state: 'available',
    data: {
      count: 50,
      countIsLowerBound: true,
      latestSubmittedAt: '2026-09-28T03:00:00.000Z',
      latestInstrument: 'PHQ9',
    },
  },
  supportActivities: {
    state: 'available',
    data: {
      completedCount: 4,
      skippedCount: 1,
      scheduledOrMissedCount: 2,
      windowDays: 30,
    },
  },
  appointments: {
    state: 'available',
    data: { totalCount: 5, activeCount: 2 },
  },
}

describe('AuthoritativeProgressOverview', () => {
  beforeEach(() => {
    getOverview.mockReset()
    getOverview.mockResolvedValue(overview)
  })

  it('renders factual owner-scoped metrics and a bounded assessment count', async () => {
    render(<AuthoritativeProgressOverview />)

    expect(
      await screen.findByRole('region', { name: 'Tổng quan hoạt động' }),
    ).toBeVisible()
    expect(screen.getByText('3')).toBeVisible()
    expect(screen.getByText('8/30 ngày gần nhất có ghi nhận.')).toBeVisible()
    expect(screen.getByText('50+')).toBeVisible()
    expect(screen.getByText(/Gần nhất: PHQ-9/)).toBeVisible()
    expect(screen.getByText('4')).toBeVisible()
    expect(screen.getByText('1 đã bỏ qua · 2 chưa hoàn tất.')).toBeVisible()
    expect(screen.getByText('2 lịch đang hoạt động.')).toBeVisible()
    expect(screen.queryByText(/trung bình tâm trạng/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/hồi phục/i)).not.toBeInTheDocument()
  })

  it('does not fabricate zero when individual sources are unavailable', async () => {
    getOverview.mockResolvedValue({
      ...overview,
      assessments: { state: 'unavailable' },
      appointments: { state: 'unavailable' },
      supportActivities: { state: 'empty' },
    })

    render(<AuthoritativeProgressOverview />)

    const assessmentCard = (
      await screen.findByText('Bài sàng lọc đã lưu')
    ).closest('article')
    const appointmentCard = screen
      .getByText('Lịch tư vấn đã tạo')
      .closest('article')
    const supportCard = screen.getByText('Hoạt động hỗ trợ').closest('article')

    expect(assessmentCard).not.toBeNull()
    expect(appointmentCard).not.toBeNull()
    expect(supportCard).not.toBeNull()
    expect(within(assessmentCard!).getByText('—')).toBeVisible()
    expect(within(appointmentCard!).getByText('—')).toBeVisible()
    expect(
      within(assessmentCard!).getByText('Tạm thời chưa tải được dữ liệu này.'),
    ).toBeVisible()
    expect(
      within(supportCard!).getByText('Chưa có kế hoạch hỗ trợ hiện tại.'),
    ).toBeVisible()
  })

  it('shows a truthful aggregate failure and allows retrying', async () => {
    const user = userEvent.setup()
    getOverview
      .mockRejectedValueOnce(new Error('private dependency detail'))
      .mockResolvedValueOnce(overview)

    render(<AuthoritativeProgressOverview />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa thể tải tổng quan hoạt động',
    )
    expect(
      screen.queryByText('private dependency detail'),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    await waitFor(() => expect(getOverview).toHaveBeenCalledTimes(2))
    expect(
      await screen.findByRole('region', { name: 'Tổng quan hoạt động' }),
    ).toBeVisible()
  })
})
