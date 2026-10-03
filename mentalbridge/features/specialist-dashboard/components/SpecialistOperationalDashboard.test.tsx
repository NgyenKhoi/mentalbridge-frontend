import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SpecialistDashboard } from '@/lib/consultation/consultation-validation'
import SpecialistOperationalDashboard from './SpecialistOperationalDashboard'

const api = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('../api/browser-client', () => ({
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
    state: 'AVAILABLE',
    count: 2,
    localDate: null,
    timezone: 'Asia/Ho_Chi_Minh',
    items: [
      {
        ...appointment,
        appointmentId: '20a7e5d8-7960-42fb-9706-e642f849b78f',
        status: 'REQUESTED',
        decisionDeadlineAt: '2026-10-03T05:00:00Z',
      },
    ],
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
  actionRequired: [
    {
      source: 'CONSULTATION',
      asOf,
      type: 'REVIEW_APPOINTMENT_REQUESTS',
      count: 2,
    },
    {
      source: 'CONSULTATION',
      asOf,
      type: 'PUBLISH_AVAILABILITY',
      count: 1,
    },
  ],
} satisfies SpecialistDashboard

describe('SpecialistOperationalDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue(readyDashboard)
  })

  it('shows live bounded operational facts without demo client data', async () => {
    render(<SpecialistOperationalDashboard />)

    expect(
      await screen.findByText('Chào bạn, Chuyên gia An'),
    ).toBeInTheDocument()
    expect(screen.getByText('Phiên đã xác nhận hôm nay')).toBeInTheDocument()
    expect(screen.getByText('2', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.getByText('Chat trong ứng dụng')).toBeInTheDocument()
    expect(screen.getByText(/Nguồn: lịch tư vấn/)).toBeInTheDocument()
    expect(screen.queryByText('Nguyễn Minh Anh')).not.toBeInTheDocument()
    expect(
      screen.getAllByRole('link', {
        name: /Phản hồi yêu cầu đặt lịch/,
      })[0],
    ).toHaveAttribute('href', '/specialist/appointments')
  })

  it('fails closed when the profile is suspended', async () => {
    api.get.mockResolvedValue({
      ...readyDashboard,
      operationalStatus: 'SUSPENDED',
      profile: {
        ...readyDashboard.profile,
        approvalStatus: 'SUSPENDED',
      },
      todayConfirmedSessions: {
        ...readyDashboard.todayConfirmedSessions,
        state: 'BLOCKED',
        count: 0,
        localDate: null,
        items: [],
      },
      pendingAppointmentRequests: {
        ...readyDashboard.pendingAppointmentRequests,
        state: 'BLOCKED',
        count: 0,
        items: [],
      },
      nextAppointment: {
        ...readyDashboard.nextAppointment,
        state: 'BLOCKED',
        item: null,
      },
      availability: {
        ...readyDashboard.availability,
        state: 'BLOCKED',
      },
      actionRequired: [
        {
          source: 'CONSULTATION',
          asOf,
          type: 'CONTACT_SUPPORT',
          count: 1,
        },
      ],
    })

    render(<SpecialistOperationalDashboard />)

    expect(
      await screen.findByText('Quyền vận hành đang tạm ngưng'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Dữ liệu vận hành đang được bảo vệ/),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Phiên đã xác nhận hôm nay'),
    ).not.toBeInTheDocument()
  })

  it('shows an unavailable state and retries', async () => {
    api.get
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(readyDashboard)
    const user = userEvent.setup()
    render(<SpecialistOperationalDashboard />)

    await user.click(await screen.findByRole('button', { name: 'Thử tải lại' }))

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    expect(
      await screen.findByText('Chào bạn, Chuyên gia An'),
    ).toBeInTheDocument()
  })
})
