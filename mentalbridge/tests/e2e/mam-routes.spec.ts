import { expect, type Page } from '@playwright/test'

import { test } from './test-fixtures'
import {
  homeResourceDetails,
  homeWorld,
  installHomeMocks,
} from './home-next-step-mocks'
import {
  box,
  dock,
  dockRoot,
  expectNothingCoveredAtBottom,
  expectPageActionsClickable,
} from './mam-dock-helpers'
import {
  installPlanResourcesMocks,
  resourceWorld,
} from './plan-resources-mocks'

// MB-895: the route surface matrix V2 (docs/ADR_MAM_RIVE_V2_CONTRACT.md). One Mầm per tab, a mode per route:
// FULL lives and celebrates, QUIET is docked and calm, HIDDEN renders nothing.

const resourceId = homeResourceDetails()[0]!.id
// `/resources` is FULL too; it needs the plan-and-resources fixtures, so the welcome test walks it.
const FULL = ['/dashboard', '/achievements']
const QUIET = [
  '/journal',
  '/ai-companion',
  '/support-plan',
  '/support-guides',
  '/appointments',
  '/notifications',
  '/profile',
  '/specialists',
  `/resources/${resourceId}`,
]
// The community and plans-and-payment are out of scope (owner, 2026-11-22); screening is private.
const HIDDEN = [
  '/assessments',
  '/subscription',
  '/community',
  '/safety-directory',
]

// Fixtures for the data-backed walks (shapes from appointment-changes.spec.ts and achievements.spec.ts).
const appointment = {
  id: '123e4567-e89b-42d3-a456-426614174003',
  slotId: '123e4567-e89b-42d3-a456-426614174004',
  specialistAccountId: '123e4567-e89b-42d3-a456-426614174005',
  specialistDisplayName: 'Chuyên gia Nguyễn An',
  status: 'REQUESTED',
  modality: 'IN_APP_CHAT',
  scheduledStartAt: '2099-01-03T04:00:00Z',
  scheduledEndAt: '2099-01-03T05:00:00Z',
  timezone: 'Asia/Ho_Chi_Minh',
  requestedAt: '2099-01-01T00:00:00Z',
  decisionDeadlineAt: '2099-01-02T04:00:00Z',
  heldCreditId: '123e4567-e89b-42d3-a456-426614174006',
  replacesAppointmentId: null,
  replacedByAppointmentId: null,
  decidedAt: null,
  decisionReason: null,
  cancelledAt: null,
  cancellationReason: null,
  cancellationActor: null,
  cancellationCreditOutcome: null,
  creditState: 'HELD',
  history: [
    {
      eventId: '223e4567-e89b-42d3-a456-426614174003',
      fromStatus: null,
      toStatus: 'REQUESTED',
      actorType: 'USER',
      actorId: '323e4567-e89b-42d3-a456-426614174003',
      reason: 'APPOINTMENT_REQUESTED',
      creditOutcome: null,
      occurredAt: '2099-01-01T00:00:00Z',
    },
  ],
  version: 0,
}
const bookableSlots = {
  items: [
    {
      id: '123e4567-e89b-42d3-a456-426614174001',
      specialistAccountId: '123e4567-e89b-42d3-a456-426614174002',
      specialistDisplayName: 'Chuyên gia Trần Minh',
      startAt: '2099-01-04T02:00:00Z',
      endAt: '2099-01-04T03:00:00Z',
      timezone: 'Asia/Ho_Chi_Minh',
      modality: 'IN_APP_CHAT',
    },
  ],
  count: 1,
  generatedAt: '2099-01-01T00:00:00Z',
  videoEnabled: false,
}
const achievements = {
  visibilityState: 'VISIBLE',
  preferenceVersion: '0',
  policyVersion: 'achievement-rules-v1',
  calculatedAt: '2026-10-13T05:00:00.000Z',
  sources: [
    {
      domain: 'JOURNAL',
      availability: 'AVAILABLE',
      asOfLocalDate: '2026-10-13',
    },
    { domain: 'RESOURCE', availability: 'AVAILABLE', asOfLocalDate: null },
  ],
  items: [
    [
      'journal.first-entry',
      'JOURNAL',
      'MILESTONE',
      'FIRST_STEP',
      'Trang viết đầu tiên',
      'EARNED',
    ],
    [
      'journal.streak-7-days',
      'JOURNAL',
      'CONSISTENCY',
      'DEEPENING_STEP',
      'Một nhịp viết bảy ngày',
      'UNEARNED',
    ],
    [
      'resource.first-completion',
      'RESOURCE',
      'MILESTONE',
      'FIRST_STEP',
      'Tài nguyên đầu tiên đã hoàn thành',
      'EARNED',
    ],
    [
      'resource.variety-3',
      'RESOURCE',
      'MILESTONE',
      'STEADY_STEP',
      'Khám phá ba tài nguyên khác nhau',
      'UNEARNED',
    ],
  ].map(([definitionId, domain, kind, tier, title, status]) => ({
    definitionId,
    domain,
    kind,
    tier,
    title,
    description: 'Mốc riêng tư dựa trên hoạt động đã lưu.',
    status,
    evidenceClass:
      kind === 'CONSISTENCY' ? 'OWNER_STREAK_MILESTONE' : 'OWNER_SOURCE_FACT',
    unlockedAt: status === 'EARNED' ? '2026-10-12T05:00:00.000Z' : null,
    ruleVersion: 'achievement-rules-v1',
    privacy: 'PRIVATE',
    progress: {
      current: status === 'EARNED' ? 1 : 0,
      target: 1,
      unit: 'EVENT',
    },
  })),
}

