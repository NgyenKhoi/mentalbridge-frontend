import { notificationDestination } from './notification-link'
import type { NotificationAction } from './notification-contract'
import { targetId, notification } from './notification-fixtures'
import { notificationSchema } from './notification-contract'

it.each([
  ['OPEN_COMMUNITY_CONVERSATION', 'conversations', 'conversationId'],
  ['OPEN_COMMUNITY_REQUEST', 'requests', 'requestId'],
  ['OPEN_COMMUNITY_INVITATION', 'invitations', 'invitationId'],
] as const)(
  'maps %s only for the exact published target descriptor',
  (type, segment, param) => {
    const href = `/community/chat/${segment}/${targetId}`
    expect(notificationDestination({ type, href, targetId })).toEqual({
      pathname: '/(user)/community-chat',
      params: { [param]: targetId },
    })
    for (const invalid of [
      `https://evil.invalid${href}`,
      `${href}?actor=other`,
      `${href}#private`,
      `${href}/../other`,
      `/community/chat/wrong/${targetId}`,
    ])
      expect(
        notificationDestination({ type, href: invalid, targetId }),
      ).toBeNull()
    expect(notificationDestination({ type, href, targetId: null })).toBeNull()
    expect(
      notificationDestination({
        type,
        href: href.replace(targetId, 'bad'),
        targetId: 'bad',
      }),
    ).toBeNull()
  },
)
it.each([
  'COMMUNITY_MESSAGE',
  'COMMUNITY_REQUEST',
  'COMMUNITY_INVITATION',
  'ASSESSMENT_RESULT_AVAILABLE',
  'SUPPORT_GUIDE_AVAILABLE',
  'ACCOUNT_STATUS',
] as const)(
  'accepts current canonical notification kind %s without opening arbitrary descriptors',
  (kind) => {
    expect(notificationSchema.safeParse(notification({ kind })).success).toBe(
      true,
    )
  },
)
it('keeps unsupported specialist and support-guide actions closed on the USER consumer', () => {
  expect(
    notificationDestination({
      type: 'OPEN_SPECIALIST_APPOINTMENTS',
      href: '/specialist/appointments',
      targetId: null,
    }),
  ).toBeNull()
  expect(
    notificationDestination({
      type: 'OPEN_SUPPORT_GUIDE',
      href: `/support-guides/${targetId}`,
      targetId,
    }),
  ).toBeNull()
})
it.each([
  ['OPEN_JOURNAL', '/journal', '/(user)/journal'],
  ['OPEN_MESSAGES', '/messages', '/(user)/messages'],
  ['OPEN_APPOINTMENTS', '/appointments', '/(user)/appointments'],
  ['OPEN_RESOURCES', '/resources', '/(user)/resources'],
  ['OPEN_ASSESSMENTS', '/assessments', '/(user)/assessment'],
] as const)(
  'maps %s to an installed mobile destination',
  (type, href, pathname) => {
    expect(notificationDestination({ type, href, targetId: null })).toEqual({
      pathname,
    })
  },
)
it('maps only exact targeted resource and Community paths', () => {
  expect(
    notificationDestination({
      type: 'OPEN_RESOURCE',
      targetId,
      href: `/resources/${targetId}`,
    }),
  ).toEqual({
    pathname: '/(user)/resources/[resourceId]',
    params: { resourceId: targetId },
  })
  expect(
    notificationDestination({
      type: 'OPEN_COMMUNITY_POST',
      targetId,
      href: `/community/${targetId}`,
    }),
  ).toEqual({ pathname: '/(user)/community', params: { postId: targetId } })
})
it.each([
  'https://evil.invalid/journal',
  '//evil.invalid',
  'javascript:alert(1)',
  '/journal?actor=other',
  '/journal#private',
  '/%6aournal',
  '/journal/../messages',
  '/messages',
])('rejects malformed or mismatched link %s', (href) => {
  expect(
    notificationDestination({ type: 'OPEN_JOURNAL', href, targetId: null }),
  ).toBeNull()
})
it.each([
  { type: 'OPEN_JOURNAL', href: '/journal', targetId },
  { type: 'OPEN_RESOURCE', href: `/resources/${targetId}`, targetId: null },
  {
    type: 'OPEN_RESOURCE',
    href: '/resources/33333333-3333-4333-8333-333333333333',
    targetId,
  },
] satisfies NotificationAction[])('rejects target identity drift', (action) =>
  expect(notificationDestination(action)).toBeNull(),
)
it('does not invent a destination for a null action', () =>
  expect(notificationDestination(null)).toBeNull())
