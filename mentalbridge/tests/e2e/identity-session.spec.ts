import { expect, test, type BrowserContext, type Page } from '@playwright/test'

const identityFixtureUrl = 'http://127.0.0.1:3201'
const sessionCookieNames = new Set([
  'mentalbridge_access',
  'mentalbridge_refresh',
])

type FixtureState = Readonly<{
  loginCount: number
  accountCount: number
  refreshCount: number
  logoutCount: number
  logoutAllCount: number
  activeAccessSessionCount: number
  activeRefreshSessionCount: number
}>

async function resetFixture(
  request: import('@playwright/test').APIRequestContext,
) {
  const response = await request.post(`${identityFixtureUrl}/__test/reset`)
  expect(response.status()).toBe(204)
}

async function fixtureState(
  request: import('@playwright/test').APIRequestContext,
) {
  const response = await request.get(`${identityFixtureUrl}/__test/state`)
  expect(response.ok()).toBe(true)
  return (await response.json()) as FixtureState
}

async function login(page: Page, email: string, expectedPath: RegExp) {
  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/identity/login') &&
      response.request().method() === 'POST',
  )

  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()

  const loginResponse = await loginResponsePromise
  expect(loginResponse.status()).toBe(200)
  expect(await loginResponse.json()).toEqual({ authenticated: true })
  await expect(page).toHaveURL(expectedPath)
}

async function expectProtectedSession(context: BrowserContext, page: Page) {
  const cookies = await context.cookies()
  const sessionCookies = cookies.filter((cookie) =>
    sessionCookieNames.has(cookie.name),
  )

  expect(sessionCookies).toHaveLength(2)
  expect(sessionCookies.every((cookie) => cookie.httpOnly)).toBe(true)
  expect(sessionCookies.every((cookie) => cookie.secure)).toBe(true)
  expect(sessionCookies.every((cookie) => cookie.sameSite === 'Lax')).toBe(true)
  expect(sessionCookies.every((cookie) => cookie.path === '/')).toBe(true)

  const browserState = await page.evaluate(() => ({
    documentCookie: document.cookie,
    localStorage: Object.entries(localStorage),
    sessionStorage: Object.entries(sessionStorage),
    url: window.location.href,
  }))

  expect(browserState.documentCookie).not.toContain('mentalbridge_')
  expect(JSON.stringify(browserState.localStorage)).not.toMatch(
    /access|refresh/i,
  )
  expect(JSON.stringify(browserState.sessionStorage)).not.toMatch(
    /access|refresh/i,
  )
  expect(browserState.url).not.toMatch(/access|refresh|token/i)
}

async function expectSessionCleared(context: BrowserContext) {
  const cookies = await context.cookies()
  expect(
    cookies.filter((cookie) => sessionCookieNames.has(cookie.name)),
  ).toEqual([])
}

test.describe('Identity session delivery', () => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    'Controlled Identity fixtures are available only with the managed local server.',
  )
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ request }) => {
    await resetFixture(request)
  })

  test('logs in a USER, enforces role authorization, and logs out locally and upstream', async ({
    context,
    page,
    request,
  }) => {
    await login(page, 'user@example.com', /\/dashboard$/)
    await expectProtectedSession(context, page)

    await page.goto('/admin/dashboard')
    await expect(page).toHaveURL(/\/dashboard$/)

    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
    await expect(page).toHaveURL(/\/login$/)
    await expectSessionCleared(context)

    const state = await fixtureState(request)
    expect(state.loginCount).toBe(1)
    expect(state.logoutCount).toBe(1)
    expect(state.logoutAllCount).toBe(0)
    expect(state.activeAccessSessionCount).toBe(0)
    expect(state.activeRefreshSessionCount).toBe(0)
  })

  test('rotates an expired access session before protected navigation', async ({
    context,
    page,
    request,
  }) => {
    await login(page, 'refresh@example.com', /\/dashboard$/)
    await expectProtectedSession(context, page)

    const state = await fixtureState(request)
    expect(state.loginCount).toBe(1)
    expect(state.refreshCount).toBe(1)
    expect(state.accountCount).toBeGreaterThanOrEqual(2)
    expect(state.activeAccessSessionCount).toBe(1)
    expect(state.activeRefreshSessionCount).toBe(1)
  })

  test('routes a SPECIALIST from the confirmed backend role and logs out all sessions', async ({
    context,
    page,
    request,
  }) => {
    await login(page, 'specialist@example.com', /\/specialist\/dashboard$/)
    await expectProtectedSession(context, page)

    await page
      .getByRole('button', { name: 'Đăng xuất mọi thiết bị', exact: true })
      .click()
    await expect(page).toHaveURL(/\/login$/)
    await expectSessionCleared(context)

    const state = await fixtureState(request)
    expect(state.loginCount).toBe(1)
    expect(state.logoutCount).toBe(0)
    expect(state.logoutAllCount).toBe(1)
    expect(state.activeAccessSessionCount).toBe(0)
    expect(state.activeRefreshSessionCount).toBe(0)
  })
})
