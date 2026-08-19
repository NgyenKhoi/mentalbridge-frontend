import { expect, test } from '@playwright/test'

test('public landing page navigates to the login form', async ({ page }) => {
  await page.goto('/')

  await expect(page.locator('main#top')).toBeVisible()

  const loginLink = page.locator('a[href="/login"]:visible').first()
  await expect(loginLink).toBeVisible()
  await loginLink.click()

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.locator('form input[type="email"]')).toBeVisible()
  await expect(page.locator('form input[type="password"]')).toBeVisible()
})
