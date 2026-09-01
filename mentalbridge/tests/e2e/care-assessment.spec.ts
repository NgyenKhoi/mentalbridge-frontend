import { expect, test, type Page } from '@playwright/test'

const anonymousCookieNames = new Set([
  'mentalbridge_care_anonymous_id',
  'mentalbridge_care_anonymous_token',
  'mentalbridge_care_anonymous_expiry',
  'mentalbridge_care_anonymous_assessment',
])

async function answerPublishedQuestionnaire(page: Page) {
  await expect(
    page.getByRole('heading', { name: 'PHQ-9 — Sàng lọc triệu chứng' }),
  ).toBeVisible()
  for (let item = 1; item <= 9; item += 1) {
    await page
      .getByRole('radio', { name: item === 9 ? 'Vài ngày' : 'Không có gì' })
      .check()
    if (item < 9) {
      await page.getByRole('button', { name: 'Câu tiếp theo →' }).click()
    }
  }
  await page.getByRole('button', { name: 'Gửi cho Care chấm điểm' }).click()
  await expect(
    page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
  ).toBeVisible()
  await expect(page.getByText('1', { exact: true })).toBeVisible()
  await expect(page.getByText('Dương tính theo quy tắc sàng lọc')).toBeVisible()
  await expect(page.getByText(/không giám sát con người 24\/7/i)).toBeVisible()
  await expect(page.getByText(/hotline/i)).toHaveCount(0)
}

test.describe('Care-backed PHQ-9 screening', () => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    'Controlled Care fixtures are available only with the managed local server.',
  )

  test('completes and reopens an anonymous result without exposing its bearer credential', async ({
    context,
    page,
  }) => {
    await page.goto('/assessment/anonymous')
    await answerPublishedQuestionnaire(page)

    const cookies = await context.cookies()
    const anonymousCookies = cookies.filter((cookie) =>
      anonymousCookieNames.has(cookie.name),
    )
    expect(anonymousCookies).toHaveLength(4)
    expect(anonymousCookies.every((cookie) => cookie.httpOnly)).toBe(true)
    expect(anonymousCookies.every((cookie) => cookie.sameSite === 'Lax')).toBe(
      true,
    )

    const browserState = await page.evaluate(() => ({
      cookie: document.cookie,
      local: JSON.stringify(localStorage),
      session: JSON.stringify(sessionStorage),
      html: document.documentElement.innerHTML,
    }))
    expect(browserState.cookie).not.toContain('mentalbridge_care_anonymous')
    expect(browserState.local).not.toMatch(/anonymous.*token/i)
    expect(browserState.session).not.toMatch(/anonymous.*token/i)
    expect(browserState.html).not.toContain('synthetic-anonymous')

    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
    ).toBeVisible()
  })

  test('completes and reopens the authenticated USER flow through Identity and Care BFFs', async ({
    context,
    page,
  }) => {
    await context.addCookies([
      {
        name: 'mentalbridge_access',
        value: 'synthetic-care-e2e-access',
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])

    await page.goto('/assessment/phq9')
    await answerPublishedQuestionnaire(page)
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
    ).toBeVisible()
  })
})
