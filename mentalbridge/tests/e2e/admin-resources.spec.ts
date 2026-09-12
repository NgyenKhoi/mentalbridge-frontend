import { expect, test, type Page } from '@playwright/test'

const fixtureUrl = 'http://127.0.0.1:3201'

async function login(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/(admin|dashboard)/)
}

async function publicTitles(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const response = await fetch('/api/resources', {
      headers: { 'Accept-Language': 'en-US' },
    })
    if (!response.ok)
      throw new Error(`Public resource request failed: ${response.status}`)
    const body = (await response.json()) as { items: Array<{ title: string }> }
    return body.items.map(({ title }) => title)
  })
}

test.describe('ADMIN to USER resource boundary', () => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    'The controlled Content fixture is available only with the managed local server.',
  )
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ request }) => {
    const response = await request.post(`${fixtureUrl}/__test/reset`)
    expect(response.status()).toBe(204)
  })

  test('creates and edits a draft, keeps publish locked, then archives public content', async ({
    browser,
    page,
  }) => {
    await login(page, 'admin-resource-e2e@example.com')
    await page.goto('/admin/content')

    await expect(
      page.getByRole('heading', { name: 'Tài nguyên tự chăm sóc' }),
    ).toBeVisible()
    await expect(
      page.getByText('Draft Resource', { exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: /Draft Resource/ }).click()
    await expect(
      page.getByRole('button', { name: 'Xuất bản — đang khóa' }),
    ).toBeDisabled()

    await page.getByRole('button', { name: '+ Thêm tài nguyên' }).click()
    const dialog = page.getByRole('dialog', { name: 'Tạo tài nguyên mới' })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel(/Danh mục/).selectOption('ARTICLE')
    await dialog.getByLabel(/Tiêu đề/).fill('Private Journey Draft')
    await dialog.getByLabel(/Mô tả ngắn/).fill('Draft boundary evidence')
    await dialog.getByLabel('Nội dung chi tiết').fill('Private draft body')
    await dialog.getByRole('button', { name: 'Tạo bản nháp' }).click()

    await expect(
      page.getByText('Đã tạo tài nguyên mới thành công'),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Private Journey Draft' }),
    ).toBeVisible()
    await page.getByLabel('Tiêu đề').fill('Private Journey Draft Edited')
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
    await expect(
      page.getByText('Đã cập nhật tài nguyên thành công'),
    ).toBeVisible()

    const userContext = await browser.newContext()
    const userPage = await userContext.newPage()
    await login(userPage, 'resource-e2e@example.com')
    await expect
      .poll(() => publicTitles(userPage))
      .toEqual(['Published Resource'])

    await page.getByRole('button', { name: /Published Resource/ }).click()
    await expect(
      page.getByRole('button', { name: 'Lưu trữ', exact: true }),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Lưu trữ', exact: true }).click()
    await expect(
      page.getByText('Đã lưu trữ tài nguyên thành công'),
    ).toBeVisible()

    await userPage.reload()
    await expect.poll(() => publicTitles(userPage)).toEqual([])
    await userContext.close()
  })

  test('keeps the administration workflow usable on a mobile viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page, 'admin-resource-e2e@example.com')
    await page.goto('/admin/content')

    await expect(
      page.getByRole('heading', { name: 'Tài nguyên tự chăm sóc' }),
    ).toBeVisible()
    await page.getByRole('button', { name: /Draft Resource/ }).click()
    await expect(
      page.getByRole('button', { name: 'Xuất bản — đang khóa' }),
    ).toBeDisabled()
    await expect(page.getByLabel('Tiêu đề')).toBeVisible()
  })
})
