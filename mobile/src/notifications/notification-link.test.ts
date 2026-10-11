import { notificationDestination } from './notification-link'
import type { NotificationAction } from './notification-contract'
import { targetId } from './notification-fixtures'
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
