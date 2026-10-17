import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import CrisisSupportWidget from './CrisisSupportWidget'

describe('CrisisSupportWidget', () => {
  it('keeps the hotline panel closed until the global action is selected', () => {
    render(<CrisisSupportWidget />)

    expect(
      screen.getByRole('button', { name: 'Mở hỗ trợ khẩn cấp' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows approved default numbers without authentication or a form', async () => {
    const user = userEvent.setup()
    render(<CrisisSupportWidget />)

    await user.click(screen.getByRole('button', { name: 'Mở hỗ trợ khẩn cấp' }))

    expect(
      screen.getByRole('dialog', { name: 'Bảng hỗ trợ khẩn cấp' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Bạn không đơn độc')).toBeInTheDocument()
    expect(
      screen.getByRole('link', {
        name: 'Gọi Tổng đài khẩn cấp quốc gia số 112',
      }),
    ).toHaveAttribute('href', 'tel:112')
    expect(
      screen.getByRole('link', { name: 'Gọi Cấp cứu y tế số 115' }),
    ).toHaveAttribute('href', 'tel:115')
    expect(screen.queryByRole('form')).not.toBeInTheDocument()
    expect(screen.queryByText(/đăng nhập để/i)).not.toBeInTheDocument()
  })

  it('links to public follow-up support already available in the app', async () => {
    const user = userEvent.setup()
    render(<CrisisSupportWidget />)

    await user.click(screen.getByRole('button', { name: 'Mở hỗ trợ khẩn cấp' }))

    expect(
      screen.getByRole('link', { name: 'Tìm cơ sở gần bạn' }),
    ).toHaveAttribute('href', '/safety-directory')
    expect(
      screen.getByRole('link', { name: 'Bài tập ổn định cảm xúc' }),
    ).toHaveAttribute('href', '/resources')
    expect(
      screen.queryByRole('link', { name: /chuyên gia trực/i }),
    ).not.toBeInTheDocument()
  })

  it('closes with Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<CrisisSupportWidget />)
    const trigger = screen.getByRole('button', {
      name: 'Mở hỗ trợ khẩn cấp',
    })

    await user.click(trigger)
    expect(
      screen.getByRole('button', { name: 'Đóng bảng hỗ trợ khẩn cấp' }),
    ).toHaveFocus()

    await user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('keeps keyboard focus inside the open panel', async () => {
    const user = userEvent.setup()
    render(<CrisisSupportWidget />)

    await user.click(screen.getByRole('button', { name: 'Mở hỗ trợ khẩn cấp' }))

    const closeButton = screen.getByRole('button', {
      name: 'Đóng bảng hỗ trợ khẩn cấp',
    })
    const finalLink = screen.getByRole('link', {
      name: 'Bài tập ổn định cảm xúc',
    })

    closeButton.focus()
    await user.keyboard('{Shift>}{Tab}{/Shift}')
    expect(finalLink).toHaveFocus()

    await user.keyboard('{Tab}')
    expect(closeButton).toHaveFocus()
  })
})
