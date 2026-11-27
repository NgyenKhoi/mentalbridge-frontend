import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import CommunitySensitiveContent from './CommunitySensitiveContent'

describe('CommunitySensitiveContent', () => {
  it('keeps warned content concealed until an explicit reveal and allows hiding it again', async () => {
    const user = userEvent.setup()
    render(
      <CommunitySensitiveContent warned>
        <p>Chi tiết câu chuyện cần được chuẩn bị trước.</p>
      </CommunitySensitiveContent>,
    )

    expect(screen.getByText('Nội dung nhạy cảm')).toBeVisible()
    expect(
      screen.queryByText('Chi tiết câu chuyện cần được chuẩn bị trước.'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Cần hỗ trợ ngay' }),
    ).toHaveAttribute('href', '/safety-directory')

    await user.click(screen.getByRole('button', { name: 'Xem nội dung' }))
    expect(
      screen.getByText('Chi tiết câu chuyện cần được chuẩn bị trước.'),
    ).toBeVisible()
    expect(
      screen.getByRole('button', { name: 'Ẩn lại nội dung' }),
    ).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('button', { name: 'Ẩn lại nội dung' }))
    expect(
      screen.queryByText('Chi tiết câu chuyện cần được chuẩn bị trước.'),
    ).not.toBeInTheDocument()
  })

  it('renders unmarked content without an interstitial', () => {
    render(
      <CommunitySensitiveContent warned={false}>
        <p>Nội dung thông thường.</p>
      </CommunitySensitiveContent>,
    )

    expect(screen.getByText('Nội dung thông thường.')).toBeVisible()
    expect(screen.queryByText('Nội dung nhạy cảm')).not.toBeInTheDocument()
  })
})
