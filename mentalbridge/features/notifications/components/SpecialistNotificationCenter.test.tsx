import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SpecialistNotificationCenter from './SpecialistNotificationCenter'
import {
  getNotificationPreferences,
  saveNotificationPreferences,
} from '../api/browser-notification-preferences'
import {
  deleteNotification,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../api/browser-notifications'

vi.mock('../api/browser-notifications', () => ({
  getNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  deleteNotification: vi.fn(),
}))
vi.mock('../api/browser-notification-preferences', () => ({
  getNotificationPreferences: vi.fn(),
  saveNotificationPreferences: vi.fn(),
}))

const preferences = {
  notificationsEnabled: true,
  channels: { inApp: true, email: false, push: false },
  contentGroups: {
    journalReminder: false,
    emotionCheckIn: false,
    streakMilestone: false,
    screeningReassessment: false,
    appointmentMessage: true,
    resourceSystem: true,
    communityInteraction: false,
  },
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '07:00',
    timeZone: 'Asia/Ho_Chi_Minh',
  },
  email: {
    cadence: 'IMMEDIATE' as const,
    wellbeingDigestEnabled: false,
    resourceRemindersEnabled: false,
    dailyDigestTime: '08:00',
    resourceReminderTime: '08:00',
    appointmentRemindersEnabled: false,
  },
  version: 0,
  updatedAt: '2026-10-12T00:00:00.000Z',
}

const unreadNotification = {
  id: 'c13e4567-e89b-42d3-a456-426614174000',
  kind: 'APPOINTMENT' as const,
  title: 'Lịch hẹn mới',
  body: 'Có một cập nhật lịch hẹn mới.',
  priority: 'NORMAL' as const,
  occurredAt: '2026-10-12T00:00:00.000Z',
  createdAt: '2026-10-12T00:00:01.000Z',
  read: false,
  readAt: null,
  action: null,
  lifecycleState: 'ACTIVE' as const,
  expiresAt: '2027-01-10T00:00:00.000Z',
}

describe('SpecialistNotificationCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getNotifications).mockResolvedValue({
      items: [],
      nextCursor: null,
      hasMore: false,
      unreadCount: 0,
    })
    vi.mocked(getNotificationPreferences).mockResolvedValue({
      preferences,
      etag: '"0"',
    })
    vi.mocked(saveNotificationPreferences).mockResolvedValue({
      preferences,
      etag: '"1"',
    })
    vi.mocked(markNotificationRead).mockResolvedValue({
      ...unreadNotification,
      read: true,
      readAt: '2026-10-12T01:00:00.000Z',
    })
    vi.mocked(markAllNotificationsRead).mockResolvedValue({ updatedCount: 1 })
    vi.mocked(deleteNotification).mockResolvedValue(undefined)
  })

  it('renders the durable empty inbox without fabricated specialist activity', async () => {
    render(<SpecialistNotificationCenter />)

    expect(await screen.findByText('Chưa có thông báo')).toBeVisible()
    expect(
      screen.queryByText(/Nguyễn Minh Anh|8\.400\.000/),
    ).not.toBeInTheDocument()
  })

  it('exposes only specialist-safe settings and sends a bounded patch', async () => {
    const user = userEvent.setup()
    render(<SpecialistNotificationCenter />)

    await user.click(screen.getByRole('button', { name: 'Cài đặt' }))
    expect(await screen.findByText('Lịch hẹn và tin nhắn')).toBeVisible()
    expect(
      screen.queryByRole('checkbox', { name: /Nhật ký|cảm xúc/i }),
    ).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Lưu cài đặt' }))
    await waitFor(() =>
      expect(saveNotificationPreferences).toHaveBeenCalledOnce(),
    )
    expect(saveNotificationPreferences).toHaveBeenCalledWith(
      {
        notificationsEnabled: true,
        channels: { inApp: true },
        contentGroups: { appointmentMessage: true, resourceSystem: true },
      },
      '"0"',
    )
  })

  it('decrements the unread count when an unread notification is deleted', async () => {
    vi.mocked(getNotifications).mockResolvedValue({
      items: [unreadNotification],
      nextCursor: null,
      hasMore: false,
      unreadCount: 1,
    })
    const user = userEvent.setup()
    render(<SpecialistNotificationCenter />)

    expect(await screen.findByText('Lịch hẹn mới')).toBeVisible()
    expect(screen.getByText(/1 chưa đọc/i)).toBeVisible()
    await user.click(screen.getByRole('button', { name: /Xóa Lịch hẹn mới/i }))

    await waitFor(() =>
      expect(deleteNotification).toHaveBeenCalledWith(unreadNotification.id),
    )
    expect(screen.queryByText('Lịch hẹn mới')).not.toBeInTheDocument()
    expect(screen.queryByText(/1 chưa đọc/i)).not.toBeInTheDocument()
  })

  it('keeps inbox state and shows bounded errors when mutations fail', async () => {
    vi.mocked(getNotifications).mockResolvedValue({
      items: [unreadNotification],
      nextCursor: null,
      hasMore: false,
      unreadCount: 1,
    })
    vi.mocked(markNotificationRead).mockRejectedValueOnce(
      new Error('private detail'),
    )
    const user = userEvent.setup()
    render(<SpecialistNotificationCenter />)

    const title = await screen.findByText('Lịch hẹn mới')
    await user.click(title.closest('button')!)

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không thể đánh dấu thông báo đã đọc. Vui lòng thử lại.',
    )
    expect(screen.getByText(/1 chưa đọc/i)).toBeVisible()
    expect(screen.getByText('Lịch hẹn mới')).toBeVisible()
    expect(screen.queryByText(/private detail/i)).not.toBeInTheDocument()
  })

  it('does not claim delete or mark-all success after an ambiguous failure', async () => {
    vi.mocked(getNotifications).mockResolvedValue({
      items: [unreadNotification],
      nextCursor: null,
      hasMore: false,
      unreadCount: 1,
    })
    vi.mocked(deleteNotification).mockRejectedValueOnce(
      new Error('delete detail'),
    )
    vi.mocked(markAllNotificationsRead).mockRejectedValueOnce(
      new Error('bulk detail'),
    )
    const user = userEvent.setup()
    render(<SpecialistNotificationCenter />)

    await screen.findByText('Lịch hẹn mới')
    await user.click(screen.getByRole('button', { name: /Xóa Lịch hẹn mới/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không thể xóa thông báo.',
    )
    expect(screen.getByText('Lịch hẹn mới')).toBeVisible()
    expect(screen.getByText(/1 chưa đọc/i)).toBeVisible()

    await user.click(
      screen.getByRole('button', { name: /Đánh dấu tất cả đã đọc/i }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Không thể đánh dấu tất cả đã đọc.',
    )
    expect(screen.getByText(/1 chưa đọc/i)).toBeVisible()
  })

  it('keeps the current page visible when loading the next page fails', async () => {
    vi.mocked(getNotifications)
      .mockResolvedValueOnce({
        items: [unreadNotification],
        nextCursor: 'next-page',
        hasMore: true,
        unreadCount: 1,
      })
      .mockRejectedValueOnce(new Error('pagination detail'))
    const user = userEvent.setup()
    render(<SpecialistNotificationCenter />)

    await screen.findByText('Lịch hẹn mới')
    await user.click(screen.getByRole('button', { name: /Tải thêm/i }))

    expect(await screen.findByRole('alert')).toBeVisible()
    expect(screen.getByText('Lịch hẹn mới')).toBeVisible()
    expect(screen.queryByText(/pagination detail/i)).not.toBeInTheDocument()
  })
})
