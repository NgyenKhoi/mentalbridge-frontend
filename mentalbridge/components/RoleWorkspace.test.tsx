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
  default: ({ displayName }: { displayName: string }) => (
    <button type="button">{displayName}</button>
  ),
}))
vi.mock('@/features/specialist-profile/api/browser-client', () => ({
  browserConsultation: {
    own: vi
      .fn()
      .mockResolvedValue({ data: { displayName: 'Chuyên gia từ hồ sơ' } }),
  },
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
vi.mock(
  '@/features/notifications/components/SpecialistNotificationCenter',
  () => ({ default: () => <h1>Trung tâm thông báo thật</h1> }),
)

const props = {
  role: 'specialist' as const,
  workspaces: [],
}

describe('RoleWorkspace specialist production closure', () => {
  it('keeps the new navigation and renders the authenticated profile identity', async () => {
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
    expect(screen.getByRole('link', { name: 'Thông báo' })).toHaveAttribute(
      'href',
      '/specialist/notifications',
    )
    expect(
      await within(screen.getByRole('complementary')).findByRole('button', {
        name: 'Chuyên gia từ hồ sơ',
      }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Người dùng')).not.toBeInTheDocument()
  })

  it('does not expose unsupported appointment creation actions or modalities', async () => {
    render(<RoleWorkspace {...props} sectionKey="appointments" />)
    await screen.findByRole('button', { name: 'Chuyên gia từ hồ sơ' })

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

  it('renders the authoritative specialist earnings destination', async () => {
    render(<RoleWorkspace {...props} sectionKey="earnings" />)
    await screen.findByRole('button', { name: 'Chuyên gia từ hồ sơ' })

    expect(screen.getByRole('heading', { name: 'Thu nhập thật' })).toBeVisible()
  })

  it.each([['notifications', 'Trung tâm thông báo thật']])(
    'shows the owner-backed state for %s',
    async (sectionKey, heading) => {
      render(<RoleWorkspace {...props} sectionKey={sectionKey} />)
      await screen.findByRole('button', { name: 'Chuyên gia từ hồ sơ' })

      expect(screen.getByRole('heading', { name: heading })).toBeVisible()
      expect(
        screen.queryByText(/8\.400\.000|6\.800\.000|PayOS/),
      ).not.toBeInTheDocument()
      expect(screen.queryByText('Nguyễn Minh Anh')).not.toBeInTheDocument()
    },
  )
})
