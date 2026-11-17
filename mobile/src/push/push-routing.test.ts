import { notificationActionSchema } from '@/notifications/notification-contract'

import { parsePushData, pushDestination } from './push-routing'

const id = '3f1c8a52-4a5b-4a3e-9d2e-0c6f4f0a1b11'
const target = '9b2f6d1e-7c3a-4e58-8a41-5d0e2b7c9f33'
const data = (kind: string, action: unknown = null) => ({
  notificationId: id,
  kind,
  action,
})
const action = (type: string, targetId: string | null, href: string) =>
  notificationActionSchema.parse({ type, targetId, href })

const userInbox = { pathname: '/(user)/notifications' }
const specialistInbox = { pathname: '/(specialist)/notifications' }

describe('push destination', () => {
  it.each(['EMOTION_CHECKIN_REMINDER', 'EMOTION_STREAK_MILESTONE'])(
    'opens the home emotion section for %s',
    (kind) => {
      expect(pushDestination(data(kind), 'USER')).toEqual({
        pathname: '/(user)/user',
        params: { focus: 'emotion' },
      })
    },
  )

  it('opens the journal for a journal action', () => {
    expect(
      pushDestination(
        data('JOURNAL_REMINDER', action('OPEN_JOURNAL', null, '/journal')),
        'USER',
      ),
    ).toEqual({ pathname: '/(user)/journal' })
  })

  it('opens the support plan for the plan reminder, USER only', () => {
    const plan = data(
      'SUPPORT_PLAN_DAILY_REMINDER',
      action('OPEN_SUPPORT_PLAN', null, '/support-plan'),
    )
    expect(pushDestination(plan, 'USER')).toEqual({
      pathname: '/(user)/support-plan',
    })
    expect(pushDestination(plan, 'SPECIALIST')).toEqual(specialistInbox)
  })

  it('opens a resource and the resource list', () => {
    expect(
      pushDestination(
        data(
          'SYSTEM_RESOURCE',
          action('OPEN_RESOURCE', target, `/resources/${target}`),
        ),
        'USER',
      ),
    ).toEqual({
      pathname: '/(user)/resources/[resourceId]',
      params: { resourceId: target },
    })
    expect(
      pushDestination(
        data('SYSTEM_RESOURCE', action('OPEN_RESOURCES', null, '/resources')),
        'USER',
      ),
    ).toEqual({ pathname: '/(user)/resources' })
  })

  it('opens the same community target as the inbox', () => {
    expect(
      pushDestination(
        data(
          'COMMUNITY_MESSAGE',
          action(
            'OPEN_COMMUNITY_CONVERSATION',
            target,
            `/community/chat/conversations/${target}`,
          ),
        ),
        'USER',
      ),
    ).toEqual({
      pathname: '/(user)/community-chat',
      params: { conversationId: target },
    })
  })

  it('opens specialist appointments for a specialist', () => {
    expect(
      pushDestination(
        data(
          'APPOINTMENT',
          action(
            'OPEN_SPECIALIST_APPOINTMENTS',
            null,
            '/specialist/appointments',
          ),
        ),
        'SPECIALIST',
      ),
    ).toEqual({ pathname: '/(specialist)/appointments' })
  })

  it('does not send a specialist to the user emotion section', () => {
    expect(
      pushDestination(data('EMOTION_CHECKIN_REMINDER'), 'SPECIALIST'),
    ).toEqual(specialistInbox)
  })

  it.each([
    ['missing data', undefined],
    ['non-object data', 'text'],
    [
      'bad notification id',
      { notificationId: 'x', kind: 'APPOINTMENT', action: null },
    ],
    [
      'unknown action type',
      data('APPOINTMENT', { type: 'OPEN_SECRET', targetId: null, href: '/x' }),
    ],
    [
      'extra action key',
      data('APPOINTMENT', {
        type: 'OPEN_JOURNAL',
        targetId: null,
        href: '/journal',
        note: 'x',
      }),
    ],
  ])('falls back to the inbox for %s', (_name, value) => {
    expect(pushDestination(value, 'USER')).toEqual(userInbox)
    expect(pushDestination(value, 'SPECIALIST')).toEqual(specialistInbox)
    expect(parsePushData(value)).toBeNull()
  })

  it('falls back to the inbox for an unknown kind without a usable action', () => {
    expect(pushDestination(data('FUTURE_KIND'), 'USER')).toEqual(userInbox)
  })

  it('falls back to the inbox for an unknown kind even with a valid action', () => {
    expect(
      pushDestination(
        data('FUTURE_KIND', action('OPEN_JOURNAL', null, '/journal')),
        'USER',
      ),
    ).toEqual(userInbox)
  })

  it('opens appointments for an appointment reminder action', () => {
    expect(
      pushDestination(
        data(
          'APPOINTMENT',
          action('OPEN_APPOINTMENT', target, `/appointments/${target}`),
        ),
        'USER',
      ),
    ).toEqual({ pathname: '/(user)/appointments' })
  })

  it('falls back to the inbox when the href does not match the action', () => {
    expect(
      pushDestination(
        data('JOURNAL_REMINDER', action('OPEN_JOURNAL', null, '/elsewhere')),
        'USER',
      ),
    ).toEqual(userInbox)
  })
})
