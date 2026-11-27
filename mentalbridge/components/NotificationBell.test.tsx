import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import NotificationBell, {
  NOTIFICATIONS_UPDATED_EVENT,
} from './NotificationBell'
import {
  getNotifications,
  markAllNotificationsRead,
} from '@/features/notifications/api/browser-notifications'

vi.mock('@/features/notifications/api/browser-notifications', () => ({
  getNotifications: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}))

const push = vi.hoisted(() => ({
  emit: undefined as undefined | ((notificationId: string) => void),
  unsubscribe: vi.fn(),
}))
vi.mock('@/features/notifications/api/realtime-notifications', () => ({
  subscribeNotificationCreated: (listener: (id: string) => void) => {
    push.emit = listener
    return push.unsubscribe
  },
}))

const toast = vi.hoisted(() => vi.fn())
vi.mock('@/components/ui/FeedbackProvider', () => ({
  useFeedback: () => ({ showNotificationToast: toast }),
}))

function item(id: string, title: string, read = false) {
  return {
    id,
    kind: 'APPOINTMENT',
    title,
    body: `Nội dung ${title}`,
    priority: 'NORMAL',
    occurredAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    read,
    readAt: null,
    action: { type: 'APPOINTMENT', targetId: id, href: `/appointments/${id}` },
    lifecycleState: 'ACTIVE',
    expiresAt: new Date().toISOString(),
  }
}

const page = (items: ReturnType<typeof item>[], unreadCount: number) => ({
  items,
  nextCursor: null,
  hasMore: false,
  unreadCount,
})

function renderBell() {
  return render(
    <NotificationBell viewAllHref="/specialist/notifications" className="btn">
      <svg />
    </NotificationBell>,
  )
}

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a capped unread badge with an accessible name', async () => {
    vi.mocked(getNotifications).mockResolvedValue(
      page([item('a', 'Một')], 120) as never,
    )
    renderBell()
    expect(
      await screen.findByRole('button', { name: 'Thông báo, 120 chưa đọc' }),
    ).toHaveTextContent('99+')
  })

  it('opens a preview with the latest items and closes on Escape', async () => {
    vi.mocked(getNotifications).mockResolvedValue(
      page(
        [item('a', 'Yêu cầu lịch hẹn mới'), item('b', 'Cũ', true)],
        1,
      ) as never,
    )
    const user = userEvent.setup()
    renderBell()
    const bell = await screen.findByRole('button', {
      name: 'Thông báo, 1 chưa đọc',
    })
    await user.click(bell)
    expect(bell).toHaveAttribute('aria-expanded', 'true')
    expect(
      screen.getByRole('link', { name: /Yêu cầu lịch hẹn mới/ }),
    ).toHaveAttribute('href', '/appointments/a')
    expect(screen.getByRole('link', { name: 'Xem tất cả' })).toHaveAttribute(
      'href',
      '/specialist/notifications',
    )
    await user.keyboard('{Escape}')
    expect(
      screen.queryByRole('region', { name: 'Thông báo gần đây' }),
    ).not.toBeInTheDocument()
    expect(bell).toHaveFocus()
  })

  it('marks everything read and clears the badge', async () => {
    vi.mocked(getNotifications).mockResolvedValue(
      page([item('a', 'Một')], 1) as never,
    )
    vi.mocked(markAllNotificationsRead).mockResolvedValue({ updatedCount: 1 })
    const user = userEvent.setup()
    renderBell()
    await user.click(
      await screen.findByRole('button', { name: 'Thông báo, 1 chưa đọc' }),
    )
    await user.click(screen.getByRole('button', { name: 'Đọc tất cả' }))
    expect(markAllNotificationsRead).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByRole('button', { name: 'Thông báo' }),
    ).toBeInTheDocument()
  })

  it('toasts and broadcasts when unread grows after the first load, and stops polling when hidden', async () => {
    vi.useFakeTimers()
    vi.mocked(getNotifications)
      .mockResolvedValueOnce(page([item('a', 'Cũ', true)], 0) as never)
      .mockResolvedValue(
        page(
          [item('b', 'Yêu cầu lịch hẹn mới'), item('a', 'Cũ', true)],
          1,
        ) as never,
      )
    const onUpdate = vi.fn()
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdate)
    renderBell()
    await act(async () => {})
    expect(toast).not.toHaveBeenCalled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Yêu cầu lịch hẹn mới' }),
    )
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('button', { name: 'Thông báo, 1 chưa đọc' }),
    ).toBeInTheDocument()

    const calls = vi.mocked(getNotifications).mock.calls.length
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    })
    fireEvent(document, new Event('visibilitychange'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(vi.mocked(getNotifications).mock.calls.length).toBe(calls)
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    })
    window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdate)
  })

  it('refetches, toasts and broadcasts at once on a socket pointer, without a second toast from the poll', async () => {
    vi.useFakeTimers()
    vi.mocked(getNotifications)
      .mockResolvedValueOnce(page([item('a', 'Cũ', true)], 0) as never)
      .mockResolvedValue(
        page([item('b', 'Lịch hẹn mới'), item('a', 'Cũ', true)], 1) as never,
      )
    const onUpdate = vi.fn()
    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdate)
    renderBell()
    await act(async () => {})
    expect(toast).not.toHaveBeenCalled()

    await act(async () => push.emit?.('b'))
    expect(toast).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Lịch hẹn mới' }),
    )
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole('button', { name: 'Thông báo, 1 chưa đọc' }),
    ).toBeInTheDocument()

    // The 20s poll sees the same notification: no duplicate toast or event.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000)
    })
    expect(toast).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledTimes(1)
    window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, onUpdate)
  })

  it('does not lose a socket pointer that arrives while a read is in flight', async () => {
    vi.useFakeTimers()
    let finishFirst: (value: never) => void = () => {}
    vi.mocked(getNotifications)
      .mockImplementationOnce(
        () => new Promise((resolve) => (finishFirst = resolve)),
      )
      .mockResolvedValue(page([item('b', 'Lịch hẹn mới')], 1) as never)
    renderBell()
    await act(async () => {})
    await act(async () => push.emit?.('b'))
    await act(async () =>
      finishFirst(page([item('a', 'Cũ', true)], 0) as never),
    )
    expect(getNotifications).toHaveBeenCalledTimes(2)
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Lịch hẹn mới' }),
    )
  })

  it('unsubscribes from the socket on unmount', async () => {
    vi.mocked(getNotifications).mockResolvedValue(page([], 0) as never)
    const { unmount } = renderBell()
    await act(async () => {})
    unmount()
    expect(push.unsubscribe).toHaveBeenCalled()
  })
})
