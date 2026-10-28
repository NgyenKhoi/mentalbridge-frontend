import { writeFileSync } from 'node:fs'

import { expect, type Page } from '@playwright/test'

import { test } from './test-fixtures'
import {
  homeGuideId,
  homeWorld,
  installHomeMocks,
} from './home-next-step-mocks'
import {
  installPlanResourcesMocks,
  resourceWorld,
} from './plan-resources-mocks'
import {
  box,
  crisis,
  dock,
  expectNothingCoveredAtBottom,
  expectPageActionsClickable,
  menu,
} from './mam-dock-helpers'

// MB-775: web release gate for Mầm behind MAM_WEB_ENABLED. Needs the flag on
// (the E2E default). Proves the dock never blocks core journeys, survives asset
// loss, a slow or lost network and long sessions, and sends nothing private.
// The flag-off half is mam-flag-off.spec.ts.

const status = (page: Page) => page.locator('[data-mam-dock] [data-mam-status]')
const startToday = (page: Page) =>
  page
    .getByRole('region', { name: 'Bước tiếp theo', exact: true })
    .getByRole('link', { name: 'Bắt đầu ngay', exact: true })
const providerFixtureUrl = 'http://127.0.0.1:3201'
const RIV = '**/mam/mam-v03.riv'
const WASM = '**/mam/rive-lite-2.47.1.wasm'

// Measured 2026-10-28 (docs/evidence/mb-775-mam-web-gate.md): the measured
// value plus headroom, not a target.
// A leak of one listener per route change would add 30 over the measured cycles.
const LISTENER_GROWTH = 5
const HEAP_GROWTH = 4_000_000
const MAX_FAILURE_ERRORS = 12

// The Resources page needs its plan and catalogue; an empty catalogue keeps page
// actions out from under the dock, like mam-celebrations.spec.ts.
async function mockResources(page: Page) {
  await installPlanResourcesMocks(page, resourceWorld(1))
  await page.route(/\/api\/resources(?:\?.*)?$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], hasMore: false }),
    }),
  )
}

async function openHome(page: Page, width = 1440, route = '/dashboard') {
  if (route === '/resources') await mockResources(page)
  else await installHomeMocks(page, homeWorld('do-today'))
  await page.route('**/api/achievements?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { ETag: '"0"' },
      body: JSON.stringify({
        visibilityState: 'VISIBLE',
        preferenceVersion: '0',
        policyVersion: 'achievement-rules-v1',
        calculatedAt: new Date().toISOString(),
        sources: [],
        items: [],
      }),
    }),
  )
  await page.setViewportSize({ width, height: 900 })
}

// Stable geometry: the pointer is parked away from every measured element
// (hover transforms such as Help Now's) and each box is unchanged across two
// samples. A real loading-to-ready shift still changes a box and fails.
async function settledBoxes(page: Page) {
  await page.mouse.move(2, 2)
  const read = async () => ({
    dock: await box(dock(page)),
    crisis: await box(crisis(page)),
    start: await box(startToday(page)),
  })
  let previous = await read()
  await expect(async () => {
    await page.waitForTimeout(200)
    const current = await read()
    const same = JSON.stringify(current) === JSON.stringify(previous)
    previous = current
    expect(same).toBe(true)
  }).toPass({ timeout: 5000 })
  return previous
}

async function openJournal(page: Page, width: number) {
  await page.request.post(`${providerFixtureUrl}/__test/reset`)
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
}

