import { expect, type Page } from '@playwright/test'

import { test } from './test-fixtures'

const identityFixtureUrl = 'http://127.0.0.1:3201'

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('user@example.com')
  await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

test('dashboard shell keeps long pages vertically scrollable', async ({
  page,
  request,
}) => {
  const reset = await request.post(`${identityFixtureUrl}/__test/reset`)
  expect(reset.status()).toBe(204)

  await page.setViewportSize({ width: 1280, height: 560 })
  await login(page)

  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollHeight > window.innerHeight,
      ),
    )
    .toBe(true)

  await page.mouse.move(900, 420)
  await page.mouse.wheel(0, 900)

  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0)
})

test('dashboard remains scrollable after closing crisis support', async ({
  page,
  request,
}) => {
  const reset = await request.post(`${identityFixtureUrl}/__test/reset`)
  expect(reset.status()).toBe(204)

  await page.setViewportSize({ width: 1280, height: 560 })
  await login(page)

  const crisisTrigger = page.locator('[aria-controls="crisis-support-panel"]')
  await crisisTrigger.click()
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden')
  await page.locator('#crisis-support-panel button').first().click()
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden')

  await page.mouse.move(900, 420)
  await page.mouse.wheel(0, 900)
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0)
})

test('dashboard remains scrollable after visiting a smooth-scroll route', async ({
  page,
  request,
}) => {
  const reset = await request.post(`${identityFixtureUrl}/__test/reset`)
  expect(reset.status()).toBe(204)

  await page.setViewportSize({ width: 1280, height: 560 })
  await login(page)
  await page.goto('/')
  await expect(page.locator('html')).toHaveClass(/lenis/)

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/dashboard$/)
  await expect(page.locator('html')).not.toHaveClass(/lenis/)

  await page.mouse.move(900, 420)
  await page.mouse.wheel(0, 900)
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(0)
})
