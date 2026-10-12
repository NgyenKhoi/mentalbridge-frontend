import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import SpecialistNotificationCenter from './SpecialistNotificationCenter'
import {
  getNotificationPreferences,
  saveNotificationPreferences,
} from '../api/browser-notification-preferences'
import { getNotifications } from '../api/browser-notifications'

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

describe('SpecialistNotificationCenter', () => {
  beforeEach(() => {
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
})
