import { expect, type Page } from '@playwright/test'

import { test } from './test-fixtures'

const identityFixtureUrl = 'http://127.0.0.1:3201'
const firstPostId = '50000000-0000-4000-8000-000000000002'
const secondPostId = '50000000-0000-4000-8000-000000000001'
const publishedResourceId = '30000000-0000-4000-8000-000000000001'
const pixel = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

async function login(page: Page, email = 'user@example.com') {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.locator('input[type="password"]').fill('synthetic-e2e-password')
  await page.locator('button[type="submit"]').click()
  await expect(page).toHaveURL(
    email === 'admin-resource-e2e@example.com'
      ? /\/admin\/dashboard$/
      : /\/dashboard$/,
  )
}

test.describe('MB-618 Community closure journey', () => {
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'This production-frontend journey uses deterministic service and media-provider fixtures.',
  )

  test('publishes anonymous sensitive media and keeps its viewer usable with reduced motion', async ({
    page,
    request,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 375, height: 812 })
    await page.route('https://api.cloudinary.com/**', async (route) => {
      await route.fulfill({ status: 200, body: '{}' })
    })
    await page.route('https://res.cloudinary.com/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'image/png',
        body: pixel,
      })
    })
    const reset = await request.post(`${identityFixtureUrl}/__test/reset`)
    expect(reset.status()).toBe(204)
    await login(page)
    await page.goto('/community')

    await page.getByRole('button', { name: 'Viết bài' }).click()
    await page
      .locator('#community-post-content')
      .fill('A governed Community closure story with two safe image previews.')
    await page
      .getByRole('group', { name: 'Chọn 1–3 chủ đề' })
      .locator('label')
      .last()
      .click()
    await page
      .getByRole('dialog', { name: 'Tạo bài viết' })
      .getByRole('button', { name: /^Tài nguyên/ })
      .click()
    await page
      .getByRole('combobox', { name: /Tài nguyên MentalBridge/ })
      .click()
    await page
      .getByRole('option', { name: 'Published Resource', exact: true })
      .click()
    await page
      .getByRole('checkbox', { name: 'Thêm cảnh báo nội dung nhạy cảm' })
      .check()
    await page.getByText('Đăng ẩn danh', { exact: true }).click()
    await page.getByRole('button', { name: /^Ảnh \/ video/ }).click()
    await page.locator('input[type="file"][multiple]').setInputFiles([
      {
        name: 'calm-preview-one.png',
        mimeType: 'image/png',
        buffer: pixel,
      },
      {
        name: 'calm-preview-two.png',
        mimeType: 'image/png',
        buffer: pixel,
      },
    ])
    await expect(page.locator('.community-upload-list li')).toHaveCount(2)
    await expect(page.getByText('calm-preview-one.png')).toBeVisible()
    await expect(page.getByText('calm-preview-two.png')).toBeVisible()
    await expect(
      page
        .locator('.community-upload-list li')
        .filter({ hasText: 'S\u1eb5n s\u00e0ng' }),
    ).toHaveCount(2)
    await page.getByRole('button', { name: 'Đăng câu chuyện' }).click()

    await expect(page).toHaveURL(/\/community\/[0-9a-f-]+$/)
    await page.reload()
    await expect(page.locator('.community-sensitive-warning')).toBeVisible()
    await expect(
      page.getByText('Th\u00e0nh vi\u00ean \u1ea9n danh'),
    ).toBeVisible()
    await page.locator('.community-sensitive-actions button').click()
    await expect(
      page.locator(`a[href="/resources/${publishedResourceId}"]`),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: /^Mở nội dung đính kèm/ }),
    ).toHaveCount(2)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)

    await page.setViewportSize({ width: 1280, height: 800 })
    const firstMedia = page.getByRole('button', {
      name: 'Mở nội dung đính kèm 1 trên 2',
    })
    await firstMedia.click()
    const viewer = page.getByRole('dialog', { name: /Nội dung đính kèm/ })
    await expect(viewer).toContainText('1/2')
    await viewer.getByRole('button', { name: 'Tiếp', exact: true }).click()
    await expect(viewer).toContainText('2/2')
    await page.keyboard.press('ArrowLeft')
    await expect(viewer).toContainText('1/2')
    await viewer.getByRole('button', { name: 'Đóng trình xem' }).click()
    await expect(firstMedia).toBeFocused()
  })

  test('reports, blocks, hides and fails closed after an audited admin decision', async ({
    page,
    request,
  }) => {
    const reset = await request.post(`${identityFixtureUrl}/__test/reset`)
    expect(reset.status()).toBe(204)
    await login(page)
    await page.goto(`/community/${firstPostId}`)

    const safetyTrigger = page
      .getByRole('article')
      .getByRole('button', { name: 'T\u00f9y ch\u1ecdn an to\u00e0n' })
    await safetyTrigger.click()
    await page
      .getByRole('button', { name: 'Ch\u1eb7n th\u00e0nh vi\u00ean' })
      .click()
    await expect(safetyTrigger).toBeEnabled()
    await safetyTrigger.click()
    await page
      .getByRole('button', { name: 'B\u1ecf ch\u1eb7n th\u00e0nh vi\u00ean' })
      .click()

    await safetyTrigger.click()
    await page.getByRole('button', { name: 'B\u00e1o c\u00e1o' }).click()
    await page.getByRole('combobox', { name: 'Lý do' }).click()
    await page
      .getByRole('option', { name: 'Lo ngại tự làm hại hoặc khủng hoảng' })
      .click()
    await page
      .locator('.community-report-form textarea')
      .fill('Please review this synthetic closure case.')
    await page
      .locator('.community-report-form button')
      .filter({ hasText: 'G\u1eedi b\u00e1o c\u00e1o' })
      .click()
    await expect(page.locator('.community-report-form')).toHaveCount(0)

    await page.goto(`/community/${secondPostId}`)
    await page
      .getByRole('article')
      .getByRole('button', { name: 'T\u00f9y ch\u1ecdn an to\u00e0n' })
      .click()
    await page
      .getByRole('button', { name: '\u1ea8n n\u1ed9i dung n\u00e0y' })
      .click()
    await expect(page).toHaveURL(/\/community$/)
    await expect(
      page.locator(`a[href="/community/${secondPostId}"]`),
    ).toHaveCount(0)

    await page.context().clearCookies()
    await login(page, 'admin-resource-e2e@example.com')
    await page.goto('/admin/moderation')
    const moderation = page.locator(
      'section[aria-labelledby="community-moderation-title"]',
    )
    await expect(
      moderation.getByText('Please review this synthetic closure case.'),
    ).toBeVisible()
    await moderation.locator('article select').selectOption('HIDE')
    await moderation.locator('article input').fill('CONFIRMED_UNSAFE_CONTENT')
    await moderation.locator('article button').click()
    await expect(moderation.locator('article')).toHaveCount(0)

    await page.context().clearCookies()
    await login(page)
    await page.goto(`/community/${firstPostId}`)
    await expect(
      page.locator('.community-detail-state[role="alert"]'),
    ).toBeVisible()
    await expect(page.locator('.community-detail')).toHaveCount(0)
  })
})