async function open(page: Page, width: number, resources = false) {
  if (resources) {
    await installPlanResourcesMocks(page, resourceWorld(1))
    // An empty catalogue keeps page actions out from under the dock (as mam-gate.spec.ts does).
    await page.route(/\/api\/resources(?:\?.*)?$/, (route) =>
      route.fulfill({ json: { items: [], hasMore: false } }),
    )
  } else await installHomeMocks(page, homeWorld('do-today'))
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 })
}
const planes = (page: Page) => page.locator('[data-mam-plane]')

test.describe('MB-895 Mầm route surface matrix', () => {
  test.use({ timezoneId: 'Asia/Ho_Chi_Minh' })
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'The route matrix uses browser-owned fixtures only.',
  )

  for (const width of [1440, 375]) {
    test(`shows one Mầm with the right mode on FULL and QUIET routes and none on HIDDEN at ${width}`, async ({
      page,
    }) => {
      test.setTimeout(240_000)
      await open(page, width)
      for (const [routes, mode] of [
        [FULL, 'full'],
        [QUIET, 'quiet'],
      ] as const)
        for (const route of routes) {
          await page.goto(route)
          await expect(page.locator('[data-mam-dock]'), route).toHaveCount(1)
          await expect(dockRoot(page), route).toHaveAttribute(
            'data-mam-mode',
            mode,
          )
          await expect(dock(page), route).toBeVisible()
          // Bottom-left controls: Mầm yields or stays clear, never covers one (ADR layering).
          await expectPageActionsClickable(page)
          await expectNothingCoveredAtBottom(page)
        }
      for (const route of HIDDEN) {
        await page.goto(route)
        await expect(page.locator('main, form, h1').first()).toBeVisible()
        // Give a late host time to show itself, then require it never did.
        await page.waitForTimeout(600)
        await expect(page.locator('[data-mam-dock]'), route).toHaveCount(0)
      }
    })
  }

  test('QUIET keeps the welcome off; the first FULL route plays it once, and returning to it with the replay query still in the URL does not replay it', async ({
    page,
  }) => {
    await open(page, 1440, true)
    // A QUIET route never plays it, even with the replay query.
    await page.goto('/journal?mamWelcome=1')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-mode', 'quiet')
    await page.waitForTimeout(2_000)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'dock')
    await expect(planes(page)).toHaveCount(0)

    // The first FULL route reached plays it (`/resources` is not `/dashboard`).
    await page.goto('/resources?mamWelcome=1&mamVariation=airplane')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-mode', 'full')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'welcome', {
      timeout: 10_000,
    })
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'dock', {
      timeout: 10_000,
    })
    await expect(planes(page)).toHaveCount(0, { timeout: 4_000 })

    // FULL to QUIET to FULL in the same page: the same character, and no second scene.
    const nav = page.getByRole('navigation', { name: 'Điều hướng chính' })
    await page
      .locator('[data-mam-dock] canvas')
      .evaluate((canvas) => canvas.setAttribute('data-e2e-mark', 'kept'))
    await nav.locator('a[href="/journal"]').first().click()
    await expect(page).toHaveURL(/\/journal$/)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-mode', 'quiet')
    await page.goBack()
    // The replay query is back in the URL, but it was used once for this page load.
    await expect(page).toHaveURL(
      /\/resources\?mamWelcome=1&mamVariation=airplane$/,
    )
    await expect(dockRoot(page)).toHaveAttribute('data-mam-mode', 'full')
    await page.waitForTimeout(1_800)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-travel', 'dock')
    await expect(planes(page)).toHaveCount(0)
    await expect(page.locator('[data-mam-dock] canvas')).toHaveAttribute(
      'data-e2e-mark',
      'kept',
    )
  })

  test('QUIET stays visible and still while a form field has focus', async ({
    page,
  }) => {
    await open(page, 1440)
    await page.goto('/ai-companion')
    await expect(dockRoot(page)).toHaveAttribute('data-mam-mode', 'quiet')
    // The shell's search box is a text field on every QUIET page.
    const field = page.getByPlaceholder(/Tìm kiếm/)
    await expect(field).toBeVisible()
    await expect(page.locator('[data-mam-reduced="true"]')).toHaveCount(0)
    await field.focus()
    await expect(page.locator('[data-mam-reduced="true"]')).toHaveCount(1)
    await expect(dock(page)).toBeVisible()
    await expect(dockRoot(page)).toHaveAttribute('data-mam-shot', '')
    await field.blur()
    await expect(page.locator('[data-mam-reduced="true"]')).toHaveCount(0)
  })
  // The brief's bottom-left conflicts, on pages that hold their own data: the appointments booking panel
  // and detail, the achievements gallery and a resource detail. Fixtures follow appointment-changes.spec.ts
  // and achievements.spec.ts.
  for (const width of [375, 1440]) {
    test(`appointments, appointment detail, achievements and resource detail with data leave every control clear at ${width}`, async ({
      page,
    }) => {
      test.setTimeout(120_000)
      const height = width === 375 ? 812 : 900
      await page.setViewportSize({ width, height })
      const cookie = (value: string) =>
        page.context().addCookies([
          {
            name: 'mentalbridge_access',
            value,
            url: 'http://127.0.0.1:3100',
            httpOnly: true,
            sameSite: 'Lax',
          },
        ])
      const clear = async (route: string) => {
        await expect(page.locator('[data-mam-dock]'), route).toHaveCount(1)
        await expect(dock(page), route).toBeVisible()
        await expectPageActionsClickable(page)
        await expectNothingCoveredAtBottom(page)
      }

      // Appointments (the booking panel) and one appointment's detail.
      await cookie('synthetic-care-e2e-access')
      const json = (body: unknown) => ({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
      await page.route('**/api/consultation/bookable-slots*', (route) =>
        route.fulfill(json(bookableSlots)),
      )
      await page.route('**/api/consultation/appointments', (route) =>
        route.fulfill(
          json({
            items: [appointment],
            count: 1,
            generatedAt: '2099-01-01T01:00:01Z',
          }),
        ),
      )
      await page.goto('/appointments')
      await expect(
        page.getByRole('button', {
          name: /Xem chi tiết lịch hẹn với Chuyên gia Nguyễn An/,
        }),
      ).toBeVisible()
      await expect(dockRoot(page)).toHaveAttribute('data-mam-mode', 'quiet')
      await clear('/appointments')
      await page.goto(`/appointments/${appointment.id}`)
      await expect(page.getByText('Chuyên gia Nguyễn An').first()).toBeVisible()
      await expect(dockRoot(page)).toHaveAttribute('data-mam-mode', 'quiet')
      await clear('/appointments/[id]')

      // The achievements gallery with earned and unearned items (FULL).
      await cookie('synthetic-resource-e2e-access')
      await page.route('**/api/achievements?*', (route) =>
        route.fulfill({
          ...json(achievements),
          headers: { ETag: '"0"' },
        }),
      )
      await page.goto('/achievements')
      await expect(
        page.getByRole('heading', { name: 'Bộ sưu tập hành trình' }),
      ).toBeVisible()
      await expect(dockRoot(page)).toHaveAttribute('data-mam-mode', 'full')
      await clear('/achievements')
    })

    test(`a resource detail with its content leaves every control clear at ${width}`, async ({
      page,
    }) => {
      await installHomeMocks(page, homeWorld('do-today'))
      await page.setViewportSize({ width, height: width === 375 ? 812 : 900 })
      await page.goto(`/resources/${resourceId}`)
      await expect(
        page.getByRole('heading', { level: 1, name: 'Viết vài dòng dịu dàng' }),
      ).toBeVisible()
      await expect(dockRoot(page)).toHaveAttribute('data-mam-mode', 'quiet')
      await expect(dock(page)).toBeVisible()
      await expectPageActionsClickable(page)
      await expectNothingCoveredAtBottom(page)
    })
  }

  for (const width of [1600, 1440, 1366])
    test(`journal editor: Mầm sits in the gap left of the panel, above the backdrop, at ${width}; away at 900 px or less`, async ({
      page,
    }) => {
      await page.context().addCookies([
        {
          name: 'mentalbridge_access',
          value: 'synthetic-resource-e2e-access',
          url: 'http://127.0.0.1:3100',
          httpOnly: true,
          sameSite: 'Lax',
        },
      ])
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/journal')
      await expect(dockRoot(page)).toHaveAttribute('data-mam-mode', 'quiet')
      const openEditor = () =>
        page
          .getByRole('button', { name: 'Viết nhật ký mới', exact: true })
          .click()
      // Closing the clean editor takes her out of the top layer.
      await openEditor()
      await expect(dockRoot(page)).toHaveAttribute('data-mam-above', 'true')
      await page.keyboard.press('Escape')
      await expect(dockRoot(page)).toHaveAttribute('data-mam-above', 'false')
      expect(
        await dockRoot(page).evaluate((root) => root.matches(':popover-open')),
      ).toBe(false)
      await expect(dockRoot(page)).toHaveAttribute('data-mam-dock', 'shown')
      await openEditor()
      await page.getByLabel('Nội dung').pressSequentially('Hôm nay mình thấy')
      await expect(dockRoot(page)).toHaveAttribute('data-mam-dock', 'shown')
      await expect(dockRoot(page)).toHaveAttribute('data-mam-above', 'true')
      // In the top layer, so above the dialog backdrop, and not still because a field has focus.
      expect(
        await dockRoot(page).evaluate((root) => root.matches(':popover-open')),
      ).toBe(true)
      await expect(page.locator('[data-mam-reduced="true"]')).toHaveCount(0)
      // Left of the panel, never over it, and on screen.
      await expect(async () => {
        const mam = await box(dockRoot(page))
        const panel = await box(page.locator('[data-mam-panel]'))
        expect(mam.x).toBeGreaterThanOrEqual(0)
        expect(mam.x + mam.width).toBeLessThanOrEqual(panel.x - 8)
        // Her bottom edge is on the panel's, or on her dock edge when that is lower.
        expect(mam.y + mam.height).toBeLessThanOrEqual(
          panel.y + panel.height + 2,
        )
      }).toPass()
      // No sideways slide once the panel entrance has ended.
      const first = await box(dockRoot(page))
      await page.waitForTimeout(500)
      const second = await box(dockRoot(page))
      expect(Math.abs(second.x - first.x)).toBeLessThanOrEqual(1)

      await page.setViewportSize({ width: 800, height: 900 })
      await expect(dockRoot(page)).toHaveAttribute('data-mam-dock', 'away')
      await page.setViewportSize({ width, height: 900 })
      await expect(dockRoot(page)).toHaveAttribute('data-mam-dock', 'shown')
      await expect(dockRoot(page)).toHaveAttribute('data-mam-above', 'true')
    })
})
