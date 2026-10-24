import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ResourcePlanNotice } from './ResourcePlanNotice'

describe('Resource plan reconciliation notice', () => {
  it('offers a neutral return without asking to confirm an already finished activity', () => {
    render(
      <ResourcePlanNotice
        state="done"
        returnHref="/support-plan"
        onRetry={vi.fn()}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(
      'Hoạt động này không cần xác nhận thêm trong kế hoạch.',
    )
    expect(
      screen.getByRole('link', { name: 'Xem trong kế hoạch' }),
    ).toHaveAttribute('href', '/support-plan')
    expect(screen.queryByText(/Bạn có thể xác nhận/)).toBeNull()
  })

  it('keeps its live region mounted from idle through saving and accepted completion', async () => {
    const onRetry = vi.fn()
    const { rerender } = render(
      <ResourcePlanNotice
        state="idle"
        returnHref="/support-plan"
        onRetry={onRetry}
      />,
    )
    const liveRegion = screen.getByRole('status')
    expect(liveRegion).toBeEmptyDOMElement()
    expect(liveRegion).toHaveAttribute('aria-live', 'polite')
    expect(liveRegion).toHaveAttribute('aria-atomic', 'true')

    rerender(
      <ResourcePlanNotice
        state="pending"
        returnHref="/support-plan"
        onRetry={onRetry}
      />,
    )
    expect(screen.getByRole('status')).toBe(liveRegion)
    expect(liveRegion).toHaveTextContent(
      'Đã lưu bài luyện tập. Đang cập nhật kế hoạch…',
    )
    expect(liveRegion).toHaveAttribute('aria-busy', 'true')
    expect(within(liveRegion).queryByRole('link')).toBeNull()

    rerender(
      <ResourcePlanNotice
        state="recorded"
        returnHref="/support-plan"
        onRetry={onRetry}
      />,
    )
    expect(screen.getByRole('status')).toBe(liveRegion)
    expect(
      await within(liveRegion).findByText('Đã ghi nhận vào kế hoạch hôm nay.'),
    ).toBeInTheDocument()
    expect(liveRegion).toHaveAttribute('aria-busy', 'false')
    expect(
      within(liveRegion).getByRole('link', {
        name: 'Quay lại kế hoạch',
      }),
    ).toHaveAttribute('href', '/support-plan')
    expect(
      within(liveRegion).queryByText('Đã ghi nhận từ bài luyện tập'),
    ).toBeNull()
    expect(
      within(liveRegion).queryByText(/Kết quả hoàn thành đã được ghi nhận/),
    ).toBeNull()
  })
})
