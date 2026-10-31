import { expect, test } from '@playwright/test'

test('login before hydration keeps credentials in the POST body and out of the navigation URL', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const page = await context.newPage()
    await page.goto(`${baseURL}/login`)
    await page.locator('#email').fill('privacy-check@synthetic.invalid')
    await page.locator('#password').fill('synthetic-not-a-real-credential')
    const submitted = page.waitForRequest(
      (request) =>
        request.isNavigationRequest() &&
        new URL(request.url()).pathname === '/login',
    )
    await page.locator('button[type="submit"]').click()
    const request = await submitted
    expect(request.method()).toBe('POST')
    expect(new URL(request.url()).search).toBe('')
    expect(request.postData()).toContain(
      'password=synthetic-not-a-real-credential',
    )
  } finally {
    await context.close()
  }
})
