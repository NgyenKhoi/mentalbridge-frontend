import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionNotesPanel } from './SessionNotesPanel'

const id = '10000000-0000-4000-8000-000000000001'
const key = `mb.summaryDraft.${id}`
const stored = () => JSON.parse(window.localStorage.getItem(key) ?? 'null')

describe('SessionNotesPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('autosaves after a pause, not on every keystroke, and reports the save', () => {
    render(<SessionNotesPanel appointmentId={id} />)
    expect(
      screen.getByText(
        'Ghi chú được lưu tạm trên máy này cho tới khi bạn xuất bản tổng kết.',
      ),
    ).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/Điều đã ghi nhận/), {
      target: { value: 'Ngủ muộn' },
    })
    expect(stored()).toBeNull()
    act(() => vi.advanceTimersByTime(600))
    expect(stored()).toMatchObject({ progress: 'Ngủ muộn', topics: '' })
    expect(typeof stored().savedAt).toBe('number')
    expect(screen.getByRole('status')).toHaveTextContent('Đã lưu tạm lúc')
    expect(screen.getByText('8/1000')).toBeInTheDocument()
  })

  it('restores a recent draft and drops one older than 48 hours', () => {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        topics: 'Giấc ngủ',
        progress: '',
        note: '',
        steps: '',
        savedAt: Date.now() - 3_600_000,
      }),
    )
    const first = render(<SessionNotesPanel appointmentId={id} />)
    expect(screen.getByLabelText(/Nội dung đã trao đổi/)).toHaveValue(
      'Giấc ngủ',
    )
    first.unmount()
    window.localStorage.setItem(
      key,
      JSON.stringify({
        topics: 'Cũ',
        progress: '',
        note: '',
        steps: '',
        savedAt: Date.now() - 49 * 3_600_000,
      }),
    )
    render(<SessionNotesPanel appointmentId={id} />)
    expect(screen.getByLabelText(/Nội dung đã trao đổi/)).toHaveValue('')
    expect(window.localStorage.getItem(key)).toBeNull()
  })

  it('removes the draft when every field is emptied', () => {
    render(<SessionNotesPanel appointmentId={id} />)
    const field = screen.getByLabelText(/Lời nhắn cho người dùng/)
    fireEvent.change(field, { target: { value: 'Cảm ơn bạn' } })
    act(() => vi.advanceTimersByTime(600))
    expect(stored()).not.toBeNull()
    fireEvent.change(field, { target: { value: '' } })
    act(() => vi.advanceTimersByTime(600))
    expect(stored()).toBeNull()
  })

  it('tells the specialist when the browser refuses storage', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    render(<SessionNotesPanel appointmentId={id} />)
    fireEvent.change(screen.getByLabelText(/Nội dung đã trao đổi/), {
      target: { value: 'Giấc ngủ' },
    })
    act(() => vi.advanceTimersByTime(600))
    expect(screen.getByRole('status')).toHaveTextContent('Chưa lưu tạm được')
  })

  it('flushes the last edit when the window closes and folds on narrow screens', () => {
    render(<SessionNotesPanel appointmentId={id} />)
    fireEvent.change(screen.getByLabelText(/Nội dung đã trao đổi/), {
      target: { value: 'Giấc ngủ' },
    })
    act(() => window.dispatchEvent(new Event('pagehide')))
    expect(stored()).toMatchObject({ topics: 'Giấc ngủ' })
    const toggle = screen.getByRole('button', { name: 'Ghi chú phiên' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })
})
