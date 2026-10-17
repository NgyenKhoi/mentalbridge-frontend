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

  it('renders clinical dashboard hero banner, upcoming session, and cards', async () => {
    render(<SpecialistDashboardManager />)

    expect(
      await screen.findByText(/Chào bác sĩ Minh Anh, chúc bạn/),
    ).toBeInTheDocument()
    expect(screen.getByText(/một ngày làm việc an yên/)).toBeInTheDocument()

    // Upcoming session
    expect(screen.getByText(/Hoàng Lan \(28 tuổi\)/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Tham gia phiên video ngay/i })).toHaveAttribute(
      'href',
      '/specialist/appointments',
    )

    // 3 Cards
    expect(screen.getByText('Hàng chờ xử lý (1)')).toBeInTheDocument()
    expect(screen.getByText('Lịch trình tuần này')).toBeInTheDocument()
    expect(screen.getByText('Năng lượng chuyên gia')).toBeInTheDocument()

    // Today's schedule table
    expect(screen.getByText('Lịch trình sắp tới hôm nay')).toBeInTheDocument()
  })

  it('allows toggling online availability status', async () => {
    const user = userEvent.setup()
    render(<SpecialistDashboardManager />)

    const toggle = await screen.findByRole('switch')
    expect(screen.getByText('Đang trực tuyến (Mở lịch hẹn)')).toBeInTheDocument()

    await user.click(toggle)
    expect(screen.getByText('Tạm nghỉ tiếp nhận')).toBeInTheDocument()

    await user.click(toggle)
    expect(screen.getByText('Đang trực tuyến (Mở lịch hẹn)')).toBeInTheDocument()
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
      await screen.findByText(/Chào bác sĩ Minh Anh, chúc bạn/),
    ).toBeInTheDocument()
  })
})
