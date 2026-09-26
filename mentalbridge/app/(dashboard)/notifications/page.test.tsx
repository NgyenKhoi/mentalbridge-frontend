import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'

const api = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }))
const inboxApi = vi.hoisted(() => ({
  get: vi.fn(),
  read: vi.fn(),
  readAll: vi.fn(),
  remove: vi.fn(),
  push: vi.fn(),
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: inboxApi.push }),
}))
vi.mock(
  '@/features/notifications/api/browser-notification-preferences',
  () => ({
    getNotificationPreferences: api.get,
    saveNotificationPreferences: api.save,
  }),
)
vi.mock('@/features/notifications/api/browser-notifications', () => ({
  getNotifications: inboxApi.get,
  markNotificationRead: inboxApi.read,
  markAllNotificationsRead: inboxApi.readAll,
  deleteNotification: inboxApi.remove,
}))

import NotificationsPage from './page'

const preferences = {
  notificationsEnabled: true,
  channels: { inApp: true, email: false, push: false },
  contentGroups: {
    journalReminder: true,
    emotionCheckIn: true,
    streakMilestone: true,
    screeningReassessment: true,
    appointmentMessage: true,
    resourceSystem: true,
  },
  quietHours: {
    enabled: true,
    start: '22:00',
    end: '07:00',
    timeZone: 'Asia/Ho_Chi_Minh',
  },
  email: {
    cadence: 'IMMEDIATE' as const,
    wellbeingDigestEnabled: false,
    resourceRemindersEnabled: false,
  },
  version: 0,
  updatedAt: '2026-09-26T00:00:00.000Z',
}

const notification = {
  id: 'c13e4567-e89b-42d3-a456-426614174000',
  kind: 'APPOINTMENT' as const,
  title: 'Lịch tư vấn sắp diễn ra',
  body: 'Bạn có một lịch tư vấn vào ngày mai.',
  priority: 'NORMAL' as const,
  occurredAt: '2026-09-26T01:00:00.000Z',
  createdAt: '2026-09-26T01:00:01.000Z',
  read: false,
  readAt: null,
  action: {
    type: 'OPEN_APPOINTMENTS' as const,
    targetId: null,
    href: '/appointments',
  },
  lifecycleState: 'ACTIVE' as const,
  expiresAt: '2026-12-25T01:00:01.000Z',
}

