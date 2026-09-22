import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  supportPlanOccurrenceFixture,
  supportPlanOccurrenceListFixture,
} from '../testing/support-plan-occurrence-fixture'
import SupportPlanSchedule from './SupportPlanSchedule'

const api = vi.hoisted(() => ({
  deleteSupportPlanOccurrenceEngagement: vi.fn(),
  getSupportPlanOccurrences: vi.fn(),
  replaceSupportPlanOccurrenceEngagement: vi.fn(),
}))

vi.mock('../api/browser-support-plan', () => api)

describe('SupportPlanSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows bounded items with exact source versions and non-clinical boundary', async () => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    api.getSupportPlanOccurrences.mockResolvedValue(
      supportPlanOccurrenceListFixture([
        supportPlanOccurrenceFixture({ localDate: today }),
      ]),
    )

    render(<SupportPlanSchedule planStatus="ACTIVE" />)

    expect(
      await screen.findByRole('button', { name: 'Ghi nhận đã làm' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Hoạt động của tôi' }),
    ).toBeVisible()
    fireEvent.click(screen.getByText('Chi tiết nguồn'))
    expect(
      screen.getByText(/Tài nguyên SupportPlan · lịch 1 · SupportPlan 1/),
    ).toBeVisible()
    expect(screen.getByText(/Phiên bản tài nguyên 4 · slot/)).toBeVisible()
    expect(
      screen.getByText(/không phải đánh giá tuân thủ điều trị/),
    ).toBeVisible()
    expect(api.getSupportPlanOccurrences).toHaveBeenCalledWith(
      today,
      expect.any(String),
    )
  })

  it('records helpfulness, private reflection, and explicit summary reuse approval', async () => {
    const occurrence = supportPlanOccurrenceFixture()
    api.getSupportPlanOccurrences.mockResolvedValue(
      supportPlanOccurrenceListFixture([occurrence]),
    )
    api.replaceSupportPlanOccurrenceEngagement.mockResolvedValue(
      supportPlanOccurrenceFixture({
        state: 'COMPLETED',
        displayState: 'COMPLETED',
        version: 1,
        completedAt: '2026-09-21T02:00:00Z',
        helpfulness: 'HELPFUL',
        reflection: 'Dễ bắt đầu hơn.',
        summaryReuseApproved: true,
        engagementUpdatedAt: '2026-09-21T02:00:00Z',
      }),
    )

    render(<SupportPlanSchedule planStatus="ACTIVE" />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Ghi nhận đã làm' }),
    )
    fireEvent.change(screen.getByLabelText(/hữu ích với bạn/), {
      target: { value: 'HELPFUL' },
    })
    fireEvent.change(screen.getByLabelText(/Ghi chú riêng/), {
      target: { value: '  Dễ bắt đầu hơn.  ' },
    })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tự ghi nhận' }))

    await waitFor(() =>
      expect(api.replaceSupportPlanOccurrenceEngagement).toHaveBeenCalledWith(
        occurrence.occurrenceId,
        0,
        {
          state: 'COMPLETED',
          hidden: false,
          helpfulness: 'HELPFUL',
          barrierCode: null,
          reflection: 'Dễ bắt đầu hơn.',
          summaryReuseApproved: true,
        },
      ),
    )
    expect(await screen.findByText('Bạn đã ghi nhận là đã làm')).toBeVisible()
  })

  it('records a skip with a bounded barrier without a helpfulness rating', async () => {
    const occurrence = supportPlanOccurrenceFixture()
    api.getSupportPlanOccurrences.mockResolvedValue(
      supportPlanOccurrenceListFixture([occurrence]),
    )
    api.replaceSupportPlanOccurrenceEngagement.mockResolvedValue(
      supportPlanOccurrenceFixture({
        state: 'SKIPPED',
        displayState: 'SKIPPED',
        version: 1,
        barrierCode: 'DIFFICULT_TO_START',
        skippedAt: '2026-09-21T02:00:00Z',
        engagementUpdatedAt: '2026-09-21T02:00:00Z',
      }),
    )

    render(<SupportPlanSchedule planStatus="ACTIVE" />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Ghi nhận bỏ qua' }),
    )
    fireEvent.change(screen.getByLabelText(/chưa phù hợp lúc này/), {
      target: { value: 'DIFFICULT_TO_START' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu tự ghi nhận' }))

    await waitFor(() =>
      expect(api.replaceSupportPlanOccurrenceEngagement).toHaveBeenCalledWith(
        occurrence.occurrenceId,
        0,
        {
          state: 'SKIPPED',
          hidden: false,
          helpfulness: null,
          barrierCode: 'DIFFICULT_TO_START',
          reflection: null,
          summaryReuseApproved: false,
        },
      ),
    )
    expect(await screen.findByText('Bạn đã ghi nhận là bỏ qua')).toBeVisible()
  })

  it('can hide, restore, and reopen an owned response', async () => {
    const completed = supportPlanOccurrenceFixture({
      state: 'COMPLETED',
      displayState: 'COMPLETED',
      version: 2,
      helpfulness: 'A_LITTLE_HELPFUL',
      completedAt: '2026-09-21T02:00:00Z',
      engagementUpdatedAt: '2026-09-21T02:00:00Z',
    })
    api.getSupportPlanOccurrences.mockResolvedValue(
      supportPlanOccurrenceListFixture([completed]),
    )
    api.replaceSupportPlanOccurrenceEngagement
      .mockResolvedValueOnce({ ...completed, hidden: true, version: 3 })
      .mockResolvedValueOnce({ ...completed, hidden: false, version: 4 })
      .mockResolvedValueOnce(
        supportPlanOccurrenceFixture({ version: 5, hidden: false }),
      )
    api.deleteSupportPlanOccurrenceEngagement.mockResolvedValue(
      supportPlanOccurrenceFixture({ version: 6 }),
    )

    render(<SupportPlanSchedule planStatus="ACTIVE" />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Ẩn khỏi danh sách' }),
    )
    fireEvent.click(await screen.findByText('Đã ẩn (1)'))
    fireEvent.click(screen.getByRole('button', { name: 'Hiện lại' }))
    expect(await screen.findByText('Đã hiện lại mục này.')).toBeVisible()
    fireEvent.click(await screen.findByRole('button', { name: 'Mở lại' }))

    await waitFor(() =>
      expect(
        api.replaceSupportPlanOccurrenceEngagement,
      ).toHaveBeenLastCalledWith(completed.occurrenceId, 4, {
        state: 'SCHEDULED',
        hidden: false,
        helpfulness: null,
        barrierCode: null,
        reflection: null,
        summaryReuseApproved: false,
      }),
    )
  })

  it('deletes only the mutable self-report while retaining the occurrence', async () => {
    const completed = supportPlanOccurrenceFixture({
      state: 'COMPLETED',
      displayState: 'COMPLETED',
      version: 2,
      helpfulness: 'HELPFUL',
      reflection: 'Ghi chú riêng',
      completedAt: '2026-09-21T02:00:00Z',
      engagementUpdatedAt: '2026-09-21T02:00:00Z',
    })
    api.getSupportPlanOccurrences.mockResolvedValue(
      supportPlanOccurrenceListFixture([completed]),
    )
    api.deleteSupportPlanOccurrenceEngagement.mockResolvedValue(
      supportPlanOccurrenceFixture({ version: 3 }),
    )

    render(<SupportPlanSchedule planStatus="ACTIVE" />)
    fireEvent.click(
      await screen.findByRole('button', { name: 'Xoá tự ghi nhận' }),
    )

    await waitFor(() =>
      expect(api.deleteSupportPlanOccurrenceEngagement).toHaveBeenCalledWith(
        completed.occurrenceId,
        2,
      ),
    )
    expect(await screen.findByText(/lịch gốc vẫn được giữ lại/)).toBeVisible()
  })

  it('does not offer mutation actions while the plan is paused', async () => {
    api.getSupportPlanOccurrences.mockResolvedValue(
      supportPlanOccurrenceListFixture(),
    )

    render(<SupportPlanSchedule planStatus="PAUSED" />)

    expect(await screen.findByText('Đang tạm dừng')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Ghi nhận đã làm' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ghi nhận bỏ qua' })).toBeNull()
  })
})
