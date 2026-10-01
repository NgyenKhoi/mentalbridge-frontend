import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/image', () => ({
  default: ({ alt, src }: Readonly<{ alt: string; src: string }>) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} src={src} />
  ),
}))

import CommunityMedia from './CommunityMedia'

const media = [
  {
    mediaId: '30000000-0000-4000-8000-000000000001',
    type: 'IMAGE' as const,
    url: 'https://media.example.test/first.webp',
    width: 1200,
    height: 800,
    durationSeconds: null,
    altText: 'Ảnh thứ nhất',
  },
  {
    mediaId: '30000000-0000-4000-8000-000000000002',
    type: 'IMAGE' as const,
    url: 'https://media.example.test/second.webp',
    width: 1200,
    height: 800,
    durationSeconds: null,
    altText: 'Ảnh thứ hai',
  },
]

describe('CommunityMedia', () => {
  it('opens an accessible viewer and moves next and back', async () => {
    const user = userEvent.setup()
    render(<CommunityMedia media={media} />)

    await user.click(
      screen.getByRole('button', { name: 'Mở nội dung đính kèm 1 trên 2' }),
    )
    expect(screen.getByText('Nội dung đính kèm 1/2')).toBeVisible()

    await user.click(screen.getByRole('button', { name: /Tiếp/ }))
    expect(screen.getByText('Nội dung đính kèm 2/2')).toBeVisible()
    expect(screen.getAllByAltText('Ảnh thứ hai')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: /Trước/ }))
    expect(screen.getByText('Nội dung đính kèm 1/2')).toBeVisible()
  })
})
