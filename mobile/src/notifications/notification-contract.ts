import { z } from 'zod'

const time = z.iso.datetime({ offset: true })
export const clockTimeSchema = z
  .string()
  .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/)
export const notificationActionSchema = z.strictObject({
  type: z.enum([
    'OPEN_JOURNAL',
    'OPEN_MESSAGES',
    'OPEN_APPOINTMENTS',
    'OPEN_RESOURCES',
    'OPEN_ASSESSMENTS',
    'OPEN_RESOURCE',
    'OPEN_COMMUNITY_POST',
  ]),
  targetId: z.uuid().nullable(),
  href: z.string().min(1).max(256),
})
export const notificationSchema = z
  .strictObject({
    id: z.uuid(),
    kind: z.enum([
      'REMINDER',
      'MESSAGE',
      'APPOINTMENT',
      'SYSTEM_RESOURCE',
      'ASSESSMENT_REASSESSMENT',
      'STREAK_MILESTONE',
      'JOURNAL_REMINDER',
      'EMOTION_CHECKIN_REMINDER',
      'JOURNAL_STREAK_MILESTONE',
      'EMOTION_STREAK_MILESTONE',
      'COMMUNITY_COMMENT',
      'COMMUNITY_REPLY',
      'COMMUNITY_REACTION',
    ]),
    title: z.string().min(1).max(255),
    body: z.string().min(1).max(1000),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH']),
    occurredAt: time,
    createdAt: time,
    read: z.boolean(),
    readAt: time.nullable(),
    action: notificationActionSchema.nullable(),
    lifecycleState: z.literal('ACTIVE'),
    expiresAt: time,
  })
  .refine((item) => item.read === (item.readAt !== null))
export const notificationPageSchema = z
  .strictObject({
    items: z.array(notificationSchema).max(50),
    nextCursor: z.string().min(1).max(256).nullable(),
    hasMore: z.boolean(),
    unreadCount: z.number().int().nonnegative(),
  })
  .refine((page) => page.hasMore === (page.nextCursor !== null))

export const channelsSchema = z.strictObject({
  inApp: z.boolean(),
  email: z.boolean(),
  push: z.boolean(),
})
export const groupsSchema = z.strictObject({
  journalReminder: z.boolean(),
  emotionCheckIn: z.boolean(),
  streakMilestone: z.boolean(),
  screeningReassessment: z.boolean(),
  appointmentMessage: z.boolean(),
  resourceSystem: z.boolean(),
  communityInteraction: z.boolean(),
})
export const quietHoursSchema = z.strictObject({
  enabled: z.boolean(),
  start: clockTimeSchema,
  end: clockTimeSchema,
  timeZone: z.string().min(1).max(64),
})
export const emailSchema = z.strictObject({
  cadence: z.enum(['IMMEDIATE', 'DAILY_DIGEST', 'WEEKLY_DIGEST']),
  wellbeingDigestEnabled: z.boolean(),
  resourceRemindersEnabled: z.boolean(),
  dailyDigestTime: clockTimeSchema,
  resourceReminderTime: clockTimeSchema,
  appointmentRemindersEnabled: z.boolean().optional(),
})
export const preferencesSchema = z.strictObject({
  notificationsEnabled: z.boolean(),
  channels: channelsSchema,
  contentGroups: groupsSchema,
  quietHours: quietHoursSchema,
  email: emailSchema,
  version: z.number().int().nonnegative().safe(),
  updatedAt: time,
})
export const preferencePatchSchema = z
  .strictObject({
    notificationsEnabled: z.boolean().optional(),
    channels: channelsSchema.partial().optional(),
    contentGroups: groupsSchema.partial().optional(),
    quietHours: quietHoursSchema.partial().optional(),
    email: emailSchema.partial().optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0)
export const etagSchema = z.string().regex(/^"(0|[1-9][0-9]*)"$/)
export type InboxNotification = z.infer<typeof notificationSchema>
export type NotificationAction = z.infer<typeof notificationActionSchema>
export type NotificationPage = z.infer<typeof notificationPageSchema>
export type NotificationPreferences = z.infer<typeof preferencesSchema>
export type PreferencePatch = z.infer<typeof preferencePatchSchema>
export type VersionedPreferences = Readonly<{
  preferences: NotificationPreferences
  etag: string
}>
