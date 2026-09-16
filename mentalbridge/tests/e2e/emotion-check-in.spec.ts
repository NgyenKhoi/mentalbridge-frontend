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

test.describe('Daily emotion check-in through the same-origin BFF', () => {
  test.describe.configure({ mode: 'serial' })

  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL) &&
      process.env.MANAGED_E2E_SERVERS !== '1',
    'Controlled session fixture is available only with the managed local server.',
  )

  test('keeps a draft through failure, persists an update, reloads, and deletes', async ({
    context,
    page,
    request,
  }) => {
    await resetProvider(request)
    await authenticated(context)

    await page.goto('/dashboard')
    const checkIn = page.locator('.emotion-check-in')
    await expect(checkIn).toContainText('Hôm nay bạn chưa ghi nhận cảm xúc.')
    await expect(checkIn).toContainText('không phải chẩn đoán')

    await expect(
      (
        await request.post(
          `${providerFixtureUrl}/__test/emotion/failure?mode=NEXT_POST`,
        )
      ).status(),
    ).toBe(204)

    await checkIn
      .getByRole('radio', { name: 'Tốt', exact: true })
      .check({ force: true })
    await checkIn
      .getByRole('radio', { name: '4', exact: true })
      .check({ force: true })
    await checkIn
      .getByLabel('Ghi chú riêng tư (không bắt buộc)')
      .fill('Một ghi chú tổng hợp không nhạy cảm cho kiểm thử')
    await checkIn.getByRole('button', { name: 'Lưu ghi nhận' }).click()
    await expect(checkIn.getByRole('alert')).toContainText(
      'Dịch vụ ghi nhận cảm xúc tạm thời không khả dụng.',
    )
    await expect(
      checkIn.getByLabel('Ghi chú riêng tư (không bắt buộc)'),
    ).toHaveValue('Một ghi chú tổng hợp không nhạy cảm cho kiểm thử')

    await checkIn.getByRole('button', { name: 'Lưu ghi nhận' }).click()
    await expect(checkIn).toContainText('Đã lưu ghi nhận hôm nay.')
    await expect(page.locator('.emotion-history')).toContainText('Tốt')
    await expect(page.locator('.emotion-history')).toContainText(
      'không phải tiến triển hay hồi phục',
    )

    await page.reload()
    await expect(checkIn).toContainText('Đã tải ghi nhận tự báo cáo hôm nay.')
    await expect(
      checkIn.getByLabel('Ghi chú riêng tư (không bắt buộc)'),
    ).toHaveValue('Một ghi chú tổng hợp không nhạy cảm cho kiểm thử')

    await checkIn
      .getByRole('radio', { name: 'Rất tốt', exact: true })
      .check({ force: true })
    await checkIn.getByRole('button', { name: 'Cập nhật' }).click()
    await expect(checkIn).toContainText('Đã cập nhật ghi nhận hôm nay.')
    await expect(page.locator('.emotion-history')).toContainText('Rất tốt')

    await checkIn.getByRole('button', { name: 'Xóa', exact: true }).click()
    await expect(checkIn.getByRole('alert')).toContainText(
      'loại bỏ nội dung cảm xúc đã mã hóa',
    )
    await checkIn.getByRole('button', { name: 'Xác nhận xóa' }).click()
    await expect(checkIn).toContainText('Đã xóa ghi nhận')
    await expect(page.locator('.emotion-history')).toContainText(
      'Chưa có lịch sử',
    )
  })

  test('remains usable without horizontal overflow on a mobile viewport', async ({
    context,
    page,
    request,
  }) => {
    await resetProvider(request)
    await page.setViewportSize({ width: 375, height: 812 })
    await authenticated(context)
    await page.goto('/dashboard')

    const checkIn = page.locator('.emotion-check-in')
    await checkIn
      .getByRole('radio', { name: 'Bình thường', exact: true })
      .check({ force: true })
    await checkIn.getByRole('button', { name: 'Lưu ghi nhận' }).click()
    await expect(checkIn).toContainText('Đã lưu ghi nhận hôm nay.')
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
})
