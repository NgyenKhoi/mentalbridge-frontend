import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
} from '@playwright/test'

const providerFixtureUrl = 'http://127.0.0.1:3201'

async function resetProvider(request: APIRequestContext) {
  await expect(
    (await request.post(`${providerFixtureUrl}/__test/reset`)).status(),
  ).toBe(204)
}

async function authenticated(context: BrowserContext) {
  await context.addCookies([
    {
      name: 'mentalbridge_access',
      value: 'synthetic-resource-e2e-access',
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
}

test.describe('Private Journal CRUD through same-origin BFF', () => {
  test.describe.configure({ mode: 'serial' })

  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    'Controlled session fixture is available only with the managed local server.',
  )

  test('creates, refreshes, recovers from 412, revises, and tombstones on desktop', async ({
    context,
    page,
    request,
  }) => {
    await resetProvider(request)
    await authenticated(context)

    await page.goto('/journal')
    await expect(
      page.getByRole('heading', { name: 'Chưa có nhật ký' }),
    ).toBeVisible()
    await expect(
      (
        await request.post(
          `${providerFixtureUrl}/__test/journal/create-failure?mode=NEXT_POST`,
        )
      ).status(),
    ).toBe(204)
    await page.locator('.journal-live-hero button').click()
    await page.getByRole('radio', { name: 'Tốt', exact: true }).check()
    await page.getByLabel('Nội dung').fill('Nội dung được giữ sau khi tải lại')
    await page.getByLabel('Thẻ do bạn đặt').fill('riêng tư, hôm nay')
    page.once('dialog', (dialog) => dialog.dismiss())
    await page.getByRole('button', { name: 'Đóng' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: 'Lưu nhật ký' }).click()
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
      'Nội dung vẫn được giữ',
    )
    await expect(page.getByLabel('Nội dung')).toHaveValue(
      'Nội dung được giữ sau khi tải lại',
    )
    await expect(
      page.getByRole('radio', { name: 'Tốt', exact: true }),
    ).toBeChecked()
    await page.getByRole('button', { name: 'Lưu nhật ký' }).click()
    await expect(
      page.getByText('Nội dung được giữ sau khi tải lại'),
    ).toBeVisible()

    await page.reload()
    await expect(
      page.getByText('Nội dung được giữ sau khi tải lại'),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Xem chi tiết' }).click()
    await expect(page.getByRole('dialog')).toContainText('Bạn đã chọn: Tốt')
    await page.getByRole('button', { name: 'Chỉnh sửa' }).click()
    await page.getByRole('radio', { name: 'Không tốt', exact: true }).check()
    await page.getByLabel('Nội dung').fill('Bản chỉnh sửa không bị mất')
    await expect(
      (
        await request.post(
          `${providerFixtureUrl}/__test/journal/conflict?mode=NEXT_PATCH`,
        )
      ).status(),
    ).toBe(204)
    await page.getByRole('button', { name: 'Lưu nhật ký' }).click()
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
      'Đã tải phiên bản mới nhất',
    )
    await expect(page.getByLabel('Nội dung')).toHaveValue(
      'Bản chỉnh sửa không bị mất',
    )
    await expect(
      page.getByRole('radio', { name: 'Không tốt', exact: true }),
    ).toBeChecked()

    await page.getByRole('button', { name: 'Lưu nhật ký' }).click()
    await expect(page.getByText('Phiên bản 3')).toBeVisible()
    await page.screenshot({
      path: 'docs/evidence/story-6201-journal-desktop.png',
      fullPage: true,
    })
    await page.getByRole('button', { name: 'Xóa' }).click()
    await expect(
      page.getByText(/không có nghĩa dữ liệu vật lý được xóa ngay/i),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Xóa nhật ký' }).click()
    await expect(
      page.getByRole('heading', { name: 'Chưa có nhật ký' }),
    ).toBeVisible()
  })

  test('keeps the Journal action and detail usable on mobile', async ({
    context,
    page,
    request,
  }) => {
    await resetProvider(request)
    await page.setViewportSize({ width: 375, height: 812 })
    await authenticated(context)
    await page.goto('/journal')
    await page.locator('.journal-live-hero button').click()
    await page.getByRole('radio', { name: 'Bình thường' }).check()
    await page.getByLabel('Nội dung').fill('Nhật ký trên thiết bị di động')
    await page.getByLabel('Thẻ do bạn đặt').fill('riêng tư')
    await page.getByRole('button', { name: 'Lưu nhật ký' }).click()
    const detail = page.getByRole('button', { name: 'Xem chi tiết' })
    await expect(detail).toBeVisible()
    await detail.click()
    await expect(page.getByRole('dialog')).toContainText(
      'Nhật ký trên thiết bị di động',
    )
    await expect(page.getByRole('button', { name: 'Chỉnh sửa' })).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: 'docs/evidence/story-6201-journal-mobile.png',
      fullPage: true,
    })
    await page.setViewportSize({ width: 812, height: 375 })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
})
