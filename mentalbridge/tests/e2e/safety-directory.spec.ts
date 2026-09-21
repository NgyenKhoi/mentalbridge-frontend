import { expect, test } from '@playwright/test'

const resultsResponse = {
  trigger: 'HELP_NOW',
  state: 'RESULTS',
  areaWording: 'Cơ sở trong khu vực đã chọn',
  safetyGuidance:
    'Nếu bạn cảm thấy mình không an toàn hoặc có nguy cơ gây hại cho bản thân, hãy chủ động liên hệ dịch vụ khẩn cấp hoặc cơ sở y tế phù hợp tại khu vực của bạn.',
  limitation:
    'MentalBridge không cung cấp dịch vụ ứng cứu khẩn cấp, không giám sát con người 24/7 và không tự động liên hệ bên thứ ba.',
  entries: [
    {
      directoryEntryId: '123e4567-e89b-42d3-a456-426614174000',
      name: 'Cơ sở hỗ trợ tổng hợp',
      type: 'FACILITY',
      phone: '0240000000',
      address: 'Khu vực tổng hợp',
      coverage: [
        {
          level: 'PROVINCE',
          provinceCode: '01',
          provinceName: 'Hà Nội',
          districtCode: null,
          districtName: null,
        },
      ],
      sourceName: 'Synthetic review source',
      sourceReference: 'synthetic://review-001',
      reviewedAt: '2026-09-01T00:00:00Z',
      verifiedAt: '2026-09-01T00:00:00Z',
    },
  ],
}

test.describe('reviewed safety directory consumer flow', () => {
  test('uses explicit manual selection and renders facility actions without geolocation', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          getCurrentPosition: () => {
            throw new Error('background geolocation must not be used')
          },
          watchPosition: () => {
            throw new Error('background geolocation must not be used')
          },
        },
      })
    })

    let requestBody: Record<string, unknown> | undefined
    await page.route('**/api/care/safety-directory', async (route) => {
      requestBody = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(resultsResponse),
      })
    })

    await page.goto('/safety-directory')
    await page.getByLabel('Tỉnh/thành phố').selectOption('01')
    await page.getByRole('button', { name: 'Tra cứu khu vực' }).click()

    await expect(
      page.getByRole('heading', {
        name: resultsResponse.areaWording,
        level: 2,
      }),
    ).toBeVisible()
    await expect(page.getByText('Cơ sở hỗ trợ tổng hợp')).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Gọi số này' }),
    ).toHaveAttribute('href', 'tel:0240000000')
    await expect(
      page.getByRole('button', { name: 'Sao chép số' }),
    ).toBeVisible()
    expect(requestBody).toEqual({ trigger: 'HELP_NOW', provinceCode: '01' })
    expect(await page.getByText(/gần nhất|nearest/i).count()).toBe(0)
  })

  test('renders an invalid-area response without inventing a facility', async ({
    page,
  }) => {
    await page.route('**/api/care/safety-directory', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...resultsResponse,
          state: 'INVALID_AREA',
          entries: [],
        }),
      })
    })

    await page.goto('/safety-directory')
    await page
      .getByLabel('Nhập tên khu vực')
      .fill('Khu vực tổng hợp không khớp')
    await page.getByRole('button', { name: 'Tra cứu khu vực' }).click()

    await expect(
      page.getByRole('heading', { name: 'Chưa xác định được khu vực' }),
    ).toBeVisible()
    await expect(page.getByText('Cơ sở hỗ trợ tổng hợp')).not.toBeVisible()
  })

  test('surfaces a dependency outage as unavailable instead of a success-shaped result', async ({
    page,
  }) => {
    await page.route('**/api/care/safety-directory', async (route) => {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'CARE_DEPENDENCY_FAILED' }),
      })
    })

    await page.goto('/safety-directory')
    await page.getByLabel('Nhập tên khu vực').fill('Hà Nội')
    await page.getByRole('button', { name: 'Tra cứu khu vực' }).click()

    await expect(
      page.getByRole('heading', { name: 'Tra cứu tạm thời chưa khả dụng' }),
    ).toBeVisible()
    await expect(page.getByText(/Không thể kết nối Care lúc này/)).toBeVisible()
  })

  test('preserves the positive item-9 trigger from the assessment entry link', async ({
    page,
  }) => {
    let requestBody: Record<string, unknown> | undefined
    await page.route('**/api/care/safety-directory', async (route) => {
      requestBody = route.request().postDataJSON()
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...resultsResponse,
          trigger: 'POSITIVE_ITEM_9',
          state: 'EMPTY',
          entries: [],
        }),
      })
    })

    await page.goto('/safety-directory?trigger=positive-item-9')
    await expect(page.getByText(/Mục an toàn PHQ-9 đã mở/)).toBeVisible()
    await page.getByLabel('Tỉnh/thành phố').selectOption('01')
    await page.getByRole('button', { name: 'Tra cứu khu vực' }).click()

    expect(requestBody).toEqual({
      trigger: 'POSITIVE_ITEM_9',
      provinceCode: '01',
    })
  })
})
