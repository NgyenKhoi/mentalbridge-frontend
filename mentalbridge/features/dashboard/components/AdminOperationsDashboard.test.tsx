import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminOperationsDashboard } from './AdminOperationsDashboard'
import type { AdminOperationsDashboardResponse } from '../types/admin-operations'

const mockDashboardData: AdminOperationsDashboardResponse = {
  asOf: '2026-10-05T12:00:00.000Z',
  identity: {
    status: 'AVAILABLE',
    source: 'IDENTITY',
    asOf: '2026-10-05T12:00:00.000Z',
    data: {
      total: 100,
      active: 85,
      pendingActivation: 10,
      disabled: 5,
      deletionPending: 0,
      roles: {
        users: 75,
        specialists: 20,
        administrators: 5,
      },
    },
  },
  consultation: {
    status: 'AVAILABLE',
    source: 'CONSULTATION',
    asOf: '2026-10-05T12:00:00.000Z',
    data: {
      specialists: {
        total: 20,
        pendingReview: 4,
        active: 14,
        rejected: 1,
        suspended: 1,
      },
      appointments: {
        total: 45,
        requested: 5,
        confirmed: 15,
        inProgress: 3,
        sessionEnded: 2,
        completed: 18,
        cancelled: 1,
        rejected: 1,
        expired: 0,
        userNoShow: 0,
        specialistNoShow: 0,
        bothNoShow: 0,
      },
    },
  },
  notifications: {
    status: 'AVAILABLE',
    source: 'CONTENT_NOTIFICATION',
    asOf: '2026-10-05T12:00:00.000Z',
    data: {
      inApp: {
        total: 300,
        delivered: 280,
        pending: 10,
        failed: 5,
        cancelled: 5,
        unread: 90,
        read: 190,
      },
      emailReminders: {
        total: 60,
        pending: 2,
        processing: 1,
        delivered: 55,
        failed: 1,
        suppressed: 1,
        invalidated: 0,
      },
    },
  },
  community: {
    status: 'AVAILABLE',
    source: 'COMMUNITY',
    asOf: '2026-10-05T12:00:00.000Z',
    data: {
      openModerationCases: 7,
      totalModerationCases: 25,
    },
  },
  unintegrated: [
    {
      id: 'uptime-sla',
      title: 'Tỷ lệ sẵn sàng nền tảng (Uptime SLA)',
      targetDomain: 'Infrastructure',
      status: 'UNAVAILABLE',
      rationale: 'Chưa có exporter tổng hợp từ hệ thống hạ tầng giám sát.',
      authoritativeOwnerNeeded: 'Platform Infrastructure',
    },
    {
      id: 'platform-security-score',
      title: 'Chỉ số bảo mật (Platform Security Score)',
      targetDomain: 'Compliance',
      status: 'UNAVAILABLE',
      rationale: 'Chưa có hệ thống đánh giá tuân thủ tự động.',
      authoritativeOwnerNeeded: 'SecOps',
    },
  ],
}

describe('AdminOperationsDashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders authoritative metrics, sources and observation timestamps', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboardData,
    } as Response)

    render(<AdminOperationsDashboard />)

    expect(screen.getByText(/Đang tải dữ liệu vận hành/i)).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('Tài khoản người dùng')).toBeInTheDocument()
    })

    expect(screen.getByText('Hồ sơ chuyên gia')).toBeInTheDocument()
    expect(screen.getByText('Lịch hẹn tư vấn')).toBeInTheDocument()
    expect(screen.getByText('Giao nhận thông báo & Nhắc hẹn')).toBeInTheDocument()
    expect(screen.getByText('Kiểm duyệt cộng đồng')).toBeInTheDocument()

    // Sources badges
    expect(screen.getByText('IDENTITY')).toBeInTheDocument()
    expect(screen.getAllByText('CONSULTATION').length).toBeGreaterThan(0)
    expect(screen.getByText('CONTENT_NOTIFICATION')).toBeInTheDocument()

    // Aggregate counts
    expect(screen.getByText('100')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()

    // Verify fabricated metrics are not present
    expect(screen.queryByText('99,98%')).not.toBeInTheDocument()
    expect(screen.queryByText('96/100')).not.toBeInTheDocument()
    expect(screen.queryByText('12.480')).not.toBeInTheDocument()
    expect(screen.queryByText(/Kiểm duyệt viên/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Đang khiếu nại/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Báo cáo đang chờ xử lý/i)).not.toBeInTheDocument()

    // Verify community moderation cases semantics
    expect(screen.getByText('Vụ việc kiểm duyệt đang mở')).toBeInTheDocument()
    expect(screen.getByText('Tổng vụ việc kiểm duyệt')).toBeInTheDocument()

    // Verify appointment states and settlement outcomes are rendered
    expect(screen.getByText('Người dùng vắng mặt (User No-show):')).toBeInTheDocument()
    expect(screen.getByText('Chuyên gia vắng mặt (Specialist No-show):')).toBeInTheDocument()
    expect(screen.getByText('Cả hai vắng mặt (Both No-show):')).toBeInTheDocument()
  })

  it('renders unintegrated metrics clearly marked as UNAVAILABLE', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockDashboardData,
    } as Response)

    render(<AdminOperationsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Chỉ số chưa tích hợp / Chưa có nguồn xác thực')).toBeInTheDocument()
    })

    expect(screen.getByText('Tỷ lệ sẵn sàng nền tảng (Uptime SLA)')).toBeInTheDocument()
    expect(screen.getByText('Chỉ số bảo mật (Platform Security Score)')).toBeInTheDocument()
    expect(screen.getAllByText('UNAVAILABLE').length).toBeGreaterThan(0)
  })

  it('renders partial failure gracefully when a service is UNAVAILABLE', async () => {
    const partialData: AdminOperationsDashboardResponse = {
      ...mockDashboardData,
      consultation: {
        status: 'UNAVAILABLE',
        source: 'CONSULTATION',
        asOf: '2026-10-05T12:00:00.000Z',
        data: null,
        error: 'Consultation service summary is currently unreachable.',
      },
    }

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => partialData,
    } as Response)

    render(<AdminOperationsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Tài khoản người dùng')).toBeInTheDocument()
    })

    // Consultation shows unavailable with safe error
    expect(
      screen.getAllByText('Consultation service summary is currently unreachable.').length,
    ).toBeGreaterThan(0)

    // Identity is still available
    expect(screen.getByText('100')).toBeInTheDocument()
  })

  it('renders STALE banner and badge when refresh fails after successful load', async () => {
    vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockDashboardData,
      } as Response)
      .mockRejectedValueOnce(new Error('Network error'))

    render(<AdminOperationsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Tài khoản người dùng')).toBeInTheDocument()
    })

    const refreshButton = screen.getByRole('button', { name: /Làm mới dữ liệu/i })
    fireEvent.click(refreshButton)

    await waitFor(() => {
      expect(screen.getByText(/Dữ liệu đang hiển thị có thể bị cũ \(STALE\)/i)).toBeInTheDocument()
    })

    expect(screen.getAllByText('STALE').length).toBeGreaterThan(0)
    // Data remains rendered
    expect(screen.getByText('100')).toBeInTheDocument()
  })
})

