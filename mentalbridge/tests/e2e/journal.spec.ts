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
    await expect(page.getByText('Phiên bản 3', { exact: true })).toBeVisible()
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

  test('consents, restores exact-revision reflection, retries failure, and rejects stale output', async ({
    context,
    page,
    request,
  }) => {
    await resetProvider(request)
    await expect(
      (await request.post('http://127.0.0.1:3202/__test/reset')).status(),
    ).toBe(204)
    await authenticated(context)

    await page.goto('/journal')
    await page.locator('.journal-live-hero button').click()
    await page.getByRole('radio', { name: 'Bình thường' }).check()
    await page
      .getByLabel('Nội dung')
      .fill('Tôi đã dành một khoảng lặng ngắn sau giờ làm việc.')
    await page.getByRole('button', { name: 'Lưu nhật ký' }).click()
    await page.getByRole('button', { name: 'Xem chi tiết' }).click()

    const dialogTitle = page.getByRole('heading', {
      name: 'Chi tiết nhật ký',
    })
    const reflectionTitle = page.getByRole('heading', {
      name: 'AI giúp bạn hiểu rõ hơn những điều mình đã viết',
    })
    await expect(dialogTitle).toBeVisible()
    await expect(reflectionTitle).toBeVisible()
    expect(
      await dialogTitle.evaluate(
        (element) => window.getComputedStyle(element).fontFamily,
      ),
    ).toContain('Lora')
    expect(
      await reflectionTitle.evaluate(
        (element) => window.getComputedStyle(element).fontFamily,
      ),
    ).toContain('Lora')
    await expect(
      page.getByText(/AI có thể tóm tắt nội dung, nhận diện cảm xúc/i),
    ).toBeVisible()
    await expect(page.getByText(/Kết quả chỉ hỗ trợ tự phản ánh/i)).toHaveCount(
      0,
    )
    const consent = page.getByLabel(/chủ động đồng ý xử lý đúng phiên bản/i)
    const consentAndAnalyze = page.getByRole('button', {
      name: 'Đồng ý và phân tích bản này',
    })
    await expect(consentAndAnalyze).toBeDisabled()
    await consent.check()
    await consentAndAnalyze.click()
    await expect(page.getByText('Yêu cầu đang chờ xử lý')).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'Phản ánh cho phiên bản 1' }),
    ).toBeVisible({ timeout: 10_000 })
    await expect(
      page.getByRole('link', { name: 'Mở hướng dẫn hỗ trợ' }),
    ).toHaveAttribute('href', '/support-guides')

    await page.reload()
    await page.getByRole('button', { name: 'Xem chi tiết' }).click()
    await expect(
      page.getByRole('heading', { name: 'Phản ánh cho phiên bản 1' }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Chỉnh sửa' }).click()
    await page
      .getByLabel('Nội dung')
      .fill('Tôi đã chỉnh sửa nội dung nên phản ánh cũ không còn phù hợp.')
    await page.getByRole('button', { name: 'Lưu nhật ký' }).click()
    await expect(page.getByText('Phản ánh trước đã cũ')).toBeVisible()

    await expect(
      (
        await request.post(
          `${providerFixtureUrl}/__test/journal/analysis-failure?mode=NEXT_JOB`,
        )
      ).status(),
    ).toBe(204)
    await page.getByRole('button', { name: 'Phân tích phiên bản này' }).click()
    await expect(page.getByText('Phản ánh chưa hoàn tất')).toBeVisible({
      timeout: 10_000,
    })
    await page.getByRole('button', { name: 'Thử phân tích lại' }).click()
    await expect(
      page.getByRole('heading', { name: 'Phản ánh cho phiên bản 2' }),
    ).toBeVisible({ timeout: 10_000 })
    await page.screenshot({
      path: 'docs/evidence/mb-368-journal-ai-reflection.png',
      fullPage: true,
    })
    await page.getByRole('dialog').screenshot({
      path: 'docs/evidence/mb-368-journal-ai-font-vietnamese.png',
    })

    await page.getByRole('button', { name: 'Rút lại đồng ý AI' }).click()
    await expect(page.getByText('Đồng ý xử lý nhật ký bằng AI')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Lưu đồng ý AI' }),
    ).toBeDisabled()
  })
})
