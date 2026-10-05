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

    await page.locator('.community-composer-collapsed button').click()
    await page
      .locator('#community-post-content')
      .fill('A governed Community closure story with two safe image previews.')
    await page.locator('.community-topic-choices label').last().click()
    await page
      .locator('#community-resource-select')
      .selectOption(publishedResourceId)
    await page
      .locator('.community-sensitive-choice input[type="checkbox"]')
      .check()
    await page.locator('.community-identity-choices label').last().click()
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
    await page.locator('.community-form-actions button').last().click()

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
    await expect(page.locator('.community-media-trigger')).toHaveCount(2)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)

    await page.setViewportSize({ width: 1280, height: 800 })
    await page.locator('.community-media-trigger').first().click()
    await expect(page.locator('#community-media-viewer-title')).toContainText(
      '1/2',
    )
    await page.locator('.community-media-viewer nav button').last().click()
    await expect(page.locator('#community-media-viewer-title')).toContainText(
      '2/2',
    )
    await page.keyboard.press('ArrowLeft')
    await expect(page.locator('#community-media-viewer-title')).toContainText(
      '1/2',
    )
    await page.locator('.community-media-viewer header button').click()
  })

  test('reports, blocks, hides and fails closed after an audited admin decision', async ({
    page,
    request,
  }) => {
    const reset = await request.post(`${identityFixtureUrl}/__test/reset`)
    expect(reset.status()).toBe(204)
    await login(page)
    await page.goto(`/community/${firstPostId}`)

    const safetyButtons = page.locator(
      '.community-safety-actions > div > button',
    )
    await safetyButtons.nth(2).click()
    await expect(safetyButtons.nth(2)).toContainText('B\u1ecf ch\u1eb7n')
    await safetyButtons.nth(2).click()
    await expect(safetyButtons.nth(2)).toContainText('Ch\u1eb7n')

    await safetyButtons.nth(1).click()
    await page
      .locator('.community-report-form select')
      .selectOption('SELF_HARM_OR_CRISIS_CONCERN')
    await page
      .locator('.community-report-form textarea')
      .fill('Please review this synthetic closure case.')
    await page.locator('.community-report-form button').click()
    await expect(page.locator('.community-report-form')).toHaveCount(0)

    await page.goto(`/community/${secondPostId}`)
    await page
      .locator('.community-safety-actions > div > button')
      .first()
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
