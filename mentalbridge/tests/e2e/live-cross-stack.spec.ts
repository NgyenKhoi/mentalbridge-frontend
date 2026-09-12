import { expect } from '@playwright/test'
import { execFile } from 'node:child_process'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { test } from './test-fixtures'

const isLive = process.env.E2E_RUNTIME === 'live-cross-stack'
const userAEmail = process.env.E2E_USER_A_EMAIL
const userBEmail = process.env.E2E_USER_B_EMAIL
const e2ePassword = process.env.E2E_USER_PASSWORD
const contentControlUrl = process.env.E2E_CONTENT_CONTROL_URL
const contentTestSecret = process.env.E2E_CONTENT_TEST_SECRET
const execFileAsync = promisify(execFile)
const controlledDocker = process.env.E2E_CONTROL_DOCKER === 'true'
const backendDirectory = resolve(
  process.cwd(),
  '..',
  '..',
  'mentalbridge-backend',
)

async function controlService(action: 'pause' | 'unpause', service: string) {
  if (!controlledDocker) throw new Error('E2E_CONTROL_DOCKER=true is required.')
  await execFileAsync(
    'docker',
    [
      'compose',
      '-f',
      'docker-compose.local.yml',
      '-f',
      'docker-compose.e2e.yml',
      '--env-file',
      '.local/e2e.env',
      action,
      service,
    ],
    { cwd: backendDirectory },
  )
}

test.skip(!isLive, 'Live cross-stack suite only runs with E2E_RUNTIME enabled.')
test.describe.configure({ mode: 'serial', timeout: 120_000 })

async function login(page: import('@playwright/test').Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mật khẩu').fill(e2ePassword ?? '')
  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/identity/login') &&
      response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  expect((await loginResponse).status()).toBe(200)
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
}

async function completePhq9(
  page: import('@playwright/test').Page,
  path = '/assessment/phq9',
) {
  await page.goto(path)
  const questionnaireHeading = page.getByRole('heading', {
    name: 'PHQ-9 — Sàng lọc triệu chứng',
  })
  const existingResult = page.getByRole('heading', {
    name: 'Kết quả sàng lọc PHQ-9',
  })
  const initialScreen = await Promise.race([
    questionnaireHeading
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => 'questionnaire'),
    existingResult
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => 'result'),
  ])
  if (initialScreen === 'result') {
    await page.getByRole('button', { name: 'Làm bài mới' }).click()
  }
  await expect(questionnaireHeading).toBeVisible({ timeout: 15_000 })
  for (let item = 1; item <= 9; item += 1) {
    await page.getByRole('radio', { name: 'Không có gì' }).check()
    if (item < 9) {
      await page.getByRole('button', { name: 'Câu tiếp theo →' }).click()
    }
  }
  await page.getByRole('checkbox', { name: /tôi đồng ý/i }).check()
  await page.getByRole('button', { name: 'Xem kết quả' }).click()
  await expect(
    page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
  ).toBeVisible({ timeout: 15_000 })
}

async function historyAssessmentIds(page: import('@playwright/test').Page) {
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().includes('/api/care/assessments/history') &&
      candidate.request().method() === 'GET',
  )
  await page.goto('/assessments')
  const historyResponse = await response
  expect(historyResponse.status()).toBe(200)
  const payload = (await historyResponse.json()) as {
    items: Array<{ assessmentId: string }>
  }
  return payload.items.map((item) => item.assessmentId)
}

async function createProfileAndGrantPrivacyConsent(
  page: import('@playwright/test').Page,
) {
  await page.goto('/profile')
  await expect(
    page.getByRole('heading', { name: /hồ sơ và quyền riêng tư/i }),
  ).toBeVisible()

  const profileEmptyState = page.getByRole('region', {
    name: 'Bạn chưa có hồ sơ',
  })
  const createProfile = profileEmptyState.getByRole('button', {
    name: 'Tạo hồ sơ',
  })
  if (await createProfile.isVisible()) {
    await page.getByLabel('Tên hiển thị').fill('Controlled E2E User A')
    const profileForm = page
      .getByLabel('Tên hiển thị')
      .locator('xpath=ancestor::form')
    const createResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/care/profile') &&
        response.request().method() === 'PUT',
    )
    await profileForm.getByRole('button', { name: 'Tạo hồ sơ' }).click()
    expect((await createResponse).status()).toBe(201)
    await expect(page.getByText('Đã tạo hồ sơ của bạn.')).toBeVisible({
      timeout: 15_000,
    })
  }

  const grant = page.getByRole('button', { name: 'Tôi đã đọc và xác nhận' })
  if (await grant.isVisible()) {
    await grant.click()
    await expect(
      page.getByText('Đã ghi nhận xác nhận quyền riêng tư.'),
    ).toBeVisible()
  }
}

