import { fireEvent, render, screen } from '@testing-library/react'
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
    expect(
      container.querySelector('[data-loading-preview="history"]'),
    ).toBeInTheDocument()
    expect(
      container.querySelectorAll('[data-skeleton-part="history-card"]'),
    ).toHaveLength(2)
    expect(
      container.querySelector('[data-loading-preview="meaning"]'),
    ).not.toBeInTheDocument()
  })

  it('matches the approved result-loading composition and dismisses only the breathing cue', () => {
    const { container } = render(
      <MamAnLoadingState
        title="Đang tải và tổng hợp kết quả của bạn"
        description="Hãy hít thở nhẹ nhàng cùng Mầm An nhé."
        preview="meaning"
      />,
    )

    const status = screen.getByRole('status', {
      name: 'Đang tải và tổng hợp kết quả của bạn',
    })
    const stepper = container.querySelector('[data-skeleton-region="stepper"]')

    expect(stepper).not.toBeNull()
    expect(stepper?.children).toHaveLength(7)
    expect(
      container.querySelectorAll('[data-skeleton-part="score-card"]'),
    ).toHaveLength(2)
    expect(
      container.querySelector('[data-skeleton-part="meaning-card"]'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Gợi ý nhịp thở vi mô')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Ẩn gợi ý nhịp thở' }))

    expect(
      screen.queryByLabelText('Gợi ý nhịp thở vi mô'),
    ).not.toBeInTheDocument()
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(stepper).toBeInTheDocument()
    expect(
      container.querySelectorAll('[data-skeleton-part="score-card"]'),
    ).toHaveLength(2)
    expect(
      container.querySelector('[data-skeleton-part="meaning-card"]'),
    ).toBeInTheDocument()
  })
})
