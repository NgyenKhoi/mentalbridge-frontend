import { describe, expect, it } from 'vitest'

import { isMamDockRoute, isMamStaticDockRoute } from './mam-routes'

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
  ])('shows the dock on %s', (path) => {
    expect(isMamDockRoute(path)).toBe(true)
  })

  it.each([
    null,
    '/',
    '/login',
    '/support-plan',
    '/support-plan/today',
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
    expect(isMamStaticDockRoute('/resources/resource-1')).toBe(false)
  })
})
