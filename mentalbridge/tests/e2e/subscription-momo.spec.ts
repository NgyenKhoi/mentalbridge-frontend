import { expect } from '@playwright/test'
import { test } from './test-fixtures'

const viewports = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-375', width: 375, height: 812 },
] as const

for (const viewport of viewports) {
  test(`MB-515 exposes only valid MoMo upgrades at ${viewport.name}`, async ({
    context,
    page,
  }, testInfo) => {
    await context.addCookies([
      {
        name: 'mentalbridge_access',
        value: 'synthetic-care-e2e-other-access',
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])
    await page.setViewportSize(viewport)

    const catalogue = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/consultation/service-plans') &&
        response.request().method() === 'GET',
    )
    const credits = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/consultation/service-credits') &&
        response.request().method() === 'GET',
    )
    await page.goto('/subscription')
    expect((await catalogue).status()).toBe(200)
    expect((await credits).status()).toBe(200)

    await expect(
      page.getByRole('heading', { name: 'Chọn mức đồng hành phù hợp' }),
    ).toBeVisible()
    const plus = page.getByRole('heading', { name: 'Plus' }).locator('..')
    const premium = page.getByRole('heading', { name: 'Premium' }).locator('..')
    await expect(plus).toContainText(/1\.390\.000/)
    await expect(premium).toContainText(/3\.490\.000/)
    await expect(
      plus.getByRole('button', { name: 'Gói hiện tại' }),
    ).toBeDisabled()
    await expect(
      premium.getByRole('button', { name: 'Nâng cấp qua MoMo' }),
    ).toBeEnabled()
    await expect(
      page.getByRole('button', {
        name: /PayOS|thẻ|ngân hàng|hạ gói|hoàn tiền/i,
      }),
    ).toHaveCount(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false)

    await page.screenshot({
      path: testInfo.outputPath(`subscription-${viewport.name}.png`),
      fullPage: true,
    })
  })
}
