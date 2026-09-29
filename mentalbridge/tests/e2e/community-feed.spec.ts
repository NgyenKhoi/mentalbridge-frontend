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

test.describe('Community feed journey', () => {
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'The deterministic Community fixture journey does not run against live data.',
  )

  test('browses paged posts, filters by an explicit topic and opens full detail', async ({
    page,
    request,
  }) => {
    const reset = await request.post(`${identityFixtureUrl}/__test/reset`)
    expect(reset.status()).toBe(204)
    await login(page)

    await page.goto('/community')
    await expect(
      page.getByRole('heading', { name: 'Cộng đồng MentalBridge' }),
    ).toBeVisible()
    await expect(page.getByText(/không dùng nhật ký, cảm xúc/)).toBeVisible()
    await expect(page.getByText('Minh An')).toBeVisible()
    await expect(page.getByText(/Một số nội dung đa phương tiện/)).toBeVisible()

    await page.getByRole('button', { name: 'Xem thêm câu chuyện' }).click()
    await expect(page.getByText('Thành viên đã rời cộng đồng')).toBeVisible()

    await page.getByRole('button', { name: 'Bước tiến nhỏ' }).click()
    await expect(page.getByText('Minh An')).toBeVisible()
    await expect(page.getByText('Thành viên đã rời cộng đồng')).toHaveCount(0)

    await page.getByRole('link', { name: /Đọc bài viết/ }).click()
    await expect(page).toHaveURL(
      /\/community\/50000000-0000-4000-8000-000000000002$/,
    )
    await expect(page.getByText(/dành mười phút để đi bộ/)).toBeVisible()
    await expect(
      page.getByText(/không thay thế tư vấn chuyên môn/),
    ).toBeVisible()
  })
})
