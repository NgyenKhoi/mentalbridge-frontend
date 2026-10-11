import type { NotificationApi } from './notification-api'
import type {
  InboxNotification,
  NotificationPage,
  VersionedPreferences,
} from './notification-contract'
export const notificationId = '11111111-1111-4111-8111-111111111111'
export const targetId = '22222222-2222-4222-8222-222222222222'
export const subject = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
export const date = '2026-10-11T07:00:00.000Z'
export function notification(
  overrides: Partial<InboxNotification> = {},
): InboxNotification {
  return {
    id: notificationId,
    kind: 'JOURNAL_REMINDER',
    title: 'Lời nhắc của bạn',
    body: 'Bạn có thể tiếp tục hoạt động đã chọn.',
    priority: 'NORMAL',
    occurredAt: date,
    createdAt: date,
    read: false,
    readAt: null,
    action: { type: 'OPEN_JOURNAL', targetId: null, href: '/journal' },
    lifecycleState: 'ACTIVE',
    expiresAt: '2026-11-01T07:00:00.000Z',
    ...overrides,
  }
}
export function page(
  items = [notification()],
  cursor: string | null = null,
): NotificationPage {
  return {
    items,
    nextCursor: cursor,
    hasMore: cursor !== null,
    unreadCount: items.filter((item) => !item.read).length,
  }
}
export function preferences(version = 0): VersionedPreferences {
  return {
    etag: `"${version}"`,
    preferences: {
      notificationsEnabled: true,
      channels: { inApp: true, email: false, push: false },
      contentGroups: {
        journalReminder: true,
        emotionCheckIn: true,
        streakMilestone: true,
        screeningReassessment: true,
        appointmentMessage: true,
        resourceSystem: true,
        communityInteraction: true,
      },
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '07:00',
        timeZone: 'Asia/Ho_Chi_Minh',
      },
      email: {
        cadence: 'DAILY_DIGEST',
        wellbeingDigestEnabled: true,
        resourceRemindersEnabled: true,
        dailyDigestTime: '08:00',
        resourceReminderTime: '19:00',
        appointmentRemindersEnabled: true,
      },
      version,
      updatedAt: date,
    },
  }
}
export function fixtureApi(
  overrides: Partial<NotificationApi> = {},
): NotificationApi {
  return {
    list: jest.fn().mockResolvedValue(page()),
    markRead: jest
      .fn()
      .mockResolvedValue(notification({ read: true, readAt: date })),
    markAllRead: jest.fn().mockResolvedValue({ updatedCount: 1 }),
    preferences: jest.fn().mockResolvedValue(preferences()),
    savePreferences: jest.fn().mockResolvedValue(preferences(1)),
    ...overrides,
  }
}
