import { describe, expect, it } from 'vitest'

import {
  isMamCelebrationRoute,
  isMamDockRoute,
  mamRouteMode,
} from './mam-routes'

describe('mamRouteMode', () => {
  it.each([
    '/dashboard',
    '/dashboard/',
    '/achievements',
    '/resources',
    '/nhin-lai',
  ])('is FULL on %s', (path) => expect(mamRouteMode(path)).toBe('full'))

  it.each([
    '/journal',
    '/journal/',
    '/ai-companion',
    '/support-plan',
    '/support-plan/',
    '/support-guides',
    '/support-guides/guide-1',
    '/appointments',
    '/appointments/a-1',
    '/messages',
    '/notifications',
    '/profile',
    '/specialists',
    '/resources/resource-1',
    '/initial-check',
  ])('is QUIET on %s', (path) => expect(mamRouteMode(path)).toBe('quiet'))

  it.each([
    '/appointments/a-1/chat',
    '/appointments/a-1/video',
    '/call/a-1',
    '/assessments',
    '/assessments/results/e-1',
    '/community',
    '/community/post-1',
    '/community/reels',
    '/community/groups/g-1',
    '/community/members/m-1',
    '/community/messages',
    '/community/messages/c-1',
    '/community/chat/dm/t-1',
    '/subscription',
    '/assessment/phq-9',
    '/assessment/anonymous',
    '/safety-directory',
  ])('is HIDDEN on %s', (path) => expect(mamRouteMode(path)).toBe('hidden'))

  it.each([
    null,
    '/',
    '/login',
    '/support-plan/today',
    '/journal/new',
    '/resources/a/b',
    '/dashboard-preview',
    '/admin',
    '/specialist/dashboard',
    '/something-new',
  ])('defaults to HIDDEN on %s', (path) =>
    expect(mamRouteMode(path)).toBe('hidden'),
  )
})

describe('isMamDockRoute', () => {
  it('shows the dock in FULL and QUIET and not in HIDDEN', () => {
    expect(isMamDockRoute('/dashboard')).toBe(true)
    expect(isMamDockRoute('/journal')).toBe(true)
    expect(isMamDockRoute('/call/a-1')).toBe(false)
    expect(isMamDockRoute(null)).toBe(false)
  })
})

describe('isMamCelebrationRoute', () => {
  it.each(['/dashboard', '/achievements', '/resources', '/nhin-lai'])(
    'plays celebrations on %s',
    (path) => expect(isMamCelebrationRoute(path)).toBe(true),
  )

  it.each([
    null,
    '/journal',
    '/support-guides/g-1',
    '/support-plan',
    '/resources/r-1',
  ])('keeps celebrations waiting on %s', (path) =>
    expect(isMamCelebrationRoute(path)).toBe(false),
  )
})
