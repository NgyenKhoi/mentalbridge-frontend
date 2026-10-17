import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const navigation = vi.hoisted(() => ({ pathname: '/community' }))
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}))

import CommunityShell from './CommunityShell'

describe('CommunityShell', () => {
  it('keeps peer support separate while preserving safe exits', () => {
    navigation.pathname = '/community'
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
      screen.getAllByRole('link', { name: 'Bảng tin' })[0],
    ).toHaveAttribute('aria-current', 'page')
  })

  it('marks the private saved-post collection without marking the feed', () => {
    navigation.pathname = '/community/saved'

    render(
      <CommunityShell>
        <p>Bộ sưu tập</p>
      </CommunityShell>,
    )

    expect(
      screen.getByRole('link', { name: /Bài viết đã lưu/ }),
    ).toHaveAttribute('aria-current', 'page')
    expect(
      screen.getAllByRole('link', { name: 'Bảng tin' })[0],
    ).not.toHaveAttribute('aria-current')
  })
})