test('anonymous PHQ-9 remains usable during a real Content outage', async ({
  page,
  request,
}) => {
  expect(contentControlUrl).toBeTruthy()
  expect(contentTestSecret).toBeTruthy()
  const headers = { 'x-e2e-secret': contentTestSecret as string }
  const enable = await request.post(
    `${contentControlUrl}/__test/content/outage`,
    { headers },
  )
  expect(enable.ok(), await enable.text()).toBe(true)
  try {
    await completePhq9(page, '/assessment/anonymous')
    await expect(
      page.getByText(/tạm thời không khả dụng|không thể tải tài liệu/i),
    ).toBeVisible()
    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
    ).toBeVisible()
  } finally {
    const disable = await request.delete(
      `${contentControlUrl}/__test/content/outage`,
      { headers },
    )
    expect(disable.ok(), await disable.text()).toBe(true)
  }
})

test('User A completes profile, consent, assessment, history, reassessment, and reviewed-resource journeys', async ({
  page,
}) => {
  expect(userAEmail).toBeTruthy()
  expect(e2ePassword).toBeTruthy()
  await login(page, userAEmail as string)
  await createProfileAndGrantPrivacyConsent(page)
  const initialHistoryIds = await historyAssessmentIds(page)
  await completePhq9(page)

  await expect(
    page.getByText(/Published|Bài thực hành|tài liệu/i),
  ).toBeVisible()
  const resultUrl = page.url()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
  ).toBeVisible()
  expect(resultUrl).not.toMatch(/access|refresh|token/i)

  const afterFirstAssessmentIds = await historyAssessmentIds(page)
  expect(
    afterFirstAssessmentIds.some((id) => !initialHistoryIds.includes(id)),
  ).toBe(true)
  await page.getByRole('link', { name: 'Xem lại' }).first().click()
  await expect(
    page.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
  ).toBeVisible()
  await completePhq9(page)
  const afterReassessmentIds = await historyAssessmentIds(page)
  expect(
    afterReassessmentIds.some((id) => !afterFirstAssessmentIds.includes(id)),
  ).toBe(true)
})

test('User B cannot open User A Care result', async ({ browser, page }) => {
  expect(userAEmail).toBeTruthy()
  expect(userBEmail).toBeTruthy()
  expect(e2ePassword).toBeTruthy()

  await login(page, userAEmail as string)
  await completePhq9(page)
  await historyAssessmentIds(page)
  const foreignResultUrl = await page
    .getByRole('link', { name: 'Xem lại' })
    .first()
    .getAttribute('href')
  expect(foreignResultUrl).toMatch(/assessmentId=/)

  const userBContext = await browser.newContext()
  const userBPage = await userBContext.newPage()
  try {
    await login(userBPage, userBEmail as string)
    const deniedResponse = userBPage.waitForResponse(
      (response) =>
        response.url().includes('/api/care/assessments/by-id/') &&
        response.request().method() === 'GET',
    )
    await userBPage.goto(foreignResultUrl as string)
    expect([403, 404]).toContain((await deniedResponse).status())
    await expect(
      userBPage.getByRole('heading', { name: 'Kết quả sàng lọc PHQ-9' }),
    ).toHaveCount(0)
    await expect(
      userBPage.getByRole('heading', { name: 'PHQ-9 — Sàng lọc triệu chứng' }),
    ).toHaveCount(0)
  } finally {
    await userBContext.close()
  }
})

test('Identity outage shows an explicit login state', async ({ page }) => {
  test.skip(
    !controlledDocker,
    'Controlled Docker access is required for outage simulation.',
  )
  await controlService('pause', 'identity')
  try {
    await page.goto('/login')
    await page.getByLabel('Email').fill(userAEmail as string)
    await page.getByLabel('Mật khẩu').fill(e2ePassword as string)
    await page.getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(
      page.getByText('Dịch vụ đăng nhập tạm thời chưa sẵn sàng.', {
        exact: false,
      }),
    ).toBeVisible({ timeout: 15_000 })
    await expect(page).toHaveURL(/\/login/)
  } finally {
    await controlService('unpause', 'identity')
  }
})

test('Care outage shows an explicit assessment state', async ({ page }) => {
  test.skip(
    !controlledDocker,
    'Controlled Docker access is required for outage simulation.',
  )
  await login(page, userAEmail as string)
  await controlService('pause', 'care')
  try {
    await page.goto('/assessment/phq9')
    await expect(
      page.getByText('Tính năng sàng lọc tạm thời chưa sẵn sàng.', {
        exact: false,
      }),
    ).toBeVisible({ timeout: 45_000 })
  } finally {
    await controlService('unpause', 'care')
  }
})

test('revoked session redirects safely without rendering protected data', async ({
  context,
  page,
}) => {
  await login(page, userAEmail as string)
  const revokedRefreshCookie = (await context.cookies()).find(
    (cookie) => cookie.name === 'mentalbridge_refresh',
  )
  expect(revokedRefreshCookie).toBeTruthy()

  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await expect(page).toHaveURL(/\/login/)
  await context.addCookies([revokedRefreshCookie!])

  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByText('Tổng quan')).toHaveCount(0)
})
