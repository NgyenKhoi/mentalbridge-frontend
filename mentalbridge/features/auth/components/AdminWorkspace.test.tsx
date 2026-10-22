import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./SessionActions', () => ({
  default: () => <div>Session actions</div>,
}))

vi.mock('./WorkspaceSwitcher', () => ({
  default: () => <div>Workspace switcher</div>,
}))

vi.mock('@/features/dashboard/components/AdminOperationsDashboard', () => ({
  default: () => <section aria-label="operations-dashboard" />,
}))

vi.mock('@/components/AdminDashboardManager', () => ({
  ProductJourneyMetricsPanel: () => (
    <section aria-label="product-journey-metrics" />
  ),
}))

vi.mock('./AdminAccountManager', () => ({
  default: () => <section aria-label="accounts-authority" />,
}))

vi.mock(
  '@/features/specialist-profile/components/AdminSpecialistReviewSection',
  () => ({
    default: () => <section aria-label="specialists-authority" />,
  }),
)

vi.mock('./AdminContentSection', () => ({
  default: () => <section aria-label="content-authority" />,
}))

vi.mock(
  '@/features/community/components/AdminCommunityModerationSection',
  () => ({
    default: () => <section aria-label="moderation-authority" />,
  }),
)

vi.mock('@/features/appointments/components/AdminAppointmentMonitor', () => ({
  default: () => <section aria-label="appointments-authority" />,
}))

vi.mock('@/features/appointments/components/AdminAppointmentDisputes', () => ({
  default: () => <section aria-label="disputes-authority" />,
}))

vi.mock('@/features/audit/components/AdminAuditLog', () => ({
  default: () => <section aria-label="audit-authority" />,
}))

vi.mock('@/features/reports/components/AdminReportsSection', () => ({
  default: () => <section aria-label="reports-authority" />,
}))

vi.mock('@/components/AdminPaymentsManager', () => ({
  default: () => <section aria-label="payments-authority" />,
}))

vi.mock('@/components/AdminPayoutsManager', () => ({
  default: () => <section aria-label="payouts-authority" />,
}))

vi.mock(
  '@/features/reconciliation/components/AdminCommercialReconciliationManager',
  () => ({
    default: () => <section aria-label="reconciliation-authority" />,
  }),
)

import AdminWorkspace, { type AdminSection } from './AdminWorkspace'

const workspaces = [
  { role: 'ADMIN' as const, label: 'Quản trị', path: '/admin/dashboard' },
]

function renderSection(section: AdminSection) {
  return render(<AdminWorkspace section={section} workspaces={workspaces} />)
}

describe('AdminWorkspace', () => {
  it('exposes only the consolidated authoritative admin routes', () => {
    const { container } = renderSection('dashboard')
    const navigation = screen.getByRole('navigation', {
      name: 'Điều hướng quản trị',
    })

    expect(within(navigation).getAllByRole('link')).toHaveLength(12)
    expect(
      within(navigation)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual([
      '/admin/dashboard',
      '/admin/accounts',
      '/admin/specialists',
      '/admin/content',
      '/admin/moderation',
      '/admin/appointments',
      '/admin/disputes',
      '/admin/audit',
      '/admin/reports',
      '/admin/payments',
      '/admin/payouts',
      '/admin/reconciliation',
    ])
    expect(container).not.toHaveTextContent('@example.com')
    expect(container).not.toHaveTextContent('Nguyễn Minh Anh')
    expect(container).not.toHaveTextContent('12.480')
    expect(
      screen.getByRole('link', { name: 'Thanh toán gói' }),
    ).toHaveAttribute('href', '/admin/payments')
    expect(
      screen.getByRole('link', { name: 'Chi trả chuyên gia' }),
    ).toHaveAttribute('href', '/admin/payouts')
    expect(
      screen.getByRole('link', { name: 'Đối soát thương mại' }),
    ).toHaveAttribute('href', '/admin/reconciliation')
    expect(
      within(navigation).queryByRole('link', { name: /assessment|AI/i }),
    ).not.toBeInTheDocument()
  })

  it('combines the authoritative operations and journey projections on the dashboard', () => {
    renderSection('dashboard')

    expect(
      screen.getByRole('region', { name: 'operations-dashboard' }),
    ).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'product-journey-metrics' }),
    ).toBeVisible()
  })

  it.each([
    ['accounts', 'accounts-authority'],
    ['specialists', 'specialists-authority'],
    ['content', 'content-authority'],
    ['moderation', 'moderation-authority'],
    ['appointments', 'appointments-authority'],
    ['disputes', 'disputes-authority'],
    ['audit', 'audit-authority'],
    ['reports', 'reports-authority'],
    ['payments', 'payments-authority'],
    ['payouts', 'payouts-authority'],
    ['reconciliation', 'reconciliation-authority'],
  ] satisfies ReadonlyArray<readonly [AdminSection, string]>)(
    'maps /admin/%s to its delivered owner-backed section',
    (section, accessibleName) => {
      renderSection(section)

      expect(screen.getByRole('region', { name: accessibleName })).toBeVisible()
    },
  )
})