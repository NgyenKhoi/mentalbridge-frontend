import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SpecialistDashboard } from '@/lib/consultation/consultation-validation'
import { ApiError } from '@/lib/api/api-error'
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
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
    api.get.mockResolvedValue(readyDashboard)
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('renders clinical dashboard hero banner, upcoming session, and cards', async () => {
    render(<SpecialistDashboardManager />)

    expect(
      await screen.findByText('Chào bác sĩ Minh Anh, chúc bạn'),
    ).toBeInTheDocument()
    expect(screen.getByText('một ngày làm việc an yên')).toBeInTheDocument()

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
      await screen.findByText('Chào bác sĩ Minh Anh, chúc bạn'),
    ).toBeInTheDocument()
  })

  it('preserves last loaded facts after a transient refresh failure', async () => {
    const user = userEvent.setup()
    render(<SpecialistDashboardManager />)
    await screen.findByText('Chào bạn, Chuyên gia An')
    const updateTime = screen.getByText(/Cập nhật lúc/).textContent
    api.get.mockRejectedValueOnce(new Error('offline'))
    await user.click(screen.getByRole('button', { name: 'Làm mới' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'lần tải thành công gần nhất',
    )
    expect(screen.getByText(/Cập nhật lúc/)).toHaveTextContent(updateTime!)
    expect(
      screen.getByLabelText('4.7 trên 5 từ 3 đánh giá'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mở tin nhắn' })).toHaveAttribute(
      'href',
      '/specialist/messages?appointmentId=' + appointment.appointmentId,
    )
  })

  it('clears protected facts when access is revoked on refresh', async () => {
    const user = userEvent.setup()
    render(<SpecialistDashboardManager />)
    await screen.findByText('Chào bạn, Chuyên gia An')
    api.get.mockRejectedValueOnce(
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'denied' }),
    )
    await user.click(screen.getByRole('button', { name: 'Làm mới' }))
    await screen.findByText(
      'Tài khoản hiện tại không có quyền xem tổng quan chuyên gia.',
    )
    expect(
      screen.queryByText('Chào bạn, Chuyên gia An'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Mở tin nhắn' }),
    ).not.toBeInTheDocument()
  })

  it('distinguishes unavailable projections from empty collections', async () => {
    api.get.mockResolvedValue({
      ...readyDashboard,
      availability: { ...readyDashboard.availability, state: 'UNAVAILABLE' },
      ratingAggregate: {
        ...readyDashboard.ratingAggregate,
        state: 'UNAVAILABLE',
        averageRating: null,
      },
    })
    render(<SpecialistDashboardManager />)
    await screen.findByText('Chào bạn, Chuyên gia An')
    const metric = screen.getByText('Khung giờ đang mở').closest('a')!
    expect(within(metric).getByText('—')).toBeInTheDocument()
    expect(within(metric).queryByText('0')).not.toBeInTheDocument()
    expect(screen.queryByText('Chưa có đánh giá')).not.toBeInTheDocument()
  })

  it('routes requested appointments to review and never opens chat for video', async () => {
    const requested = {
      ...appointment,
      appointmentId: 'request-1',
      status: 'REQUESTED',
    }
    api.get.mockResolvedValue({
      ...readyDashboard,
      nextAppointment: {
        ...readyDashboard.nextAppointment,
        item: { ...appointment, modality: 'IN_APP_VIDEO' },
      },
      pendingAppointmentRequests: {
        ...readyDashboard.pendingAppointmentRequests,
        state: 'AVAILABLE',
        count: 1,
        items: [requested],
      },
    })
    render(<SpecialistDashboardManager />)
    await screen.findByText('Chào bạn, Chuyên gia An')
    expect(screen.getByRole('link', { name: 'Xem yêu cầu' })).toHaveAttribute(
      'href',
      '/specialist/appointments?appointmentId=request-1',
    )
    expect(
      screen.queryByRole('link', { name: 'Mở tin nhắn' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Xác nhận lịch/ }),
    ).not.toBeInTheDocument()
  })

  it.each([
    ['PROFILE_REQUIRED', 'Cần hoàn thiện hồ sơ'],
    ['PENDING_APPROVAL', 'Hồ sơ đang được xét duyệt'],
    ['PROFILE_REJECTED', 'Hồ sơ cần được cập nhật'],
    ['SUSPENDED', 'Quyền vận hành đang tạm ngưng'],
  ] as const)(
    'shows only profile actions when operational status is %s',
    async (status, title) => {
      api.get.mockResolvedValue({
        ...readyDashboard,
        operationalStatus: status,
      })
      render(<SpecialistDashboardManager />)
      await screen.findByRole('heading', { name: title })
      expect(screen.getByRole('link', { name: /Xem hồ sơ/ })).toHaveAttribute(
        'href',
        '/specialist/profile',
      )
      expect(
        screen.queryByRole('link', { name: 'Mở tin nhắn' }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('link', { name: 'Chuẩn bị cho phiên' }),
      ).not.toBeInTheDocument()
      expect(
        screen.queryByRole('region', { name: 'Tổng quan nhanh' }),
      ).not.toBeInTheDocument()
      expect(document.querySelector('img[alt=""]')).toBeNull()
    },
  )

  it('does not reveal stale next-session actions from an unavailable projection', async () => {
    api.get.mockResolvedValue({
      ...readyDashboard,
      nextAppointment: {
        ...readyDashboard.nextAppointment,
        state: 'UNAVAILABLE',
      },
    })
    render(<SpecialistDashboardManager />)
    await screen.findByText('Chào bạn, Chuyên gia An')
    const next = screen.getByRole('region', { name: 'Phiên hẹn tiếp theo' })
    expect(within(next).getByText('Chưa tải được dữ liệu')).toBeInTheDocument()
    expect(within(next).queryByRole('link')).not.toBeInTheDocument()
  })
})
