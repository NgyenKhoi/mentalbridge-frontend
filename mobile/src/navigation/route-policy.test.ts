import type { AppSession } from '@/auth/session'

import { getRouteGuards } from './route-policy'

describe('role-aware route policy', () => {
  it('exposes only public routes without a session', () => {
    expect(getRouteGuards(null)).toEqual({
      public: true,
      specialist: false,
      user: false,
    })
  })

  it.each([
    [
      { role: 'USER', subject: 'synthetic-user-subject' } satisfies AppSession,
      { public: false, specialist: false, user: true },
    ],
    [
      {
        role: 'SPECIALIST',
        subject: 'synthetic-specialist-subject',
      } satisfies AppSession,
      { public: false, specialist: true, user: false },
    ],
  ])('isolates routes for session %#', (session, expected) => {
    expect(getRouteGuards(session)).toEqual(expected)
  })
})
