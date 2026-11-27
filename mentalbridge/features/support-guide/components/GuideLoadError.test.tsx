import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import GuideLoadError from './GuideLoadError'

describe('GuideLoadError', () => {
  it('shows a busy retry and ignores repeated clicks until the retry settles', async () => {
    let settle: () => void = () => undefined
    const onRetry = vi.fn(
      () => new Promise<void>((resolve) => (settle = resolve)),
    )
    render(<GuideLoadError message="Thử lại sau." onRetry={onRetry} />)

    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    const busy = screen.getByRole('button', { name: 'Đang thử lại…' })
    expect(busy).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(busy)
    expect(onRetry).toHaveBeenCalledTimes(1)

    settle()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Thử lại' })).toBeVisible(),
    )
  })
})
