import { expect, type Locator, type Page } from '@playwright/test'
import {
  adminDestinationDetail,
  adminDestinationQueue,
  adminPayoutRow,
  payosTime,
  workspaceId,
} from '../fixtures/specialist-workspace'
import { test } from './test-fixtures'

test.use({ locale: 'vi-VN', timezoneId: 'Asia/Bangkok' })
test.beforeEach(async ({ request }) => {
  expect(
    (await request.post('http://127.0.0.1:3201/__test/reset')).status(),
  ).toBe(204)
})

async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin-resource-e2e@example.com')
  await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard$/)
}

async function assertLayout(page: Page, primary: Locator) {
  for (const width of [1440, 1280, 768, 375]) {
    await page.setViewportSize({ width, height: 900 })
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(
      page.getByRole('heading', { name: 'Đối soát chuyên gia' }),
    ).toBeInViewport()
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true)
    await primary.scrollIntoViewIfNeeded()
    await expect(primary).toBeInViewport()
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true)
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
}

const problem = (status: number, code: string) => ({
  status,
  json: {
    type: 'about:blank',
    title: 'Problem',
    status,
    code,
    correlationId: 'e2e-correlation',
  },
})

test('confirmation queue: loading, error, check, version conflict, confirm and empty', async ({
  page,
}) => {
  test.setTimeout(120000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  let queue = structuredClone(adminDestinationQueue)
  let queueCalls = 0
  // A real edit disables the old revision and creates a new current one with a new id.
  const replacement = {
    ...adminDestinationDetail.destination,
    id: workspaceId(302),
    bankName: 'Ngân hàng TMCP Tiên Phong',
  }
  let edited = false
  const confirms: { key: string | null; body: unknown; id: string }[] = []
  await page.route('**/api/consultation/admin/payouts', (route) =>
    route.fulfill({
      json: { generatedAt: payosTime, count: 1, items: [adminPayoutRow] },
    }),
  )
  await page.route(
    '**/api/consultation/admin/payout-destinations?**',
    async (route) => {
      queueCalls += 1
      await new Promise((resolve) => setTimeout(resolve, 300))
      if (queueCalls === 1)
        return route.fulfill(problem(503, 'SERVICE_UNAVAILABLE'))
      return route.fulfill({ json: queue })
    },
  )
  await page.route(
    '**/api/consultation/admin/payout-destinations/*',
    async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 300))
      const isNew = route.request().url().endsWith(replacement.id)
      return route.fulfill({
        json: {
          ...adminDestinationDetail,
          destination: isNew ? replacement : adminDestinationDetail.destination,
          accountHolderName: isNew ? 'TRAN THI B' : 'NGUYEN VAN A',
        },
      })
    },
  )
  await page.route(
    '**/api/consultation/admin/payout-destinations/*/confirm',
    async (route) => {
      const body = route.request().postDataJSON()
      confirms.push({
        key: route.request().headers()['idempotency-key'],
        body,
        id: route.request().url().split('/').slice(-2)[0],
      })
      if (confirms.length === 1) {
        edited = true
        queue = {
          ...queue,
          items: [
            { ...queue.items[0], destination: replacement },
            queue.items[1],
          ],
        }
        return route.fulfill(
          problem(409, 'PAYOUT_DESTINATION_VERSION_CONFLICT'),
        )
      }
      queue = { ...queue, count: 1, items: queue.items.slice(1) }
      return route.fulfill({
        json: { ...adminDestinationDetail.destination, status: 'VERIFIED' },
      })
    },
  )
  await loginAsAdmin(page)
  await page.goto('/admin/payouts')

  // Loading skeleton, then an error with a text retry (queue only; the ledger is separate).
  await expect(
    page.getByRole('status', { name: 'Đang tải hàng chờ' }),
  ).toBeVisible()
  await expect(page.getByText('Chưa thể tải hàng chờ xác nhận')).toBeVisible()
  await page.getByRole('button', { name: 'Thử lại' }).click()

  // Queue rows show masked data only; tabs are keyboard operable.
  const queueTab = page.getByRole('tab', { name: /Tài khoản chờ xác nhận/ })
  await expect(queueTab).toHaveAttribute('aria-selected', 'true')
  await expect(queueTab.getByLabel('2 tài khoản')).toBeVisible()
  await expect(page.getByText('••••7890').first()).toBeVisible()
  await expect(page.getByText('1234567890')).toHaveCount(0)
  const check = page.getByRole('button', { name: 'Kiểm tra' }).first()
  await assertLayout(page, check)
  await queueTab.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: 'Yêu cầu chi trả' })).toBeFocused()
  await page.keyboard.press('ArrowLeft')
  await expect(queueTab).toBeFocused()
  await page.keyboard.press('Enter')

  // Check dialog: detail skeleton, exact data, the checkbox gates the primary action.
  await check.click()
  const dialog = page.getByRole('dialog', {
    name: 'Kiểm tra tài khoản nhận tiền',
  })
  await expect(
    dialog.getByRole('status', { name: 'Đang tải thông tin tài khoản' }),
  ).toBeVisible()
  await expect(dialog.getByText('1234 5678 90')).toBeVisible()
  await expect(dialog.getByText('NGUYEN VAN A')).toBeVisible()
  const confirm = dialog.getByRole('button', { name: 'Xác nhận tài khoản' })
  await expect(confirm).toBeDisabled()
  await dialog.getByRole('checkbox').check()
  await expect(confirm).toBeEnabled()
  await confirm.click()

  // The specialist changed the account meanwhile: inline message, refresh the queue, check the new revision.
  await expect(dialog.getByRole('alert')).toContainText(
    'Chuyên gia vừa đổi tài khoản. Tải lại để kiểm tra thông tin mới.',
  )
  await dialog.getByRole('button', { name: 'Tải lại danh sách' }).click()
  await expect(dialog).not.toBeVisible()
  // The replaced revision leaves the queue; the new one appears beside the other row.
  await expect(page.getByText('Ngân hàng TMCP Tiên Phong')).toBeVisible()
  await expect(
    page.getByText('Ngân hàng TMCP Ngoại thương Việt Nam'),
  ).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Kiểm tra' })).toHaveCount(2)
  await check.click()
  await expect(dialog.getByText('TRAN THI B')).toBeVisible()
  await expect(dialog.getByRole('checkbox')).not.toBeChecked()
  await dialog.getByRole('checkbox').check()
  await confirm.click()
  await expect(dialog).not.toBeVisible()
  await expect(page.getByText('Đã xác nhận tài khoản')).toBeVisible()
  expect(confirms).toHaveLength(2)
  expect(edited).toBe(true)
  expect(confirms[0].id).toBe(adminDestinationDetail.destination.id)
  expect(confirms[1].id).toBe(replacement.id)
  expect(confirms[0].body).toEqual({
    expectedVersion: 0,
    reasonCode: 'ACCOUNT_HOLDER_CHECKED',
  })
  expect(confirms[1].body).toEqual({
    expectedVersion: 0,
    reasonCode: 'ACCOUNT_HOLDER_CHECKED',
  })
  expect(confirms[1].key).not.toBe(confirms[0].key)
  await expect(queueTab.getByLabel('1 tài khoản')).toBeVisible()
  await expect(page.getByText('••••7890')).toHaveCount(0)

  // Empty queue, honest and short.
  queue = { ...queue, count: 0, items: [] }
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(
    page.getByText('Không có tài khoản nào chờ xác nhận.'),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('ledger: provider, review state, reason lines and explicit retry of a definite failure', async ({
  page,
}) => {
  test.setTimeout(120000)
  const stuck = { ...adminPayoutRow }
  let rows: (typeof adminPayoutRow)[] = [
    stuck,
    {
      ...adminPayoutRow,
      payoutId: workspaceId(311),
      status: 'UNKNOWN',
      failureCode: 'PAYOUT_RECONCILIATION_OVERDUE',
      reconciliationStatus: 'NEEDS_REVIEW',
      reviewRequiredAt: payosTime,
    } as never,
    {
      ...adminPayoutRow,
      payoutId: workspaceId(312),
      status: 'PROCESSING',
      failureCode: null,
      reconciliationStatus: 'POLLING',
    } as never,
  ]
  const retries: { key: string | null; body: unknown }[] = []
  let retryMode: 'ok' | 'conflict' | 'down' = 'conflict'
  await page.route('**/api/consultation/admin/payouts', (route) =>
    route.fulfill({
      json: { generatedAt: payosTime, count: rows.length, items: rows },
    }),
  )
  await page.route(
    '**/api/consultation/admin/payout-destinations?**',
    (route) =>
      route.fulfill({
        json: { generatedAt: payosTime, count: 0, items: [] },
      }),
  )
  await page.route('**/api/consultation/admin/payouts/*', (route) =>
    route.fulfill({
      json: {
        payout: stuck,
        attempts: [
          {
            attemptId: workspaceId(320),
            attemptNumber: 1,
            provider: 'PAYOS',
            status: 'FAILED',
            providerReference: null,
            failureCode: 'PAYOUT_INSUFFICIENT_BALANCE',
            requestedAt: payosTime,
            reconciliationStatus: 'COMPLETE',
            nextReconciliationAt: null,
            reviewRequiredAt: null,
          },
        ],
        earnings: [],
        events: [],
      },
    }),
  )
  await page.route('**/api/consultation/admin/payouts/*/retry', (route) => {
    retries.push({
      key: route.request().headers()['idempotency-key'],
      body: route.request().postDataJSON(),
    })
    if (retryMode === 'conflict')
      return route.fulfill(problem(409, 'PAYOUT_RETRY_NOT_AVAILABLE'))
    if (retryMode === 'down')
      return route.fulfill(problem(503, 'PAYOUT_PROVIDER_UNAVAILABLE'))
    rows = [
      {
        ...stuck,
        status: 'PROCESSING',
        failureCode: null,
        reconciliationStatus: 'POLLING',
      } as never,
      ...rows.slice(1),
    ]
    return route.fulfill({
      json: { payout: rows[0], attempts: [], earnings: [], events: [] },
    })
  })
  await loginAsAdmin(page)
  await page.goto('/admin/payouts')

  // Empty queue opens the ledger directly.
  await expect(page.getByText('Sổ đối soát')).toBeVisible()
  await expect(page.getByText(/Việc chi tiền thật vẫn bị tắt/)).toHaveCount(0)
  await expect(page.getByText('PayOS', { exact: true }).first()).toBeVisible()
  await expect(
    page.getByText('Cần kiểm tra', { exact: true }).last(),
  ).toBeVisible()
  await expect(
    page.getByText('Số dư chi hộ PayOS không đủ. Nạp thêm rồi chuyển lại.'),
  ).toBeVisible()
  await expect(
    page.getByText(
      'Quá 24 giờ chưa có kết quả. Kiểm tra trên PayOS trước khi xử lý.',
    ),
  ).toBeVisible()
  // Only the definitely failed, locally complete row offers a retry.
  const retry = page.getByRole('button', { name: 'Chuyển lại' })
  await expect(retry).toHaveCount(1)
  await assertLayout(page, retry)

  // Refused: calm toast, nothing silently retried.
  await retry.click()
  const confirm = page.getByRole('dialog', { name: /Chuyển lại/ })
  await expect(confirm).toContainText('Số dư chi hộ PayOS không đủ')
  await confirm.getByRole('button', { name: 'Chuyển lại' }).click()
  await expect(page.getByText('Không thể chuyển lại yêu cầu này')).toBeVisible()
  expect(retries[0].body).toEqual({ expectedAttemptId: workspaceId(320) })

  // Provider down: its own message.
  retryMode = 'down'
  await retry.click()
  await page
    .getByRole('dialog', { name: /Chuyển lại/ })
    .getByRole('button', { name: 'Chuyển lại' })
    .click()
  await expect(
    page.getByText('PayOS đang không sẵn sàng. Thử lại sau.'),
  ).toBeVisible()

  // Accepted: the pill changes in place and the retry button disappears.
  retryMode = 'ok'
  await retry.click()
  await page
    .getByRole('dialog', { name: /Chuyển lại/ })
    .getByRole('button', { name: 'Chuyển lại' })
    .click()
  await expect(page.getByText('Đã tạo lần chuyển mới')).toBeVisible()
  await expect(
    page.locator('.apo-status', { hasText: 'Đang xử lý' }).first(),
  ).toBeVisible()
  await expect(retry).toHaveCount(0)
})

test('ledger: closing a definite failure releases it once and leaves a closed row', async ({
  page,
}) => {
  test.setTimeout(120000)
  let row: Record<string, unknown> = { ...adminPayoutRow }
  const closes: { key: string | null; body: unknown }[] = []
  let closeMode: 'conflict' | 'ok' = 'conflict'
  await page.route('**/api/consultation/admin/payouts', (route) =>
    route.fulfill({
      json: { generatedAt: payosTime, count: 1, items: [row] },
    }),
  )
  await page.route(
    '**/api/consultation/admin/payout-destinations?**',
    (route) =>
      route.fulfill({
        json: { generatedAt: payosTime, count: 0, items: [] },
      }),
  )
  await page.route('**/api/consultation/admin/payouts/*', (route) =>
    route.fulfill({
      json: {
        payout: row,
        attempts: [
          {
            attemptId: workspaceId(320),
            attemptNumber: 1,
            provider: 'PAYOS',
            status: 'FAILED',
            providerReference: null,
            failureCode: 'PAYOUT_INSUFFICIENT_BALANCE',
            requestedAt: payosTime,
            reconciliationStatus: 'COMPLETE',
            nextReconciliationAt: null,
            reviewRequiredAt: null,
          },
        ],
        earnings: [],
        events: [],
      },
    }),
  )
  await page.route(
    '**/api/consultation/admin/payouts/*/close-failed',
    (route) => {
      closes.push({
        key: route.request().headers()['idempotency-key'],
        body: route.request().postDataJSON(),
      })
      if (closeMode === 'conflict')
        return route.fulfill(problem(409, 'PAYOUT_CLOSE_NOT_AVAILABLE'))
      row = { ...row, closedAt: payosTime }
      return route.fulfill({
        json: { payout: row, attempts: [], earnings: [], events: [] },
      })
    },
  )
  await loginAsAdmin(page)
  await page.goto('/admin/payouts')

  const close = page.getByRole('button', { name: 'Đóng yêu cầu' })
  await expect(close).toHaveCount(1)
  await assertLayout(page, close)

  // Refused: calm toast, nothing closed.
  await close.click()
  const confirm = page.getByRole('dialog', { name: /Đóng yêu cầu/ })
  await expect(confirm).toContainText('Hệ thống không chuyển tiền')
  await confirm.getByRole('button', { name: 'Đóng yêu cầu' }).click()
  await expect(page.getByText('Không thể đóng yêu cầu này')).toBeVisible()
  expect(closes[0].body).toEqual({
    expectedAttemptId: workspaceId(320),
    reasonCode: 'DESTINATION_UNUSABLE',
  })

  // Accepted: the pill changes in place and both buttons leave.
  closeMode = 'ok'
  await close.click()
  await page
    .getByRole('dialog', { name: /Đóng yêu cầu/ })
    .getByRole('button', { name: 'Đóng yêu cầu' })
    .click()
  await expect(
    page.getByText('Số tiền đã trở lại số dư của chuyên gia.'),
  ).toBeVisible()
  await expect(
    page.locator('.apo-status', { hasText: 'Đã đóng' }).first(),
  ).toBeVisible()
  await expect(close).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Chuyển lại' })).toHaveCount(0)
  expect(closes).toHaveLength(2)
  expect(closes[1].key).toBeTruthy()
})
