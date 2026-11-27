import { fireEvent, render, screen } from '@testing-library/react'
import Link from 'next/link'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Dialog } from './Dialog'

describe('Dialog keyboard boundary', () => {
  afterEach(() => vi.restoreAllMocks())

  it('cycles Tab and Shift+Tab inside the visible enabled controls', () => {
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([
      { width: 44, height: 44 },
    ] as unknown as DOMRectList)
    render(
      <Dialog open onOpenChange={vi.fn()} labelledBy="dialog-title">
        <h2 id="dialog-title">Thông tin buổi hẹn</h2>
        <button>Đóng</button>
        <button disabled>Không khả dụng</button>
        <Link href="/specialist/clients">Chuẩn bị</Link>
      </Dialog>,
    )
    const first = screen.getByRole('button', { name: 'Đóng' })
    const last = screen.getByRole('link', { name: 'Chuẩn bị' })
    last.focus()
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(first).toHaveFocus()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()
  })
})
