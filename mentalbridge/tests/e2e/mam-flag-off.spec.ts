import { expect, type Page } from '@playwright/test'

import { test } from './test-fixtures'
import {
  homeGuideId,
  homeResourceDetails,
  homeWorld,
  installHomeMocks,
} from './home-next-step-mocks'
import { crisis } from './mam-dock-helpers'
import {
  installPlanResourcesMocks,
  resourceWorld,
} from './plan-resources-mocks'
import { installSupportPlanMocks } from './support-plan-mam-mocks'

// MB-775: with MAM_WEB_ENABLED=false (the production default) no layout renders
// the dock slot, so the dock never mounts and Rive is never requested. Run with
// `MAM_WEB_ENABLED=false` so the managed E2E servers start with the flag off
// (playwright.config.ts, scripts/run-e2e.mjs); every other Mầm spec needs `true`.

const flagOff = process.env.MAM_WEB_ENABLED === 'false'
const routes = [
  '/dashboard',
  '/achievements',
  '/support-guides',
  `/support-guides/${homeGuideId}`,
  '/journal',
  '/resources',
  `/resources/${homeResourceDetails()[0].id}`,
  '/support-plan',
]

function watchMamRequests(page: Page) {
  const urls: string[] = []
  page.on('request', (request) => {
    const { pathname } = new URL(request.url())
    if (pathname.startsWith('/mam/')) urls.push(request.url())
  })
  return urls
}

test.describe('MB-775 Mầm flag off', () => {
  test.use({ timezoneId: 'Asia/Ho_Chi_Minh' })
  test.skip(
    !flagOff,
    'Needs the E2E servers started with MAM_WEB_ENABLED=false.',
  )

  for (const route of routes) {
    test(`renders no Mầm and requests no /mam asset on ${route.replace(homeGuideId, ':guideId').replace(homeResourceDetails()[0].id, ':resourceId')}`, async ({
      page,
    }) => {
      const mamRequests = watchMamRequests(page)
      if (route === '/resources')
        await installPlanResourcesMocks(page, resourceWorld(1))
      else if (route === '/support-plan') await installSupportPlanMocks(page)
      else await installHomeMocks(page, homeWorld('do-today'))
      await page.setViewportSize({ width: 1440, height: 900 })
      await page.goto(route)
      await expect(page.locator('.ref-content')).toBeVisible()
      await expect(crisis(page)).toBeVisible()
      // Wait past the lazy Rive import and the cadence read, which would have
      // fired by now if the dock were mounted.
      await page.waitForTimeout(1500)
      await expect(page.locator('[data-mam-dock]')).toHaveCount(0)
      await expect(page.locator('canvas')).toHaveCount(0)
      await expect(page.getByRole('button', { name: /Mầm/ })).toHaveCount(0)
      expect(mamRequests).toEqual([])
    })
  }

  test('keeps the per-card SupportPlan explanation, drops the aside and keeps the original CTA', async ({
    page,
  }) => {
    const requests = await installSupportPlanMocks(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/support-plan')
    await expect(
      page.getByRole('link', { name: 'Ghi lại cảm xúc' }),
    ).toBeVisible()
    // The legacy companion aside is gone: the main column takes the full width.
    await expect(
      page.getByRole('complementary', {
        name: 'Bạn đồng hành trong kế hoạch hỗ trợ',
      }),
    ).toHaveCount(0)
    await expect(page.locator('.mbw-aside')).toHaveCount(0)
    await page
      .getByRole('button', {
        name: 'Nhờ bạn đồng hành giải thích: Check-in cảm xúc',
      })
      .click()
    await expect(
      page
        .getByRole('tabpanel', { name: 'Hôm nay' })
        .getByText('Hoạt động này thuộc kế hoạch hiện tại.'),
    ).toBeVisible()
    expect(requests.companionSurfaces()).toEqual(['TODAY'])
    await expect(page.locator('[data-mam-dock]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^Mầm/ })).toHaveCount(0)
  })

  test('keeps page actions and leaves stored Mầm preferences untouched', async ({
    page,
  }) => {
    await installHomeMocks(page, homeWorld('do-today'))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/dashboard')
    await expect(
      page.getByRole('button', { name: 'Lưu ghi nhận', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /^Mầm giải thích: Cảm xúc hôm nay/ }),
    ).toHaveCount(0)
    await expect(
      page
        .getByRole('region', { name: 'Bước tiếp theo', exact: true })
        .getByRole('link', { name: 'Bắt đầu ngay', exact: true }),
    ).toBeVisible()

    // Rollback leaves a user's choices as they were: nothing reads or clears them.
    await page.evaluate(() => {
      localStorage.setItem('mentalbridge_mam_hidden', 'true')
      localStorage.setItem('mentalbridge_mam_motion', 'reduced')
      sessionStorage.setItem('mentalbridge_mam_session_muted', 'true')
    })
    await page.reload()
    await expect(page.locator('[data-mam-dock]')).toHaveCount(0)
    expect(
      await page.evaluate(() => [
        localStorage.getItem('mentalbridge_mam_hidden'),
        localStorage.getItem('mentalbridge_mam_motion'),
        sessionStorage.getItem('mentalbridge_mam_session_muted'),
      ]),
    ).toEqual(['true', 'reduced', 'true'])
  })
})
