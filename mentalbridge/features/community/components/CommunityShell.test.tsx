import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/community',
}))

import CommunityShell from './CommunityShell'

describe('CommunityShell', () => {
  it('keeps peer support separate while preserving safe exits', () => {
    render(
      <CommunityShell>
        <p>Nội dung cộng đồng</p>
      </CommunityShell>,
    )

    expect(screen.getByText('Nội dung cộng đồng')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Cộng đồng MentalBridge' }),
    ).toHaveAttribute('href', '/community')
    expect(
      screen.getAllByRole('link', { name: 'Cần hỗ trợ ngay' })[0],
    ).toHaveAttribute('href', '/safety-directory')
    expect(
      screen.getByRole('link', { name: /Về không gian của bạn/ }),
    ).toHaveAttribute('href', '/dashboard')
    expect(
      screen.getByRole('link', { name: /Bảng tin đồng hành/ }),
    ).toHaveAttribute('aria-current', 'page')
  })
})
