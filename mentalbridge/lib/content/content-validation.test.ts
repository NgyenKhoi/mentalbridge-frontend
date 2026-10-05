import { describe, expect, it } from 'vitest'

import {
  parseNotification,
  parseNotificationPage,
  parseNotificationPreferencePatch,
  parseNotificationPreferences,
  parseWellbeingDigestPreview,
  parsePublicResourceDetail,
  parseResourceJourney,
  parseResourceProgressItem,
  parseResourceProgressList,
  parseResourceProgressUpdate,
  parseResourceSummary,
} from './content-validation'

const requiredSummary = {
  id: '123e4567-e89b-42d3-a456-426614174000',
  category: 'ARTICLE',
  locale: 'vi-VN',
  title: 'Grounding guide',
  summary: 'A short grounding exercise.',
  status: 'DRAFT',
  createdAt: '2026-09-12T00:00:00Z',
}

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
    communityInteraction: true,
  },
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '07:00',
    timeZone: 'Asia/Ho_Chi_Minh',
  },
  email: {
    cadence: 'IMMEDIATE',
    wellbeingDigestEnabled: false,
    resourceRemindersEnabled: false,
    appointmentRemindersEnabled: false,
    dailyDigestTime: '19:00',
    resourceReminderTime: '18:30',
  },
  version: 0,
  updatedAt: '2026-09-26T00:00:00.000Z',
}

const notification = {
  id: '223e4567-e89b-42d3-a456-426614174000',
  kind: 'SYSTEM_RESOURCE',
  title: 'Tài nguyên mới',
  body: 'Một tài nguyên đã được cập nhật.',
  priority: 'NORMAL',
  occurredAt: '2026-09-26T01:00:00.000Z',
  createdAt: '2026-09-26T01:00:01.000Z',
  read: false,
  readAt: null,
  action: {
    type: 'OPEN_RESOURCE',
    targetId: '323e4567-e89b-42d3-a456-426614174000',
    href: '/resources/323e4567-e89b-42d3-a456-426614174000',
  },
  lifecycleState: 'ACTIVE',
  expiresAt: '2026-12-25T01:00:01.000Z',
}

