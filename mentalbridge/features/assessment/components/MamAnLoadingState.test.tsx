import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { MamAnLoadingState } from './MamAnLoadingState'

describe('MamAnLoadingState', () => {
  it('announces the busy state while keeping its visual preview decorative', () => {
    const { container } = render(
      <MamAnLoadingState
        title="Đang chuẩn bị kết quả"
        description="Mầm An đang đối chiếu hai bài sàng lọc của bạn."
        headingLevel="h1"
        preview="history"
      />,
    )

    const status = screen.getByRole('status', {
      name: 'Đang chuẩn bị kết quả',
    })
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(
      screen.getByRole('heading', { name: 'Đang chuẩn bị kết quả', level: 1 }),
    ).toBeVisible()
    expect(screen.getByText('Mầm An đang đồng hành')).toBeVisible()
    expect(container.querySelectorAll('[aria-hidden="true"]')).not.toHaveLength(
      0,
    )
  })
})
