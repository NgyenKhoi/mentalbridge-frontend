import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionNotesPanel } from './SessionNotesPanel'

const feedback = vi.hoisted(() => ({ confirm: vi.fn() }))
vi.mock('@/components/ui/FeedbackProvider', () => ({
  useFeedback: () => feedback,
}))

const id = '10000000-0000-4000-8000-000000000001'
const key = `mb.summaryDraft.${id}`
const stored = () => JSON.parse(window.localStorage.getItem(key) ?? 'null')

describe('SessionNotesPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    window.localStorage.clear()
    feedback.confirm.mockReset()
    feedback.confirm.mockResolvedValue(true)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('autosaves after a pause, not on every keystroke, and reports the save', () => {
    render(<SessionNotesPanel appointmentId={id} />)
    expect(
      screen.getByText(
        /Ghi chú được lưu tạm trên máy này cho tới khi bạn xuất bản tổng kết hoặc tối đa 48 giờ. Người khác dùng chung trình duyệt này có thể đọc được./,
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
    const toggle = screen.getByRole('button', { name: /^Ghi chú phiên/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('never recreates a draft that publishing removed, even on pagehide', () => {
    render(<SessionNotesPanel appointmentId={id} />)
    const field = screen.getByLabelText(/Nội dung đã trao đổi/)
    fireEvent.change(field, { target: { value: 'Giấc ngủ' } })
    act(() => vi.advanceTimersByTime(600))
    expect(stored()).not.toBeNull()
    // The main window published the summary and deleted the draft.
    window.localStorage.removeItem(key)
    fireEvent.change(field, { target: { value: 'Giấc ngủ, thêm' } })
    act(() => window.dispatchEvent(new Event('pagehide')))
    expect(stored()).toBeNull()
    act(() => vi.advanceTimersByTime(600))
    expect(stored()).toBeNull()
    expect(field).toHaveValue('')
  })

  it('clears the form when another window removes the draft', () => {
    render(<SessionNotesPanel appointmentId={id} />)
    const field = screen.getByLabelText(/Nội dung đã trao đổi/)
    fireEvent.change(field, { target: { value: 'Giấc ngủ' } })
    act(() => vi.advanceTimersByTime(600))
    window.localStorage.removeItem(key)
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key }))
    })
    expect(field).toHaveValue('')
    act(() => window.dispatchEvent(new Event('pagehide')))
    expect(stored()).toBeNull()
  })

  it('deletes notes only after the specialist confirms', async () => {
    render(<SessionNotesPanel appointmentId={id} />)
    fireEvent.change(screen.getByLabelText(/Lời nhắn cho người dùng/), {
      target: { value: 'Cảm ơn bạn' },
    })
    act(() => vi.advanceTimersByTime(600))
    const remove = screen.getByRole('button', { name: 'Xóa ghi chú' })
    feedback.confirm.mockResolvedValueOnce(false)
    await act(async () => fireEvent.click(remove))
    expect(stored()).not.toBeNull()
    await act(async () => fireEvent.click(remove))
    expect(stored()).toBeNull()
    expect(screen.getByLabelText(/Lời nhắn cho người dùng/)).toHaveValue('')
  })

  it('keeps label text clean and describes fields by hint and counter', () => {
    render(<SessionNotesPanel appointmentId={id} />)
    const topics = screen.getByLabelText('Nội dung đã trao đổi')
    const described = topics
      .getAttribute('aria-describedby')!
      .split(' ')
      .map((part) => document.getElementById(part)?.textContent)
    expect(described).toEqual(['Mỗi dòng một mục, tối đa 8 mục', '0/8 mục'])
    expect(
      document.getElementById(
        topics.getAttribute('aria-describedby')!.split(' ')[1],
      ),
    ).toHaveAttribute('aria-live', 'off')
  })

  it('flags a saved draft on the folded toggle', () => {
    render(<SessionNotesPanel appointmentId={id} />)
    expect(screen.queryByText('Đang có ghi chú')).toBeNull()
    fireEvent.change(screen.getByLabelText(/Nội dung đã trao đổi/), {
      target: { value: 'Giấc ngủ' },
    })
    expect(screen.getByText('Đang có ghi chú')).toBeInTheDocument()
  })
})