describe('Content response validation', () => {
  it('accepts a ResourceSummary containing only OpenAPI-required fields', () => {
    expect(parseResourceSummary(requiredSummary)).toEqual(requiredSummary)
  })

  it('validates optional ResourceSummary fields when the provider includes them', () => {
    expect(
      parseResourceSummary({
        ...requiredSummary,
        externalUrl: 'javascript:alert(1)',
      }),
    ).toBeNull()
    expect(
      parseResourceSummary({ ...requiredSummary, reviewedAt: 'not-a-date' }),
    ).toBeNull()
    expect(
      parseResourceSummary({ ...requiredSummary, updatedAt: 'not-a-date' }),
    ).toBeNull()
  })

  it('accepts structured public detail provenance and rejects unsafe source URLs', () => {
    const detail = {
      ...requiredSummary,
      status: 'PUBLISHED',
      contentVersion: '4',
      contentBody: 'Reviewed body',
      sourceOrganization: 'NHS',
      sourceTitle: 'Reviewed source',
      sourceUrl: 'https://www.nhs.uk/mental-health/',
      sourceReviewNote: 'Reviewed adaptation',
      effectiveAt: '2026-09-23T00:00:00Z',
      expiresAt: null,
    }
    expect(parsePublicResourceDetail(detail)).toEqual(detail)
    expect(
      parsePublicResourceDetail({
        ...detail,
        sourceUrl: 'javascript:alert(1)',
      }),
    ).toBeNull()
    expect(
      parsePublicResourceDetail({ ...detail, contentVersion: 'latest' }),
    ).toBeNull()
  })

  it('accepts closed resource progress shapes without private reflection text', () => {
    const progress = {
      resourceId: requiredSummary.id,
      localDate: '2026-09-29',
      contentVersion: '4',
      status: 'COMPLETED',
      completedActionIds: ['read', 'takeaway'],
      completedAt: '2026-09-29T02:00:00.000Z',
      updatedAt: '2026-09-29T02:00:00.000Z',
      version: '1',
    }
    expect(parseResourceProgressItem(progress)).toEqual(progress)
    expect(parseResourceProgressList({ items: [progress] })).toEqual({
      items: [progress],
    })
    expect(
      parseResourceProgressUpdate({
        status: 'IN_PROGRESS',
        completedActionIds: ['read'],
      }),
    ).toEqual({ status: 'IN_PROGRESS', completedActionIds: ['read'] })
    const practiceSessionId = '323e4567-e89b-42d3-a456-426614174000'
    expect(
      parseResourceProgressUpdate({
        status: 'COMPLETED',
        completedActionIds: ['practice'],
        practiceSessionId,
        practiceStartedAt: '2026-09-29T01:58:00.000Z',
        practiceDurationSeconds: 120,
      }),
    ).toEqual({
      status: 'COMPLETED',
      completedActionIds: ['practice'],
      practiceSessionId,
      practiceStartedAt: '2026-09-29T01:58:00.000Z',
      practiceDurationSeconds: 120,
    })
    expect(
      parseResourceProgressUpdate({
        status: 'COMPLETED',
        completedActionIds: ['practice'],
        practiceDurationSeconds: 120,
      }),
    ).toBeNull()
    expect(
      parseResourceProgressUpdate({
        status: 'IN_PROGRESS',
        completedActionIds: [],
        reflectionText: 'private',
      }),
    ).toBeNull()
  })

  it('requires the support-plan day and stage in a resource journey', () => {
    const journey = {
      assignmentId: '323e4567-e89b-42d3-a456-426614174000',
      localDate: '2026-09-29',
      planId: '423e4567-e89b-42d3-a456-426614174000',
      planVersion: 4,
      planDay: 10,
      planStage: 'MAINTENANCE',
      items: [],
      progress: {
        dailyCompleted: 0,
        dailyTotal: 0,
        learningCompleted: 0,
        learningTotal: 0,
        practiceStreakDays: 3,
      },
      weekStart: '2026-09-28',
      bingo: [],
    }

    expect(parseResourceJourney(journey)).toEqual(journey)
    expect(parseResourceJourney({ ...journey, planDay: 15 })).toBeNull()
    expect(
      parseResourceJourney({ ...journey, planStage: undefined }),
    ).toBeNull()
  })

  it('accepts the complete preference aggregate and rejects malformed provider fields', () => {
    expect(parseNotificationPreferences(preferences)).toEqual(preferences)
    expect(
      parseNotificationPreferences({ ...preferences, version: -1 }),
    ).toBeNull()
    expect(
      parseNotificationPreferences({
        ...preferences,
        channels: { inApp: true },
      }),
    ).toBeNull()
    expect(
      parseNotificationPreferences({
        ...preferences,
        privateJournalText: 'secret',
      }),
    ).toBeNull()
  })

  it('accepts preference responses from old backends that omit appointmentRemindersEnabled (MB-517 rollout)', () => {
    // Old content-notification-service does not return appointmentRemindersEnabled.
    // The frontend must parse this gracefully and treat the capability as absent.
    const emailWithoutField = { ...preferences.email }
    delete (emailWithoutField as { appointmentRemindersEnabled?: boolean })
      .appointmentRemindersEnabled
    const oldBackendPreferences = { ...preferences, email: emailWithoutField }
    const parsed = parseNotificationPreferences(oldBackendPreferences)
    expect(parsed).not.toBeNull()
    expect(parsed?.email.appointmentRemindersEnabled).toBeUndefined()

    // A non-boolean value must still be rejected even from old backends.
    expect(
      parseNotificationPreferences({
        ...oldBackendPreferences,
        email: { ...emailWithoutField, appointmentRemindersEnabled: 'yes' },
      }),
    ).toBeNull()

    // Spurious unknown keys are still rejected.
    expect(
      parseNotificationPreferences({
        ...preferences,
        email: { ...preferences.email, unknownFutureField: true },
      }),
    ).toBeNull()
  })

  it('accepts closed partial preference updates', () => {
    expect(
      parseNotificationPreferencePatch({ channels: { push: true } }),
    ).toEqual({ channels: { push: true } })
    expect(
      parseNotificationPreferencePatch({ quietHours: { start: '24:00' } }),
    ).toBeNull()
    expect(
      parseNotificationPreferencePatch({ channels: { sms: true } }),
    ).toBeNull()
    expect(parseNotificationPreferencePatch({})).toBeNull()
    expect(
      parseNotificationPreferencePatch({
        contentGroups: { communityInteraction: false },
      }),
    ).toEqual({ contentGroups: { communityInteraction: false } })
  })

  it('accepts only bounded privacy-safe wellbeing digest previews', () => {
    const preview = {
      localDate: '2026-09-30',
      timeZone: 'Asia/Ho_Chi_Minh',
      scheduledTime: '19:00',
      eligibleNow: true,
      resourceItems: [
        { id: '323e4567-e89b-42d3-a456-426614174000', title: 'Thở chậm' },
      ],
      includeJournalPrompt: true,
      includeEmotionPrompt: false,
      empty: false,
    }
    expect(parseWellbeingDigestPreview(preview)).toEqual(preview)
    expect(
      parseWellbeingDigestPreview({ ...preview, journalBody: 'private' }),
    ).toBeNull()
    expect(
      parseWellbeingDigestPreview({ ...preview, scheduledTime: '25:00' }),
    ).toBeNull()
  })

  it('accepts the closed notification shape and rejects arbitrary or mismatched actions', () => {
    expect(parseNotification(notification)).toEqual(notification)
    for (const kind of [
      'JOURNAL_REMINDER',
      'EMOTION_CHECKIN_REMINDER',
      'JOURNAL_STREAK_MILESTONE',
      'EMOTION_STREAK_MILESTONE',
      'COMMUNITY_COMMENT',
      'COMMUNITY_REPLY',
      'COMMUNITY_REACTION',
    ] as const) {
      expect(parseNotification({ ...notification, kind })).not.toBeNull()
    }
    expect(
      parseNotification({
        ...notification,
        action: { ...notification.action, href: 'https://untrusted.example' },
      }),
    ).toBeNull()
    const communityPostId = '423e4567-e89b-42d3-a456-426614174000'
    expect(
      parseNotification({
        ...notification,
        kind: 'COMMUNITY_COMMENT',
        action: {
          type: 'OPEN_COMMUNITY_POST',
          targetId: communityPostId,
          href: `/community/${communityPostId}`,
        },
      }),
    ).not.toBeNull()
    expect(
      parseNotification({
        ...notification,
        kind: 'COMMUNITY_COMMENT',
        action: {
          type: 'OPEN_COMMUNITY_POST',
          targetId: communityPostId,
          href: '/community/different-post',
        },
      }),
    ).toBeNull()
    expect(
      parseNotification({
        ...notification,
        action: { ...notification.action, href: '/resources/other' },
      }),
    ).toBeNull()
    expect(
      parseNotification({
        ...notification,
        action: {
          type: 'OPEN_MESSAGES',
          targetId: null,
          href: '/admin',
        },
      }),
    ).toBeNull()
    expect(
      parseNotification({ ...notification, read: true, readAt: null }),
    ).toBeNull()
  })

  it('requires pagination continuation state to agree', () => {
    expect(
      parseNotificationPage({
        items: [notification],
        nextCursor: 'next',
        hasMore: true,
        unreadCount: 1,
      }),
    ).not.toBeNull()
    expect(
      parseNotificationPage({
        items: [notification],
        nextCursor: null,
        hasMore: true,
        unreadCount: 1,
      }),
    ).toBeNull()
  })
})
