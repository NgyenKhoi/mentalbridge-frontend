import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SpecialistDashboard } from '@/lib/consultation/consultation-validation'
import SpecialistDashboardManager from './SpecialistDashboardManager'

const api = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('@/features/specialist-dashboard/api/browser-client', () => ({
  specialistDashboardBrowserClient: api,
}))

const asOf = '2026-10-03T02:00:00Z'
const appointment = {
  source: 'CONSULTATION' as const,
  asOf,
  appointmentId: '10a7e5d8-7960-42fb-9706-e642f849b78f',
  status: 'CONFIRMED' as const,
  modality: 'IN_APP_CHAT' as const,
  scheduledStartAt: '2026-10-03T03:00:00Z',
  scheduledEndAt: '2026-10-03T04:00:00Z',
  timezone: 'Asia/Ho_Chi_Minh',
  decisionDeadlineAt: '2026-10-02T03:00:00Z',
}

const readyDashboard = {
  source: 'CONSULTATION',
  generatedAt: asOf,
  operationalStatus: 'READY',
  profile: {
    source: 'CONSULTATION',
    asOf,
    state: 'AVAILABLE',
    displayName: 'Chuyên gia An',
    timezone: 'Asia/Ho_Chi_Minh',
    approvalStatus: 'APPROVED',
  },
  ratingAggregate: {
    source: 'CONSULTATION',
    asOf,
    state: 'AVAILABLE',
    averageRating: 4.67,
    ratingCount: 3,
  },
  todayConfirmedSessions: {
    source: 'CONSULTATION',
    asOf,
    state: 'AVAILABLE',
    count: 1,
    localDate: '2026-10-03',
    timezone: 'Asia/Ho_Chi_Minh',
    items: [appointment],
  },
  pendingAppointmentRequests: {
    source: 'CONSULTATION',
    asOf,
    state: 'EMPTY',
    count: 0,
    localDate: null,
    timezone: 'Asia/Ho_Chi_Minh',
    items: [],
  },
  nextAppointment: {
    source: 'CONSULTATION',
    asOf,
    state: 'AVAILABLE',
    item: appointment,
  },
  availability: {
    source: 'CONSULTATION',
    asOf,
    state: 'EMPTY',
    count: 0,
    items: [],
  },
  actionRequired: [],
} satisfies SpecialistDashboard

describe('SpecialistDashboardManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue(readyDashboard)
  })

  it('keeps the command dashboard layout and shows the compact real rating', async () => {
    render(<SpecialistDashboardManager />)

    expect(
      await screen.findByText('Chào bạn, Chuyên gia An'),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('4.7 trên 5 từ 3 đánh giá'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === 'P' &&
          element.textContent?.includes('60 phút') === true,
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('45 phút')).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: /Mở phiên tiếp theo/ }),
    ).toHaveAttribute('href', '/specialist/appointments')
  })

  it('does not fabricate a zero score when nobody has rated yet', async () => {
    api.get.mockResolvedValue({
      ...readyDashboard,
      ratingAggregate: {
        ...readyDashboard.ratingAggregate,
        state: 'EMPTY',
        averageRating: null,
        ratingCount: 0,
      },
    })

    render(<SpecialistDashboardManager />)

    expect(
      await screen.findByLabelText('Chưa có đánh giá từ người dùng'),
    ).toBeInTheDocument()
    expect(screen.getByText('Chưa có điểm')).toBeInTheDocument()
    expect(screen.queryByText('0.0')).not.toBeInTheDocument()
  })

  it('keeps a local recovery action when dashboard loading fails', async () => {
    api.get
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(readyDashboard)
    const user = userEvent.setup()

    render(<SpecialistDashboardManager />)
    await user.click(await screen.findByRole('button', { name: 'Thử lại' }))

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    expect(
      await screen.findByText('Chào bạn, Chuyên gia An'),
    ).toBeInTheDocument()
  })
})
