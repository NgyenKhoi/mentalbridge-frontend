import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import {
  reminderDate,
  reminderDestination,
  reminderTime,
  type ReminderDestination,
} from './reminder-model'
import { reminderUiFixtureAction } from './reminder-test-fixtures'

it.each<ReminderDestination>([
  'support-plan',
  'emotion',
  'journal',
  'resources',
  'notifications',
])(
  'opens the installed owner route for %s without private payloads',
  (destination) => {
    const route = reminderDestination(reminderUiFixtureAction({ destination }))
    expect(route).toEqual({ pathname: `/(user)/${destination}` })
    const routeRoot = path.join(__dirname, '../app/(user)', destination)
    expect(
      existsSync(`${routeRoot}.tsx`) ||
        existsSync(path.join(routeRoot, 'index.tsx')),
    ).toBe(true)
  },
)

it('refuses a CTA for unavailable actions even if a destination exists', () => {
  expect(
    reminderDestination(reminderUiFixtureAction({ status: 'unavailable' })),
  ).toBeNull()
})

it('refuses missing and unrecognized destinations', () => {
  expect(
    reminderDestination(reminderUiFixtureAction({ destination: null })),
  ).toBeNull()
  const invalid = JSON.parse('{"destination":"https://untrusted.invalid"}')
  expect(
    reminderDestination({ ...reminderUiFixtureAction(), ...invalid }),
  ).toBeNull()
})

it('renders the owner timezone across a UTC date boundary', () => {
  expect(reminderTime('2026-10-21T18:00:00Z', 'Asia/Ho_Chi_Minh')).toMatch(
    /1:00.*22\/10\/26|22\/10\/26.*1:00/,
  )
  expect(reminderDate('2026-10-22')).toContain('22')
})

it('uses the A2 reader without fabricated rows or fixture imports', () => {
  const route = readFileSync(
    path.join(__dirname, 'ReminderCenterRoute.tsx'),
    'utf8',
  )
  expect(route).toContain('createReminderSource(')
  expect(route).not.toMatch(/test-fixtures|mock|__DEV__/)
})
