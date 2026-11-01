import { describe, expect, it } from 'vitest'

import {
  isMamCelebrationRoute,
  isMamDockRoute,
  isMamStaticDockRoute,
} from './mam-routes'

describe('isMamDockRoute', () => {
  it.each([
    '/dashboard',
    '/dashboard/',
    '/achievements',
    '/support-guides',
    '/support-guides/guide-1',
    '/journal',
    '/resources',
    '/resources/resource-1',
    '/support-plan',
    '/support-plan/',
  ])('shows the dock on %s', (path) => {
    expect(isMamDockRoute(path)).toBe(true)
  })

  it.each([
    null,
    '/',
    '/login',
    '/support-plan/today',
    '/support-plan/anything',
    '/assessment/phq-9',
    '/assessments',
    '/initial-check',
    '/journal/new',
    '/ai-companion',
    '/messages',
    '/appointments',
    '/subscription',
    '/community',
    '/admin',
    '/specialist/dashboard',
    '/dashboard-preview',
    '/resources/a/b',
  ])('hides the dock on %s', (path) => {
    expect(isMamDockRoute(path)).toBe(false)
  })

  it('keeps the journal list static and the other dock routes animated', () => {
    expect(isMamStaticDockRoute('/journal')).toBe(true)
    expect(isMamStaticDockRoute('/journal/')).toBe(true)
    expect(isMamStaticDockRoute('/dashboard')).toBe(false)
    expect(isMamStaticDockRoute('/support-plan')).toBe(false)
    expect(isMamStaticDockRoute('/resources/resource-1')).toBe(false)
  })
})

describe('isMamCelebrationRoute', () => {
  it.each(['/dashboard', '/achievements', '/resources', '/resources/r-1'])(
    'plays celebrations on %s',
    (path) => expect(isMamCelebrationRoute(path)).toBe(true),
  )

  it.each([
    null,
    '/journal',
    '/support-guides',
    '/support-guides/g-1',
    '/support-plan',
    '/resources/a/b',
  ])('keeps celebrations waiting on %s', (path) =>
    expect(isMamCelebrationRoute(path)).toBe(false),
  )
})