describe('Notification preferences page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({ preferences, etag: '"0"' })
    inboxApi.get.mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
      unreadCount: 0,
    })
  })

  it('renders the persisted inbox and marks one item read before following its action', async () => {
    const user = userEvent.setup()
    inboxApi.get.mockResolvedValueOnce({
      items: [notification],
      nextCursor: null,
      hasMore: false,
      unreadCount: 1,
    })
    inboxApi.read.mockResolvedValue({
      ...notification,
      read: true,
      readAt: '2026-09-26T02:00:00.000Z',
    })

    render(<NotificationsPage />)
    const title = await screen.findByText('Lịch tư vấn sắp diễn ra')
    const openButton = title.closest('button')
    expect(openButton).not.toBeNull()
    await user.click(openButton!)

    await waitFor(() =>
      expect(inboxApi.read).toHaveBeenCalledWith(notification.id),
    )
    expect(inboxApi.push).toHaveBeenCalledWith('/appointments')
    expect(screen.queryByLabelText('Chưa đọc')).not.toBeInTheDocument()
  })

  it('persists bulk read, deletion and cursor continuation', async () => {
    const user = userEvent.setup()
    const second = {
      ...notification,
      id: 'd13e4567-e89b-42d3-a456-426614174000',
      title: 'Tài nguyên mới',
      kind: 'SYSTEM_RESOURCE' as const,
      action: null,
    }
    inboxApi.get
      .mockResolvedValueOnce({
        items: [notification],
        nextCursor: 'next-page',
        hasMore: true,
        unreadCount: 2,
      })
      .mockResolvedValueOnce({
        items: [second],
        nextCursor: null,
        hasMore: false,
        unreadCount: 2,
      })
      .mockResolvedValueOnce({
        items: [
          { ...notification, read: true, readAt: '2026-09-26T02:00:00.000Z' },
          { ...second, read: true, readAt: '2026-09-26T02:00:00.000Z' },
        ],
        nextCursor: null,
        hasMore: false,
        unreadCount: 0,
      })
    inboxApi.readAll.mockResolvedValue({ updatedCount: 2 })
    inboxApi.remove.mockResolvedValue(undefined)

    render(<NotificationsPage />)
    await user.click(
      await screen.findByRole('button', { name: 'Xem thêm thông báo' }),
    )
    expect(await screen.findByText('Tài nguyên mới')).toBeVisible()
    expect(inboxApi.get).toHaveBeenNthCalledWith(2, 'next-page')

    await user.click(
      screen.getByRole('button', { name: /Đánh dấu đã đọc tất cả/i }),
    )
    await waitFor(() => expect(inboxApi.readAll).toHaveBeenCalledTimes(1))
    expect(
      await screen.findByText('Bạn đã xem tất cả thông báo.'),
    ).toBeVisible()

    await user.click(
      screen.getByRole('button', { name: `Xóa thông báo: ${second.title}` }),
    )
    await waitFor(() => expect(inboxApi.remove).toHaveBeenCalledWith(second.id))
    expect(screen.queryByText(second.title)).not.toBeInTheDocument()
  })

  it('shows recoverable inbox dependency failure and explicit empty state', async () => {
    const user = userEvent.setup()
    inboxApi.get.mockRejectedValueOnce(new Error('offline'))
    render(<NotificationsPage />)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Hộp thư thông báo tạm thời chưa tải được.',
    )
    inboxApi.get.mockResolvedValueOnce({
      items: [],
      nextCursor: null,
      hasMore: false,
      unreadCount: 0,
    })
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Chưa có thông báo')).toBeVisible()
  })

  it('loads persisted settings and saves all shared preference groups', async () => {
    const user = userEvent.setup()
    api.save.mockResolvedValue({
      preferences: {
        ...preferences,
        channels: { ...preferences.channels, email: true, push: true },
        quietHours: { ...preferences.quietHours, timeZone: 'Europe/Paris' },
        version: 1,
      },
      etag: '"1"',
    })
    render(<NotificationsPage />)
    await user.click(screen.getByRole('button', { name: /Cài đặt/i }))

    expect(
      await screen.findByRole('switch', { name: 'Thông báo đẩy' }),
    ).toHaveAttribute('aria-checked', 'false')
    await user.click(screen.getByRole('switch', { name: 'Email' }))
    await user.click(screen.getByRole('switch', { name: 'Thông báo đẩy' }))
    await user.selectOptions(screen.getByLabelText('Múi giờ'), 'Europe/Paris')
    await user.click(screen.getByRole('button', { name: 'Lưu cài đặt' }))

    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(1))
    expect(api.save).toHaveBeenCalledWith(
      expect.objectContaining({
        channels: { inApp: true, email: true, push: true },
        contentGroups: expect.objectContaining({ resourceSystem: true }),
        quietHours: expect.objectContaining({ timeZone: 'Europe/Paris' }),
        email: expect.objectContaining({ cadence: 'IMMEDIATE' }),
      }),
      '"0"',
    )
    expect(await screen.findByText('Đã lưu cài đặt thông báo.')).toBeVisible()
  })

  it('shows a recoverable load failure instead of local defaults', async () => {
    api.get.mockRejectedValueOnce(new Error('offline'))
    const user = userEvent.setup()
    render(<NotificationsPage />)
    await user.click(screen.getByRole('button', { name: /Cài đặt/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'tạm thời chưa tải được',
    )
    expect(
      screen.queryByRole('switch', { name: 'Email' }),
    ).not.toBeInTheDocument()
  })

  it('validates a quiet window before saving', async () => {
    const user = userEvent.setup()
    render(<NotificationsPage />)
    await user.click(screen.getByRole('button', { name: /Cài đặt/i }))
    await screen.findByRole('switch', { name: 'Giờ yên tĩnh' })

    fireEvent.change(screen.getByLabelText('Bắt đầu'), {
      target: { value: '07:00' },
    })
    await user.click(screen.getByRole('button', { name: 'Lưu cài đặt' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('phải khác nhau')
    expect(api.save).not.toHaveBeenCalled()
  })

  it('offers reload when another device has changed the version', async () => {
    api.save.mockRejectedValue(
      new ApiError({ message: 'stale', code: 'STALE', status: 412 }),
    )
    const user = userEvent.setup()
    render(<NotificationsPage />)
    await user.click(screen.getByRole('button', { name: /Cài đặt/i }))
    await user.click(await screen.findByRole('switch', { name: 'Email' }))
    await user.click(screen.getByRole('button', { name: 'Lưu cài đặt' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('thiết bị khác')
    expect(screen.getByRole('button', { name: 'Tải lại' })).toBeVisible()
  })
})
