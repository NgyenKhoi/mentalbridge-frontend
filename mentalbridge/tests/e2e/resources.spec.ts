import { expect, type BrowserContext, type Page } from '@playwright/test'

import { test } from './test-fixtures'

test.describe('Resources journey', () => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    'Controlled Content and Care fixtures are available only with the managed local server.',
  )

  async function completeAssessment(page: Page, path: string) {
    await page.goto(path)
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
  }

  async function mockResources(
    context: BrowserContext,
    status: number,
    body: unknown,
  ) {
    await context.route('**/api/resources**', async (route) => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    })
  }

  test('loads reviewed published resources through the real BFF for an anonymous result', async ({
    page,
  }) => {
    const responsePromise = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === '/api/resources' &&
        response.status() === 200,
    )

    await completeAssessment(page, '/assessment/anonymous')
    await responsePromise

    await expect(page.getByText('Published Resource')).toBeVisible()
    await expect(page.getByText('Draft Resource')).toHaveCount(0)
    await expect(page.getByText('Archived Resource')).toHaveCount(0)
    await expect(page.locator('.resources-grid > *')).toHaveCount(1)

    const link = page.getByRole('link', { name: /published resource/i })
    await expect(link).toHaveAttribute(
      'href',
      'https://example.com/reviewed-resource',
    )
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    await link.focus()
    await expect(link).toBeFocused()
  })

  test('loads resources for the authenticated USER result without skipping the journey', async ({
    context,
    page,
  }) => {
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

    await completeAssessment(page, '/assessment/phq9')

    await expect(page.getByText('Published Resource')).toBeVisible()
    await expect(page.getByText('Draft Resource')).toHaveCount(0)
    await expect(page.getByText('Archived Resource')).toHaveCount(0)
  })

  test('distinguishes an empty catalogue from dependency failure', async ({
    context,
    page,
  }) => {
    await mockResources(context, 200, { items: [], hasMore: false })

    await completeAssessment(page, '/assessment/anonymous')

    await expect(page.getByText('Hiện chưa có tài liệu nào')).toBeVisible()
    await expect(page.getByText(/tạm thời không khả dụng/i)).toHaveCount(0)
  })

  test('renders the reviewed unavailable fallback returned by the BFF', async ({
    context,
    page,
  }) => {
    await mockResources(context, 200, {
      items: [],
      hasMore: false,
      unavailable: true,
      message:
        'Tài nguyên hỗ trợ tạm thời không khả dụng. Vui lòng thử lại sau.',
    })

    await completeAssessment(page, '/assessment/anonymous')

    await expect(
      page.getByText(
        'Tài nguyên hỗ trợ tạm thời không khả dụng. Vui lòng thử lại sau.',
      ),
    ).toBeVisible()
  })

  test('renders a distinct timeout state', async ({ context, page }) => {
    await mockResources(context, 504, { code: 'CONTENT_TIMEOUT' })

    await completeAssessment(page, '/assessment/anonymous')

    await expect(
      page.getByText('Dịch vụ đang bận, vui lòng thử lại sau'),
    ).toBeVisible()
  })

  test('renders a generic error for an unauthorized response', async ({
    context,
    page,
  }) => {
    await mockResources(context, 401, { code: 'CONTENT_REQUEST_FAILED' })

    await completeAssessment(page, '/assessment/anonymous')

    await expect(page.getByText('Không thể tải tài liệu')).toBeVisible()
  })

  test('keeps the assessment result usable when the resource request fails', async ({
    context,
    page,
  }) => {
    await context.route('**/api/resources**', async (route) => {
      await route.abort('failed')
    })

    await completeAssessment(page, '/assessment/anonymous')

    await expect(page.getByText('Không thể kết nối đến dịch vụ')).toBeVisible()
    await expect(page.locator('.resources-list')).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Làm bài mới' }),
    ).toBeEnabled()
  })

  test('maps a malformed provider response to dependency unavailable', async ({
    context,
    page,
  }) => {
    await mockResources(context, 502, { code: 'CONTENT_INVALID_RESPONSE' })

    await completeAssessment(page, '/assessment/anonymous')

    await expect(
      page.getByText('Dịch vụ tạm thời không khả dụng'),
    ).toBeVisible()
  })
})
