import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ detail: vi.fn() }))
vi.mock('@/features/resources/api/browser-resources', () => ({
  getResourceDetail: api.detail,
}))

import CommunityResourceAttachment from './CommunityResourceAttachment'

const resourceId = '40000000-0000-4000-8000-000000000001'

describe('CommunityResourceAttachment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('resolves current reviewed metadata and links to the Resources experience', async () => {
    api.detail.mockResolvedValue({
      id: resourceId,
      title: 'Thở chậm trong hai phút',
      resourceKind: 'PRACTICE',
      contentBody: 'Nội dung này không được sao chép vào Community.',
      contentVersionLabel: 'Không hiển thị nhãn này',
    })
    render(<CommunityResourceAttachment resourceId={resourceId} />)

    const link = await screen.findByRole('link', {
      name: 'Mở tài nguyên Thở chậm trong hai phút',
    })
    expect(link).toHaveAttribute('href', `/resources/${resourceId}`)
    expect(screen.getByText('Thực hành')).toBeVisible()
    expect(screen.queryByText(/Nội dung này/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Không hiển thị nhãn/)).not.toBeInTheDocument()
  })

  it('shows a truthful unavailable state without exposing a dead link', async () => {
    const user = userEvent.setup()
    api.detail
      .mockRejectedValueOnce(new Error('not found'))
      .mockRejectedValueOnce(new Error('still unavailable'))
    render(<CommunityResourceAttachment resourceId={resourceId} />)

    expect(
      await screen.findByText('Tài nguyên này hiện không còn khả dụng'),
    ).toBeVisible()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thử tải lại' }))
    expect(api.detail).toHaveBeenCalledTimes(2)
  })
})
