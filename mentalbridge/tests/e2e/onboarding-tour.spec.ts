import { expect, type Page } from '@playwright/test'

import { onboardingStorageKey } from '../../features/onboarding/tour-storage'
import { test } from './test-fixtures'

test.use({ onboardingSeen: false, reducedMotion: 'reduce' })

const key = onboardingStorageKey('10000000-0000-4000-8000-000000000001')

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email', { exact: true }).fill('user@example.com')
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await page.waitForURL('**/dashboard')
}

test('walks six steps, blocks background actions, persists completion and permits replay', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)
  const tour = page.getByRole('dialog')
  await expect(tour).toContainText('Bước 1/6')
  await page.screenshot({ path: testInfo.outputPath('tour-desktop.png') })
  await page
    .locator('.ref-community-link')
    .evaluate((element: HTMLAnchorElement) => element.click())
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.keyboard.press('Enter')
  await expect(tour).toContainText('Bước 2/6')
  await page.keyboard.press('ArrowLeft')
  await expect(tour).toContainText('Bước 1/6')
  for (let step = 2; step <= 6; step++) {
    await page.keyboard.press('ArrowRight')
    await expect(tour).toContainText(`Bước ${step}/6`)
  }
  await page.getByRole('button', { name: 'Hoàn thành', exact: true }).click()
  await expect(tour).toHaveCount(0)
  expect(
    await page.evaluate((storageKey) => localStorage.getItem(storageKey), key),
  ).toBe('completed')
  await page.reload()
  await expect(page.locator('.ref-content[data-entered]')).toBeVisible()
  await expect(tour).toHaveCount(0)
  await page
    .getByRole('button', { name: 'Mở menu tài khoản', exact: true })
    .click()
  await page.getByRole('menuitem', { name: 'Xem lại hướng dẫn' }).click()
  await expect(tour).toContainText('Bước 1/6')
  await page.keyboard.press('Escape')
  await expect(tour).toHaveCount(0)
  expect(
    await page.evaluate((storageKey) => localStorage.getItem(storageKey), key),
  ).toBe('skipped')
})

test('keeps tooltips in view on mobile and restores the closed menu after skip', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await login(page)
  const tour = page.getByRole('dialog')
  await expect(tour).toContainText('Bước 1/6')
  for (let step = 1; step <= 6; step++) {
    await expect(tour).toContainText(`Bước ${step}/6`)
    const bounds = await tour.boundingBox()
    expect(bounds).not.toBeNull()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(376)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(813)
    if (step === 2) {
      await expect(page.locator('.ref-shell')).toHaveClass(/mobile-open/)
      await page.screenshot({ path: testInfo.outputPath('tour-mobile.png') })
    }
    if (step < 6)
      await page.getByRole('button', { name: 'Tiếp tục', exact: true }).click()
  }
  await page
    .getByRole('button', { name: 'Bỏ qua hướng dẫn', exact: true })
    .click()
  await expect(tour).toHaveCount(0)
  await expect(page.locator('.ref-shell')).not.toHaveClass(/mobile-open/)
  await expect(
    page.getByRole('button', { name: 'Mở menu', exact: true }),
  ).toBeFocused()
})

test('does not automatically interrupt assessment routes for a new visitor', async ({
  page,
}) => {
  await page.addInitScript((storageKey) => {
    if (location.pathname === '/login')
      localStorage.setItem(storageKey, 'completed')
  }, key)
  await login(page)
  await page.goto('/assessments')
  await page.evaluate((storageKey) => localStorage.removeItem(storageKey), key)
  await page.reload()
  await expect(page.locator('.ref-content[data-entered]')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})
