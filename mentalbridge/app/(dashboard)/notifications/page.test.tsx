import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'

const api = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }))
vi.mock(
  '@/features/notifications/api/browser-notification-preferences',
  () => ({
    getNotificationPreferences: api.get,
    saveNotificationPreferences: api.save,
  }),
)

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

describe('Notification preferences page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.get.mockResolvedValue({ preferences, etag: '"0"' })
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
