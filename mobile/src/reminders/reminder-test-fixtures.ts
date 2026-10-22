import type {
  ReminderAction,
  ReminderOverview,
  ReminderSource,
} from './reminder-model'
import type { ReminderResponse } from './reminder-api'

export const reminderUiFixtureSubject = '11111111-1111-4111-8111-111111111111'

export function reminderUiFixtureResponse(): ReminderResponse {
  return {
    schemaVersion: '1.0',
    asOf: '2026-10-22T03:00:00.000Z',
    localDate: '2026-10-22',
    timeZone: 'Asia/Ho_Chi_Minh',
    preferences: {
      notificationsEnabled: true,
      channels: { inApp: true, email: true, push: false },
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
        resourceRemindersEnabled: false,
        dailyDigestTime: '19:00',
        resourceReminderTime: '18:30',
        appointmentRemindersEnabled: false,
      },
      version: 0,
      updatedAt: '2026-10-22T03:00:00.000Z',
    },
    today: [
      {
        id: 'JOURNAL:2026-10-22',
        category: 'JOURNAL',
        status: 'DUE',
        action: 'OPEN_JOURNAL',
      },
      {
        id: 'EMOTION_CHECK_IN:2026-10-22',
        category: 'EMOTION_CHECK_IN',
        status: 'COMPLETED',
        action: 'OPEN_EMOTION_CHECK_IN',
      },
    ],
    previews: [
      {
        kind: 'JOURNAL_REMINDER',
        channel: 'IN_APP',
        state: 'ELIGIBLE',
        nextEligibleAt: '2026-10-22T03:00:00.000Z',
        estimate: true,
        latestDelivery: null,
      },
      {
        kind: 'EMOTION_CHECKIN_REMINDER',
        channel: 'IN_APP',
        state: 'COMPLETED',
        nextEligibleAt: null,
        estimate: true,
        latestDelivery: null,
      },
      {
        kind: 'DAILY_DIGEST',
        channel: 'EMAIL',
        state: 'SCHEDULED',
        nextEligibleAt: '2026-10-22T12:00:00.000Z',
        estimate: true,
        latestDelivery: {
          state: 'FAILED',
          recordedAt: '2026-10-22T02:00:00.000Z',
        },
      },
      {
        kind: 'RESOURCE_REMINDER',
        channel: 'EMAIL',
        state: 'DISABLED',
        nextEligibleAt: null,
        estimate: true,
        latestDelivery: null,
      },
      {
        kind: 'APPOINTMENT_EMAIL',
        channel: 'EMAIL',
        state: 'DISABLED',
        nextEligibleAt: null,
        estimate: true,
        latestDelivery: null,
      },
    ],
    unavailableCategories: ['SUPPORT_PLAN', 'RESOURCES', 'ASSESSMENT', 'PUSH'],
  }
}

export function reminderUiFixtureAction(
  values: Partial<ReminderAction> = {},
): ReminderAction {
  return {
    id: 'emotion-today',
    title: 'Ghi nhận cảm xúc',
    category: 'emotion',
    status: 'due',
    scheduledAt: '2026-10-22T09:00:00+07:00',
    destination: 'emotion',
    ...values,
  }
}

export function reminderUiFixtureOverview(
  values: Partial<Extract<ReminderOverview, { state: 'ready' }>> = {},
): Extract<ReminderOverview, { state: 'ready' }> {
  return {
    state: 'ready',
    localDate: '2026-10-22',
    timeZone: 'Asia/Ho_Chi_Minh',
    today: [reminderUiFixtureAction()],
    upcoming: [
      reminderUiFixtureAction({
        id: 'plan-tomorrow',
        title: 'Hoạt động ngày mai',
        category: 'support-plan',
        destination: 'support-plan',
        status: 'upcoming',
        scheduledAt: '2026-10-23T08:00:00+07:00',
      }),
    ],
    delivery: { state: 'available', nextEligibleAt: null },
    ...values,
  }
}

export function reminderUiFixtureSource(
  overview: ReminderOverview = reminderUiFixtureOverview(),
): ReminderSource {
  return { read: jest.fn().mockResolvedValue(overview) }
}
