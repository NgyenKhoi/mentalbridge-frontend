import { expect, test } from '@playwright/test'

const id = 'a2464b2b-a7fd-46fd-9310-64ef4eac7de7'
test.describe('admin recurring report schedules', () => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL) &&
      process.env.MENTALBRIDGE_MANAGED_E2E !== 'true',
    'Requires the controlled local Identity fixture.',
  )

  test('creates, pauses, resumes, edits and deletes a schedule in the admin shell', async ({
    page,
    request,
  }, testInfo) => {
    await request.post('http://127.0.0.1:3201/__test/reset')
    let items: Record<string, unknown>[] = []
    await page.route('**/api/admin/platform-reports/catalogue', (route) =>
      route.fulfill({
        json: [
          {
            reportType: 'ACCOUNT_ACTIVITY',
            label: 'Hoạt động tài khoản',
            description: 'Tổng hợp hoạt động tài khoản.',
            scopeVersion: 'platform-account-activity-report-v1',
            maximumPeriodDays: 366,
          },
        ],
      }),
    )
    await page.route(/\/api\/admin\/platform-reports\?/, (route) =>
      route.fulfill({ json: { items: [], nextCursor: null } }),
    )
    await page.route(
      '**/api/admin/platform-report-schedules**',
      async (route) => {
        const req = route.request()
        if (req.method() === 'POST') {
          const input = req.postDataJSON()
          const value = {
            reportType: input.reportType,
            cadence: input.cadence,
            timezone: input.timezone,
            localTime: input.localTime,
            periodDays: input.periodDays,
            recipientGroup: input.recipientGroup,
            deliveryTarget: input.deliveryTarget,
            scheduleId: id,
            status: 'ACTIVE',
            nextRunAt: '2026-10-12T01:00:00Z',
            lastFailureCode: null,
            createdAt: '2026-10-09T00:00:00Z',
            updatedAt: '2026-10-09T00:00:00Z',
            version: 0,
          }
          items = [value]
          await route.fulfill({ status: 201, json: value })
        } else if (req.method() === 'PUT') {
          const input = req.postDataJSON()
          items = [
            {
              ...items[0],
              cadence: input.cadence,
              timezone: input.timezone,
              localTime: input.localTime,
              periodDays: input.periodDays,
              status: input.enabled ? 'ACTIVE' : 'PAUSED',
              version: Number(items[0].version) + 1,
            },
          ]
          await route.fulfill({ json: items[0] })
        } else if (req.method() === 'DELETE') {
          items = []
          await route.fulfill({ status: 204 })
        } else await route.fulfill({ json: items })
      },
    )
    await page.goto('/login')
    await page.getByLabel('Email').fill('admin-resource-e2e@example.com')
    await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
    await page.getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(page).toHaveURL(/\/admin/)
    await page.goto('/admin/reports')
    const region = page.getByRole('region', { name: 'Lịch báo cáo định kỳ' })
    await expect(region.getByText(/Chưa có lịch báo cáo/)).toBeVisible()
    await page.screenshot({
      path: testInfo.outputPath('schedule-empty.png'),
      fullPage: true,
    })
    await region.getByRole('button', { name: 'Tạo lịch', exact: true }).click()
    await expect(
      region.getByRole('button', { name: /Tạm dừng lịch/ }),
    ).toBeVisible()
    for (const { width, height } of [
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
      { width: 768, height: 844 },
      { width: 375, height: 844 },
      { width: 640, height: 400 },
    ]) {
      await page.setViewportSize({ width, height })
      await region.scrollIntoViewIfNeeded()
      await expect(
        region.getByRole('button', { name: /Sửa lịch/ }),
      ).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
      testInfo.annotations.push({
        type: `content-width-${width}`,
        description: String(
          await region.evaluate((element) =>
            Math.round(element.getBoundingClientRect().width),
          ),
        ),
      })
      await page.screenshot({
        path: testInfo.outputPath(`schedule-${width}.png`),
        fullPage: true,
      })
    }
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await region.getByLabel('Múi giờ').focus()
    await expect(region.getByLabel('Múi giờ')).toBeFocused()
    await region.getByRole('button', { name: /Tạm dừng lịch/ }).click()
    await expect(
      region.getByRole('button', { name: /Tiếp tục lịch/ }),
    ).toBeVisible()
    await page.screenshot({
      path: testInfo.outputPath('schedule-paused.png'),
      fullPage: true,
    })
    await region.getByRole('button', { name: /Tiếp tục lịch/ }).click()
    await region.getByRole('button', { name: /Sửa lịch/ }).click()
    await region.getByLabel('Số ngày tổng hợp').fill('30')
    await region.getByRole('button', { name: 'Lưu lịch', exact: true }).click()
    await expect(region.getByText(/30 ngày/)).toBeVisible()
    await region.getByRole('button', { name: /Xóa lịch/ }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Xóa lịch', exact: true })
      .click()
    await expect(region.getByText(/Chưa có lịch báo cáo/)).toBeVisible()
  })
})