test.describe('MB-775 Mầm web gate', () => {
  test.use({ timezoneId: 'Asia/Ho_Chi_Minh' })
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack' ||
      process.env.MAM_WEB_ENABLED === 'false',
    'The gate uses browser-owned fixtures and needs MAM_WEB_ENABLED=true.',
  )

  for (const width of [1440, 1280, 768, 375]) {
    for (const route of [
      '/dashboard',
      '/resources',
      '/achievements',
      `/support-guides/${homeGuideId}`,
    ]) {
      test(`${route} keeps Help Now and every page action clickable at ${width}`, async ({
        page,
      }) => {
        await openHome(page, width, route)
        await page.goto(route)
        await expect(dock(page)).toBeVisible()
        await expect(crisis(page)).toBeVisible()
        await crisis(page).click({ trial: true })
        if (route === '/dashboard')
          await startToday(page).click({ trial: true })
        await expectPageActionsClickable(page)
        await expectNothingCoveredAtBottom(page)
      })
    }

    test(`/journal keeps its action and the form submit clickable at ${width}`, async ({
      page,
    }) => {
      await openJournal(page, width)
      await page.goto('/journal')
      await expect(dock(page)).toBeVisible()
      await crisis(page).click({ trial: true })
      await expectPageActionsClickable(page)
      await page
        .getByRole('button', { name: 'Viết nhật ký mới', exact: true })
        .click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page
        .getByRole('button', { name: 'Lưu nhật ký' })
        .click({ trial: true })
    })
  }

  test('assessment forms have no Mầm to cover them', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/assessment/anonymous')
    await expect(page.locator('main, form').first()).toBeVisible()
    await expect(page.locator('[data-mam-dock]')).toHaveCount(0)
  })

  test('Tab reaches the dock, Escape returns focus, and reduced motion keeps it static', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openHome(page)
    await page.goto('/dashboard')
    await expect(dock(page)).toBeVisible()
    await expect(page.locator('[data-mam-reduced="true"]')).toHaveCount(1)
    for (
      let i = 0;
      i < 120 &&
      !(await dock(page).evaluate((e) => e === document.activeElement));
      i++
    )
      await page.keyboard.press('Tab')
    await expect(dock(page)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(menu(page)).toBeVisible()
    await page.keyboard.press('Tab')
    await expect(menu(page).locator(':focus')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(menu(page)).toHaveCount(0)
    await expect(dock(page)).toBeFocused()
  })

  for (const [name, blocked] of [
    ['the .riv file', [RIV]],
    ['the WASM runtime', [WASM]],
    ['both assets', [RIV, WASM]],
  ] as const) {
    test(`keeps the static Mầm and a usable page when ${name} fails`, async ({
      page,
    }) => {
      const errors: string[] = []
      const aborted: string[] = []
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text())
      })
      page.on('pageerror', (error) => errors.push(error.message))
      for (const pattern of blocked)
        await page.route(pattern, (route) => {
          aborted.push(route.request().url())
          return route.abort('failed')
        })
      await openHome(page)
      await page.goto('/dashboard')
      await expect(dock(page)).toBeVisible()
      await expect(status(page)).toHaveAttribute('data-mam-status', 'fallback')
      await expect(page.locator('[data-mam-dock] img')).toBeVisible()
      await startToday(page).click({ trial: true })
      await crisis(page).click({ trial: true })

      // No retry loop and no growing error stream once the failure settled.
      const settled = { errors: errors.length, aborted: aborted.length }
      await page.waitForTimeout(3000)
      expect(errors.length).toBe(settled.errors)
      expect(aborted.length).toBe(settled.aborted)
      expect(aborted.length).toBeLessThanOrEqual(blocked.length * 2)
      test.info().annotations.push({
        type: 'mam-gate-asset-failure',
        description: JSON.stringify({ blocked, ...settled, errors }),
      })
      expect(errors.length).toBeLessThanOrEqual(MAX_FAILURE_ERRORS)
    })
  }

  test('shows the static pose while a slow .riv is held, with no layout shift on ready', async ({
    page,
  }) => {
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route(RIV, async (route) => {
      await held
      await route.continue()
    })
    await openHome(page)
    await page.goto('/dashboard')
    await expect(dock(page)).toBeVisible()
    await expect(status(page)).toHaveAttribute('data-mam-status', 'loading')
    await expect(page.locator('[data-mam-dock] img')).toBeVisible()
    // The page is interactive while the character is still loading.
    await startToday(page).click({ trial: true })
    await crisis(page).click({ trial: true })
    const before = await settledBoxes(page)
    await expect(status(page)).toHaveAttribute('data-mam-status', 'loading')

    release()
    await expect(status(page)).toHaveAttribute('data-mam-status', 'ready', {
      timeout: 15_000,
    })
    expect(await settledBoxes(page)).toEqual(before)
  })

  test('keeps working when the network drops mid-session', async ({
    page,
    context,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await openHome(page)
    await page.goto('/dashboard')
    await expect(status(page)).toHaveAttribute('data-mam-status', 'ready')
    await context.setOffline(true)
    await dock(page).focus()
    await page.keyboard.press('Enter')
    await expect(menu(page)).toBeVisible()
    await page.getByRole('switch', { name: 'Mầm tự lên tiếng' }).press('Space')
    await page.keyboard.press('Escape')
    await expect(dock(page)).toBeVisible()
    await crisis(page).click({ trial: true })
    await context.setOffline(false)
    await page.waitForTimeout(500)
    expect(errors).toEqual([])
    await expect(status(page)).toHaveAttribute('data-mam-status', 'ready')
  })

  test('hide, mute and motion stay in the documented keys', async ({
    page,
  }) => {
    await openHome(page)
    await page.goto('/dashboard')
    await dock(page).focus()
    await page.keyboard.press('Enter')
    await page.getByRole('switch', { name: 'Mầm tự lên tiếng' }).press('Space')
    await page.getByRole('switch', { name: 'Chuyển động' }).press('Space')
    await page.getByRole('button', { name: 'Ẩn Mầm' }).press('Enter')
    await expect(page.getByRole('button', { name: 'Hiện Mầm' })).toBeFocused()
    const keys = await page.evaluate(() => ({
      local: Object.keys(localStorage)
        .filter((key) => key.includes('mam'))
        .map((key) => key.replace(/:.*/, ':<account>'))
        .sort(),
      session: Object.keys(sessionStorage)
        .filter((key) => key.includes('mam'))
        .sort(),
    }))
    expect(keys).toEqual({
      local: [
        'mentalbridge_mam_celebrations:<account>',
        'mentalbridge_mam_hidden',
        'mentalbridge_mam_motion',
      ],
      session: [
        'mentalbridge_mam_celebration_session',
        'mentalbridge_mam_session_muted',
      ],
    })
  })

  test('long navigation keeps one dock and no growth in listeners or heap', async ({
    page,
  }) => {
    test.setTimeout(240_000)
    await openHome(page)
    await mockResources(page)
    await page.goto('/dashboard')
    await expect(status(page)).toHaveAttribute('data-mam-status', 'ready')
    const cdp = await page.context().newCDPSession(page)
    const nav = page.getByRole('navigation', { name: 'Điều hướng chính' })
    const cycle = [
      '/journal',
      '/achievements',
      '/resources',
      '/support-plan',
      '/dashboard',
    ]
    const visit = async (path: string) => {
      await nav.locator(`a[href="${path}"]`).first().click()
      await expect(page).toHaveURL(new RegExp(`${path}$`))
      await expect(page.locator('[data-mam-dock]')).toHaveCount(
        path === '/support-plan' ? 0 : 1,
      )
    }
    // Every sample is the same settled state: /dashboard, character ready, GC done.
    const sample = async () => {
      await expect(status(page)).toHaveAttribute('data-mam-status', 'ready')
      await page.waitForTimeout(500)
      await cdp.send('HeapProfiler.collectGarbage')
      const counters = await cdp.send('Memory.getDOMCounters')
      const heap = await cdp.send('Runtime.getHeapUsage')
      return { listeners: counters.jsEventListeners, heap: heap.usedSize }
    }
    const WARM_CYCLES = 2
    const MEASURED_CYCLES = 6
    for (let round = 0; round < WARM_CYCLES; round++)
      for (const path of cycle) await visit(path)
    const warm = await sample()
    const samples = []
    for (let round = 0; round < MEASURED_CYCLES; round++) {
      for (const path of cycle) await visit(path)
      samples.push(await sample())
    }
    const after = samples.at(-1)!
    const result = {
      story: 'MB-775',
      date: new Date().toISOString(),
      routeChangesWarmUp: WARM_CYCLES * cycle.length,
      routeChangesMeasured: MEASURED_CYCLES * cycle.length,
      allowance: { listeners: LISTENER_GROWTH, heapBytes: HEAP_GROWTH },
      warm,
      samplesAfterEachCycle: samples,
      growth: {
        listeners: after.listeners - warm.listeners,
        heapBytes: after.heap - warm.heap,
      },
    }
    if (process.env.MB775_CAPTURE === 'true')
      writeFileSync(
        'docs/evidence/mb-775-mam-gate-navigation.json',
        `${JSON.stringify(result, null, 2)}\n`,
      )
    expect(result.growth.listeners).toBeLessThanOrEqual(LISTENER_GROWTH)
    expect(result.growth.heapBytes).toBeLessThanOrEqual(HEAP_GROWTH)
  })

  // Light only: the USER shell has no reachable dark theme (see the evidence doc).
  for (const [width, height, name] of [
    [1440, 900, 'desktop-1440'],
    [375, 812, 'mobile-375'],
  ] as const)
    test(`captures the dock on /dashboard, light ${name}`, async ({ page }) => {
      test.skip(
        process.env.MB775_CAPTURE !== 'true',
        'Set MB775_CAPTURE=true to regenerate the evidence captures.',
      )
      await openHome(page, width)
      await page.setViewportSize({ width, height })
      await page.goto('/dashboard')
      await expect(status(page)).toHaveAttribute('data-mam-status', 'ready')
      await page.waitForTimeout(500)
      await page.screenshot({
        path: `docs/evidence/mb-775-mam-light-${name}.png`,
      })
    })

  test('sends no journal text and nothing off-origin from a session with Mầm', async ({
    page,
  }) => {
    const requests: { url: string; method: string; body: string | null }[] = []
    page.on('request', (request) =>
      requests.push({
        url: request.url(),
        method: request.method(),
        body: request.postData(),
      }),
    )
    await openJournal(page, 1440)
    await page.goto('/journal')
    await expect(status(page)).toHaveAttribute('data-mam-status', 'ready')
    await page
      .getByRole('button', { name: 'Viết nhật ký mới', exact: true })
      .click()
    const good = page.getByRole('radio', { name: 'Tốt', exact: true })
    await page.locator('label').filter({ has: good }).click()
    await page.getByLabel('Nội dung').fill('MB775-PRIVATE-JOURNAL-TEXT')
    await page.getByRole('button', { name: 'Lưu nhật ký' }).click()
    await expect(page.getByText('MB775-PRIVATE-JOURNAL-TEXT')).toBeVisible()

    const mam = requests.filter(({ url }) =>
      new URL(url).pathname.startsWith('/mam/'),
    )
    expect(mam.length).toBeGreaterThan(0)
    for (const request of mam) {
      expect(request.method).toBe('GET')
      expect(new URL(request.url).search).toBe('')
      expect(request.body).toBeNull()
    }
    for (const request of requests)
      expect(new URL(request.url).origin).toBe('http://127.0.0.1:3100')
    const carriers = requests.filter((request) =>
      `${request.url}${request.body ?? ''}`.includes('MB775-PRIVATE'),
    )
    expect(carriers.length).toBeGreaterThan(0)
    for (const request of carriers)
      expect(new URL(request.url).pathname).toMatch(/^\/api\/journals/)
  })
})
