import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/features/mam/MamCharacter', () => ({
  MamCharacter: ({ size }: { size: number }) => (
    <span data-testid="mam" data-size={size} aria-hidden="true" />
  ),
}))

import Journey from './Journey'

describe('Journey', () => {
  it('shows the 14 days with Mầm as four ordered steps and one start link', () => {
    const { container } = render(<Journey />)

    expect(container.querySelector('section#journey')).not.toBeNull()
    expect(
      screen.getByRole('heading', { level: 2, name: '14 ngày cùng Mầm.' }),
    ).toBeVisible()
    expect(screen.getByText(/Khi bạn chưa biết mình đang bị sao/)).toBeVisible()

    const steps = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(
      steps.map(
        (step) => within(step).getByRole('heading', { level: 3 }).textContent,
      ),
    ).toEqual([
      'Hiểu mình trong 5 phút',
      'Chọn điều bạn muốn nhẹ đi',
      'Mỗi ngày một việc nhỏ cùng Mầm',
      'Ngày 14, thấy thay đổi của chính bạn',
    ])
    expect(
      screen.getByRole('link', { name: 'Bắt đầu 5 phút hiểu mình' }),
    ).toHaveAttribute('href', '/assessment/anonymous')
  })

  it('keeps Mầm decorative with a visible caption', () => {
    render(<Journey />)
    expect(screen.getByTestId('mam')).toHaveAttribute('aria-hidden', 'true')
    expect(screen.getByText('Mầm, người bạn đồng hành')).toBeVisible()
  })
})
