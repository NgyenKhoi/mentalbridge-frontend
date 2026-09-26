import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { FeedbackProvider, useFeedback } from './FeedbackProvider'

function Harness() {
  const { confirm, showActionToast, showNotificationToast } = useFeedback()
  return (
    <>
      <button
        onClick={() =>
          showActionToast({ title: 'Đã lưu thay đổi', tone: 'success' })
        }
      >
        Action
      </button>
      <button
        onClick={() =>
          showNotificationToast({
            title: 'Có cập nhật mới',
            description: 'Dữ liệu vừa được đồng bộ.',
            tone: 'info',
          })
        }
      >
        Notification
      </button>
      <button
        onClick={() =>
          void confirm({
            title: 'Xóa nội dung?',
            description: 'Nội dung sẽ không còn hiển thị.',
            confirmLabel: 'Xóa nội dung',
          })
        }
      >
        Confirm
      </button>
    </>
  )
}

describe('FeedbackProvider', () => {
  it('renders action and notification toasts in separate live regions', async () => {
    const user = userEvent.setup()
    render(
      <FeedbackProvider>
        <Harness />
      </FeedbackProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Action' }))
    await user.click(screen.getByRole('button', { name: 'Notification' }))

    expect(
      screen.getByRole('region', { name: 'Phản hồi thao tác' }),
    ).toHaveTextContent('Đã lưu thay đổi')
    expect(
      screen.getByRole('region', { name: 'Thông báo mới' }),
    ).toHaveTextContent('Có cập nhật mớiDữ liệu vừa được đồng bộ.')
  })

  it('resolves a destructive confirmation explicitly', async () => {
    const user = userEvent.setup()
    const decision = vi.fn()

    function ConfirmationHarness() {
      const { confirm } = useFeedback()
      return (
        <button
          onClick={() =>
            void confirm({
              title: 'Xóa nội dung?',
              description: 'Nội dung sẽ không còn hiển thị.',
              confirmLabel: 'Xóa nội dung',
            }).then(decision)
          }
        >
          Open
        </button>
      )
    }

    render(
      <FeedbackProvider>
        <ConfirmationHarness />
      </FeedbackProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))
    await user.click(screen.getByRole('button', { name: 'Xóa nội dung' }))

    expect(decision).toHaveBeenCalledWith(true)
  })

  it('keeps the action untouched when confirmation is cancelled', async () => {
    const user = userEvent.setup()
    const decision = vi.fn()

    function ConfirmationHarness() {
      const { confirm } = useFeedback()
      return (
        <button
          onClick={() =>
            void confirm({
              title: 'Ẩn nội dung?',
              description: 'Nội dung sẽ không còn xuất hiện trong danh sách.',
              confirmLabel: 'Ẩn nội dung',
              cancelLabel: 'Giữ lại',
              tone: 'warning',
            }).then(decision)
          }
        >
          Open
        </button>
      )
    }

    render(
      <FeedbackProvider>
        <ConfirmationHarness />
      </FeedbackProvider>,
    )
    await user.click(screen.getByRole('button', { name: 'Open' }))

    const cancel = screen.getByRole('button', { name: 'Giữ lại' })
    expect(cancel).toHaveFocus()
    await user.click(cancel)

    expect(decision).toHaveBeenCalledWith(false)
  })
})
