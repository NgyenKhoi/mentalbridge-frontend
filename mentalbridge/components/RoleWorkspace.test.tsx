import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import RoleWorkspace from './RoleWorkspace'

vi.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get: (_, element: string) => element,
    },
  ),
}))
vi.mock('@/features/auth/components/SessionActions', () => ({
  default: () => <button type="button">Người dùng</button>,
}))
vi.mock('@/features/auth/components/WorkspaceSwitcher', () => ({
  default: () => null,
}))
vi.mock('./SpecialistWorkspaceIdentity', () => ({
  default: () => <div>Chuyên gia từ hồ sơ</div>,
}))
vi.mock('./SpecialistDashboardManager', () => ({
  default: () => <h1>Tổng quan thật</h1>,
}))
vi.mock(
  '@/features/specialist-analytics/components/SpecialistOperationalAnalytics',
  () => ({ default: () => <h1>Phân tích vận hành thật</h1> }),
)
vi.mock(
  '@/features/appointments/components/SpecialistAppointmentDecisionPanel',
  () => ({ default: () => <h1>Lịch hẹn thật</h1> }),
)
vi.mock(
  '@/features/specialist-availability/components/SpecialistAvailabilityManager',
  () => ({ default: () => <h1>Lịch khả dụng thật</h1> }),
)
vi.mock('./SpecialistClientsManager', () => ({
  default: () => <h1>Khách hàng thật</h1>,
}))
vi.mock(
  '@/features/appointments/components/AppointmentMessagesWorkspace',
  () => ({ default: () => <h1>Tin nhắn thật</h1> }),
)
vi.mock(
  '@/features/appointments/components/SpecialistContinuityManager',
  () => ({ default: () => <h1>Tiếp nối thật</h1> }),
)
vi.mock(
  '@/features/specialist-profile/components/SpecialistProfileWorkspace',
  () => ({ default: () => <h1>Hồ sơ thật</h1> }),
)
vi.mock('./SpecialistEarningsManager', () => ({
  default: () => <h1>Thu nhập thật</h1>,
}))

const props = {
  role: 'specialist' as const,
  workspaces: [],
}

describe('RoleWorkspace specialist production closure', () => {
  it('exposes only owner-backed destinations without a fixed notification badge', () => {
    render(<RoleWorkspace {...props} sectionKey="dashboard" />)

    const navigation = screen.getByRole('navigation', {
      name: 'Điều hướng specialist',
    })
    expect(within(navigation).getAllByRole('link')).toHaveLength(9)
    expect(
      within(navigation).getByRole('link', { name: /Phân tích vận hành/i }),
    ).toBeInTheDocument()
    expect(
      within(navigation).getByRole('link', { name: /Thu nhập/i }),
    ).toBeInTheDocument()
    expect(
      within(navigation).queryByRole('link', { name: /Notifications/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('3')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Thông báo')).not.toBeInTheDocument()
    expect(within(screen.getByRole('complementary')).getByText('Chuyên gia từ hồ sơ')).toBeInTheDocument()
    expect(screen.queryByText('Người dùng')).not.toBeInTheDocument()
  })

  it('does not expose unsupported appointment creation actions or modalities', () => {
    render(<RoleWorkspace {...props} sectionKey="appointments" />)

    expect(screen.getByRole('heading', { name: 'Lịch hẹn thật' })).toBeVisible()
    expect(
      screen.queryByRole('button', { name: /Tạo mới|Tạo lịch hẹn/i }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/30 phút|45 phút|90 phút/),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByText(/Điện thoại|Tại phòng tư vấn/),
    ).not.toBeInTheDocument()
  })

  it('renders the authoritative specialist earnings destination', () => {
    render(<RoleWorkspace {...props} sectionKey="earnings" />)

    expect(screen.getByRole('heading', { name: 'Thu nhập thật' })).toBeVisible()
  })

  it.each([['notifications', 'Trung tâm thông báo chưa khả dụng']])(
    'shows truthful deferred state for %s',
    (sectionKey, heading) => {
    render(<RoleWorkspace {...props} sectionKey={sectionKey} />)

    expect(screen.getByRole('heading', { name: heading })).toBeVisible()
    expect(
      screen.queryByText(/8\.400\.000|6\.800\.000|PayOS/),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Nguyễn Minh Anh')).not.toBeInTheDocument()
    },
  )
})
