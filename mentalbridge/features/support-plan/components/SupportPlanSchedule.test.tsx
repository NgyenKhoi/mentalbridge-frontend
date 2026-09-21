import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  supportPlanOccurrenceFixture,
  supportPlanOccurrenceListFixture,
} from '../testing/support-plan-occurrence-fixture'
import SupportPlanSchedule from './SupportPlanSchedule'

const api = vi.hoisted(() => ({
  changeSupportPlanOccurrenceState: vi.fn(),
  getSupportPlanOccurrences: vi.fn(),
}))

vi.mock('../api/browser-support-plan', () => api)

describe('SupportPlanSchedule', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows bounded today/upcoming items with local time and source versions', async () => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    const tomorrow = new Date(`${today}T00:00:00Z`)
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    const tomorrowDate = tomorrow.toISOString().slice(0, 10)
    api.getSupportPlanOccurrences.mockResolvedValue(
      supportPlanOccurrenceListFixture([
        supportPlanOccurrenceFixture({ localDate: today }),
        supportPlanOccurrenceFixture({
          occurrenceId: '93000000-0000-4000-8000-000000000513',
          localDate: tomorrowDate,
          localTime: '10:00:00',
          scheduledAt: `${tomorrowDate}T03:00:00Z`,
        }),
      ]),
    )

    render(<SupportPlanSchedule planStatus="ACTIVE" />)

    expect(await screen.findByText('Hôm nay và sắp tới')).toBeVisible()
    expect(screen.getAllByText('Reviewed primary resource')).toHaveLength(2)
    expect(screen.getAllByText('Asia/Ho_Chi_Minh')).toHaveLength(2)
    fireEvent.click(screen.getAllByText('Chi tiết nguồn')[0])
    expect(
      screen.getAllByText(/Tài nguyên SupportPlan · lịch 1 · SupportPlan 1/)[0],
    ).toBeVisible()
    expect(
      screen.getAllByText(/Phiên bản tài nguyên 4 · slot/)[0],
    ).toBeVisible()
    expect(api.getSupportPlanOccurrences).toHaveBeenCalledWith(
      today,
      expect.any(String),
    )
  })

  it('records an explicit self-reported state without adherence language', async () => {
    const occurrence = supportPlanOccurrenceFixture()
    api.getSupportPlanOccurrences.mockResolvedValue(
      supportPlanOccurrenceListFixture([occurrence]),
    )
    api.changeSupportPlanOccurrenceState.mockResolvedValue({
      ...occurrence,
      state: 'COMPLETED',
      displayState: 'COMPLETED',
      version: 1,
      completedAt: '2026-09-21T02:00:00Z',
    })

    render(<SupportPlanSchedule planStatus="ACTIVE" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Đã làm' }))

    await waitFor(() =>
      expect(api.changeSupportPlanOccurrenceState).toHaveBeenCalledWith(
        occurrence.occurrenceId,
        0,
        'COMPLETED',
      ),
    )
    expect(await screen.findByText('Bạn đã hoàn thành')).toBeVisible()
    expect(
      screen.getByText(/không phải đánh giá tuân thủ điều trị/),
    ).toBeVisible()
  })

  it('does not offer occurrence actions while the plan is paused', async () => {
    api.getSupportPlanOccurrences.mockResolvedValue(
      supportPlanOccurrenceListFixture(),
    )

    render(<SupportPlanSchedule planStatus="PAUSED" />)

    expect(await screen.findByText('Đang tạm dừng')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Đã làm' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Bỏ qua' })).toBeNull()
  })
})
