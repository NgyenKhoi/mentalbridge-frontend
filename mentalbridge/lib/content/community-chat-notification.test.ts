import { describe, expect, it } from 'vitest'

import { parseNotification, parseNotificationPage } from './content-validation'

const targetId = '20000000-0000-4000-8000-000000000001'
const variants = [
  ['COMMUNITY_MESSAGE', 'OPEN_COMMUNITY_CONVERSATION', 'conversations'],
  ['COMMUNITY_REQUEST', 'OPEN_COMMUNITY_REQUEST', 'requests'],
  ['COMMUNITY_INVITATION', 'OPEN_COMMUNITY_INVITATION', 'invitations'],
] as const

function notice(kind: string, type: string, segment: string) {
  return {
    id: '30000000-0000-4000-8000-000000000001',
    kind,
    title: 'Thông báo cộng đồng',
    body: 'Bạn có thông báo mới.',
    priority: 'NORMAL',
    occurredAt: '2026-10-22T08:00:00Z',
    createdAt: '2026-10-22T08:00:01Z',
    read: false,
    readAt: null,
    action: { type, targetId, href: `/community/chat/${segment}/${targetId}` },
    lifecycleState: 'ACTIVE',
    expiresAt: '2027-01-20T08:00:01Z',
  }
}

describe('Community chat notification boundary', () => {
  it.each(variants)(
    'accepts the exact %s action without breaking the inbox',
    (kind, type, segment) => {
      const item = notice(kind, type, segment)
      expect(parseNotification(item)).toEqual(item)
      expect(
        parseNotificationPage({
          items: [item],
          nextCursor: null,
          hasMore: false,
          unreadCount: 1,
        }),
      ).not.toBeNull()
    },
  )

  it.each(variants)(
    'rejects forged or mismatched targets for %s',
    (kind, type, segment) => {
      const item = notice(kind, type, segment)
      for (const href of [
        `/community/chat/${segment}/40000000-0000-4000-8000-000000000001`,
        `/community/chat/${segment}/${targetId}?redirect=/admin`,
        `//example.com/community/chat/${segment}/${targetId}`,
        '/admin',
      ])
        expect(
          parseNotification({ ...item, action: { ...item.action, href } }),
        ).toBeNull()
      expect(
        parseNotification({
          ...item,
          action: { ...item.action, targetId: 'invalid' },
        }),
      ).toBeNull()
      expect(
        parseNotification({ ...item, kind: 'COMMUNITY_REACTION' }),
      ).toBeNull()
    },
  )
})
