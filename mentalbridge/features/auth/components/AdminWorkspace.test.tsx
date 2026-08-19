import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./SessionActions', () => ({
  default: () => <div>Session actions</div>,
}))

import AdminWorkspace from './AdminWorkspace'

describe('AdminWorkspace', () => {
  it('renders protected navigation without fabricated sensitive records', () => {
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
      screen.getByRole('heading', { name: 'Quyền ADMIN đã được xác minh' }),
    ).toBeVisible()
    expect(container).not.toHaveTextContent('@example.com')
    expect(container).not.toHaveTextContent('Nguyễn Minh Anh')
    expect(container).not.toHaveTextContent('12.480')
  })
})
