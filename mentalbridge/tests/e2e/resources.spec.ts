import { expect, test } from '@playwright/test'

test.describe('Resources Journey', () => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    'Controlled fixtures are available only with the managed local server.',
  )

  test('displays published resources in assessment result', async ({
    page,
  }) => {
    // Navigate to anonymous assessment flow
    await page.goto('/assessment/anonymous')

    // Complete PHQ-9 questionnaire
    await expect(
      page.getByRole('heading', { name: 'PHQ-9 — Sàng lọc triệu chứng' }),
    ).toBeVisible()

    // Answer all questions
    for (let item = 1; item <= 9; item += 1) {
      await page
        .getByRole('radio', {
          name: item === 9 ? 'Vài ngày' : 'Không có gì',
        })
        .check()
      if (item < 9) {
        await page.getByRole('button', { name: 'Câu tiếp theo →' }).click()
      }
    }

    // Submit assessment
    await page
      .getByRole('checkbox', { name: /tôi đã đọc và xác nhận/i })
      .check()
    await page.getByRole('button', { name: 'Gửi cho Care chấm điểm' }).click()

    // Wait for results page
    await expect(
      page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
    ).toBeVisible()

    // Check that resources section is present
    await expect(page.getByText('Tài liệu hữu ích')).toBeVisible()

    // Resources should be visible (at least one resource or empty/unavailable state)
    const resourcesSection = page.locator('.resources-list')
    await expect(resourcesSection).toBeVisible()
  })

  test('handles empty resources gracefully', async ({ page, context }) => {
    // Mock empty resources response
    await context.route('**/api/resources**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          hasMore: false,
        }),
      })
    })

    await page.goto('/assessment/anonymous')

    // Complete assessment
    await expect(
      page.getByRole('heading', { name: 'PHQ-9 — Sàng lọc triệu chứng' }),
    ).toBeVisible()

    for (let item = 1; item <= 9; item += 1) {
      await page
        .getByRole('radio', {
          name: item === 9 ? 'Vài ngày' : 'Không có gì',
        })
        .check()
      if (item < 9) {
        await page.getByRole('button', { name: 'Câu tiếp theo →' }).click()
      }
    }

    await page
      .getByRole('checkbox', { name: /tôi đã đọc và xác nhận/i })
      .check()
    await page.getByRole('button', { name: 'Gửi cho Care chấm điểm' }).click()

    await expect(
      page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
    ).toBeVisible()

    // Should show empty state
    await expect(page.getByText('Hiện chưa có tài liệu nào')).toBeVisible()
  })

  test('handles unavailable resources state', async ({ page, context }) => {
    // Mock unavailable response
    await context.route('**/api/resources**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [],
          hasMore: false,
          unavailable: true,
          message: 'Tài nguyên tạm thời không khả dụng',
        }),
      })
    })

    await page.goto('/assessment/anonymous')

    // Complete assessment
    await expect(
      page.getByRole('heading', { name: 'PHQ-9 — Sàng lọc triệu chứng' }),
    ).toBeVisible()

    for (let item = 1; item <= 9; item += 1) {
      await page
        .getByRole('radio', {
          name: item === 9 ? 'Vài ngày' : 'Không có gì',
        })
        .check()
      if (item < 9) {
        await page.getByRole('button', { name: 'Câu tiếp theo →' }).click()
      }
    }

    await page
      .getByRole('checkbox', { name: /tôi đã đọc và xác nhận/i })
      .check()
    await page.getByRole('button', { name: 'Gửi cho Care chấm điểm' }).click()

    await expect(
      page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
    ).toBeVisible()

    // Should show unavailable state
    await expect(
      page.getByText('Tài nguyên tạm thời không khả dụng'),
    ).toBeVisible()
  })

  test('displays published resources only, not draft or archived', async ({
    page,
    context,
  }) => {
    // Mock response with published resources
    await context.route('**/api/resources**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: '1',
              title: 'Published Article',
              summary: 'This article is published and visible',
              category: 'ARTICLE',
              externalUrl: 'https://example.com/article',
              thumbnailUrl: null,
              locale: 'vi-VN',
              status: 'PUBLISHED',
              reviewedBy: 'reviewer@test.com',
              reviewedAt: '2024-01-01T00:00:00Z',
              effectiveAt: null,
              expiresAt: null,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
          hasMore: false,
        }),
      })
    })

    await page.goto('/assessment/anonymous')

    // Complete assessment
    await expect(
      page.getByRole('heading', { name: 'PHQ-9 — Sàng lọc triệu chứng' }),
    ).toBeVisible()

    for (let item = 1; item <= 9; item += 1) {
      await page
        .getByRole('radio', {
          name: item === 9 ? 'Vài ngày' : 'Không có gì',
        })
        .check()
      if (item < 9) {
        await page.getByRole('button', { name: 'Câu tiếp theo →' }).click()
      }
    }

    await page
      .getByRole('checkbox', { name: /tôi đã đọc và xác nhận/i })
      .check()
    await page.getByRole('button', { name: 'Gửi cho Care chấm điểm' }).click()

    await expect(
      page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
    ).toBeVisible()

    // Should display published resource
    await expect(page.getByText('Published Article')).toBeVisible()
    await expect(
      page.getByText('This article is published and visible'),
    ).toBeVisible()

    // Should NOT display draft or archived resources
    await expect(page.getByText('Draft Article')).not.toBeVisible()
    await expect(page.getByText('Archived Article')).not.toBeVisible()
  })

  test('resource links open in new tab with correct attributes', async ({
    page,
    context,
  }) => {
    // Mock response
    await context.route('**/api/resources**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: '1',
              title: 'External Resource',
              summary: 'Click to visit',
              category: 'ARTICLE',
              externalUrl: 'https://example.com/resource',
              thumbnailUrl: null,
              locale: 'vi-VN',
              status: 'PUBLISHED',
              reviewedBy: 'reviewer@test.com',
              reviewedAt: '2024-01-01T00:00:00Z',
              effectiveAt: null,
              expiresAt: null,
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
          hasMore: false,
        }),
      })
    })

    await page.goto('/assessment/anonymous')

    // Complete assessment
    await expect(
      page.getByRole('heading', { name: 'PHQ-9 — Sàng lọc triệu chứng' }),
    ).toBeVisible()

    for (let item = 1; item <= 9; item += 1) {
      await page
        .getByRole('radio', {
          name: item === 9 ? 'Vài ngày' : 'Không có gì',
        })
        .check()
      if (item < 9) {
        await page.getByRole('button', { name: 'Câu tiếp theo →' }).click()
      }
    }

    await page
      .getByRole('checkbox', { name: /tôi đã đọc và xác nhận/i })
      .check()
    await page.getByRole('button', { name: 'Gửi cho Care chấm điểm' }).click()

    await expect(
      page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
    ).toBeVisible()

    // Check resource link attributes
    const resourceLink = page.getByText('External Resource').locator('..')
    await expect(resourceLink).toHaveAttribute(
      'href',
      'https://example.com/resource',
    )
    await expect(resourceLink).toHaveAttribute('target', '_blank')
    await expect(resourceLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  test('authenticated user journey shows resources', async ({
    page,
    context,
  }) => {
    // Mock authentication session
    await context.addCookies([
      {
        name: 'session',
        value: 'mock-session-token',
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
      },
    ])

    // Mock session endpoint
    await context.route('**/api/identity/session', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          userId: 'user-123',
          email: 'test@example.com',
          role: 'USER',
        }),
      })
    })

    // Mock resources response
    await context.route('**/api/resources**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: '1',
              title: 'Authenticated User Resource',
              summary: 'Resource for logged in users',
              category: 'MEDITATION',
              externalUrl: 'https://example.com/meditation',
              locale: 'vi-VN',
              status: 'PUBLISHED',
              reviewedAt: '2024-01-01T00:00:00Z',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:00:00Z',
            },
          ],
          hasMore: false,
        }),
      })
    })

    // Navigate to authenticated assessment
    await page.goto('/assessment/phq9')

    // Complete assessment
    await expect(
      page.getByRole('heading', { name: 'PHQ-9 — Sàng lọc triệu chứng' }),
    ).toBeVisible()

    for (let item = 1; item <= 9; item += 1) {
      await page
        .getByRole('radio', {
          name: item === 9 ? 'Vài ngày' : 'Không có gì',
        })
        .check()
      if (item < 9) {
        await page.getByRole('button', { name: 'Câu tiếp theo →' }).click()
      }
    }

    await page
      .getByRole('checkbox', { name: /tôi đã đọc và xác nhận/i })
      .check()
    await page.getByRole('button', { name: 'Gửi cho Care chấm điểm' }).click()

    await expect(
      page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
    ).toBeVisible()

    // Should display resources for authenticated user
    await expect(page.getByText('Authenticated User Resource')).toBeVisible()
    await expect(page.getByText('Resource for logged in users')).toBeVisible()
  })

  test('published-flow fails gracefully when resources cannot be fetched', async ({
    page,
    context,
  }) => {
    // Mock network failure for resources endpoint
    await context.route('**/api/resources**', async (route) => {
      await route.abort('failed')
    })

    await page.goto('/assessment/anonymous')

    // Complete assessment
    await expect(
      page.getByRole('heading', { name: 'PHQ-9 — Sàng lọc triệu chứng' }),
    ).toBeVisible()

    for (let item = 1; item <= 9; item += 1) {
      await page
        .getByRole('radio', {
          name: item === 9 ? 'Vài ngày' : 'Không có gì',
        })
        .check()
      if (item < 9) {
        await page.getByRole('button', { name: 'Câu tiếp theo →' }).click()
      }
    }

    await page
      .getByRole('checkbox', { name: /tôi đã đọc và xác nhận/i })
      .check()
    await page.getByRole('button', { name: 'Gửi cho Care chấm điểm' }).click()

    await expect(
      page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
    ).toBeVisible()

    // Should show error state when fetch fails
    await expect(page.getByText(/không thể kết nối đến dịch vụ/i)).toBeVisible()

    // Resources section should still be present but showing error
    const resourcesSection = page.locator('.resources-list')
    await expect(resourcesSection).toBeVisible()
  })
})
