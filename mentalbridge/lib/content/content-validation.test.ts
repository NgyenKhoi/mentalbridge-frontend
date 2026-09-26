import { describe, expect, it } from 'vitest'

import {
  parseNotification,
  parseNotificationPage,
  parseNotificationPreferencePatch,
  parseNotificationPreferences,
  parsePublicResourceDetail,
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
  })

  it('accepts the closed notification shape and rejects arbitrary or mismatched actions', () => {
    expect(parseNotification(notification)).toEqual(notification)
    expect(
      parseNotification({
        ...notification,
        action: { ...notification.action, href: 'https://untrusted.example' },
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
