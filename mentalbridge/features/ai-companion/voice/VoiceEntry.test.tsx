import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import VoiceEntry from './VoiceEntry'

vi.mock('next/dynamic', () => ({
  default: () =>
    function VoiceDialogStub({
      open,
      onOpenChange,
    }: {
      open: boolean
      onOpenChange: (open: boolean) => void
    }) {
      return open ? (
        <div role="dialog" aria-label="Gọi AI">
          <button onClick={() => onOpenChange(false)}>Đóng</button>
        </div>
      ) : null
    },
}))

describe('compact Voice entry', () => {
  it.each(['desktop', 'mobile'] as const)(
    'keeps %s entry icon-only with a discoverable accessible action',
    (placement) => {
      render(<VoiceEntry placement={placement} />)
      const call = screen.getByRole('button', { name: 'Gọi AI' })
      expect(call).toHaveAttribute('title', 'Gọi AI')
      expect(call).toHaveAttribute('aria-haspopup', 'dialog')
      expect(call.textContent).toBe('')
      expect(call.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
      call.focus()
      expect(call).toHaveFocus()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      fireEvent.click(call)
      expect(screen.getByRole('dialog', { name: 'Gọi AI' })).toBeVisible()
      fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    },
  )
})
