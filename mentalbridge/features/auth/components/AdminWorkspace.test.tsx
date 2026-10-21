import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./SessionActions', () => ({
  default: () => <div>Session actions</div>,
}))

vi.mock('@/components/AdminDashboardManager', () => ({
  ProductJourneyMetricsPanel: () => (
    <section aria-label="Product journey metrics">
      Authoritative journey
    </section>
  ),
}))

vi.mock(
  '@/features/reconciliation/components/AdminCommercialReconciliationManager',
  () => ({
    default: () => (
      <section aria-label="Commercial reconciliation">
        Authoritative reconciliation
      </section>
    ),
  }),
)

import AdminWorkspace from './AdminWorkspace'

describe('AdminWorkspace', () => {
  it('renders the product journey consumer on the real protected admin dashboard', () => {
    const { container } = render(
      <AdminWorkspace
        section="dashboard"
        workspaces={[
          { role: 'ADMIN', label: 'Quản trị', path: '/admin/dashboard' },
        ]}
      />,
    )

    expect(
      screen.getByRole('navigation', { name: 'Điều hướng quản trị' }),
    ).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Product journey metrics' }),
    ).toBeVisible()
    expect(container).not.toHaveTextContent('@example.com')
    expect(container).not.toHaveTextContent('Nguyễn Minh Anh')
    expect(container).not.toHaveTextContent('12.480')
    expect(screen.getByRole('link', { name: 'Báo cáo' })).toHaveAttribute(
      'href',
      '/admin/reports',
    )
    expect(
      screen.getByRole('link', { name: 'Thanh toán gói' }),
    ).toHaveAttribute('href', '/admin/payments')
    expect(
      screen.getByRole('link', { name: 'Chi trả chuyên gia' }),
    ).toHaveAttribute('href', '/admin/payouts')
    expect(
      screen.getByRole('link', { name: 'Đối soát thương mại' }),
    ).toHaveAttribute('href', '/admin/reconciliation')
  })

  it('renders commercial reconciliation manager on /admin/reconciliation section', () => {
    render(
      <AdminWorkspace
        section="reconciliation"
        workspaces={[
          { role: 'ADMIN', label: 'Quản trị', path: '/admin/reconciliation' },
        ]}
      />,
    )

    expect(
      screen.getByRole('region', { name: 'Commercial reconciliation' }),
    ).toBeVisible()
    expect(
      screen.getByText('Authoritative reconciliation'),
    ).toBeInTheDocument()
  })
})
