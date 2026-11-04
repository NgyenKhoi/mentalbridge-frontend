import { expect, type Locator, type Page } from '@playwright/test'
import type { SpecialistEarnings } from '@/lib/consultation/consultation-validation'
import { approvedProfile } from '../fixtures/profile-amendment'
import {
  payosBanks,
  payosConfirmedDestination,
  payosEarnings,
  payosLegacyMomo,
  payosPayout,
  payosPendingDestination,
  workspaceId,
} from '../fixtures/specialist-workspace'
import { test } from './test-fixtures'

test.use({ locale: 'vi-VN', timezoneId: 'Asia/Bangkok' })
test.beforeEach(async ({ request }) => {
  expect(
    (await request.post('http://127.0.0.1:3201/__test/reset')).status(),
  ).toBe(204)
})

async function enter(page: Page) {
  await page.route('**/api/consultation/specialist-profile', (route) =>
    route.fulfill({ json: approvedProfile }),
  )
  await page.goto('/login')
  await page.getByLabel('Email').fill('specialist@example.com')
  await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/specialist\/dashboard$/)
}

// No horizontal scroll at the four breakpoints; the primary action is reachable on the first view and after scrolling.
async function assertLayout(page: Page, primary: Locator) {
  for (const width of [1440, 1280, 768, 375]) {
    await page.setViewportSize({ width, height: 900 })
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(
      page.getByRole('heading', { name: 'Thu nhập & thanh toán' }),
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

async function openEarnings(
  page: Page,
  state: { facts: SpecialistEarnings },
  extra?: () => Promise<void>,
) {
  await page.route('**/api/consultation/specialist/earnings', (route) =>
    route.fulfill({ json: state.facts }),
  )
  await extra?.()
  await enter(page)
  await page.goto('/specialist/earnings')
  await expect(
    page.getByRole('heading', { name: 'Số dư khả dụng' }),
  ).toBeVisible()
}
const refresh = (page: Page) =>
  page.getByRole('button', { name: 'Làm mới', exact: true }).click()

test('bank account lifecycle: add, pending, confirmed, withdraw, processing steps, paid', async ({
  page,
}) => {
  test.setTimeout(120000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  const state = { facts: payosEarnings({ destination: null }) }
  const saved: unknown[] = []
  const commands: { key: string | null; body: unknown }[] = []
  let bankCalls = 0
  await openEarnings(page, state, async () => {
    await page.route(
      '**/api/consultation/specialist/payout-banks',
      async (route) => {
        bankCalls += 1
        await new Promise((resolve) => setTimeout(resolve, 400))
        if (bankCalls === 1)
          return route.fulfill({
            status: 503,
            json: {
              title: 'Unavailable',
              status: 503,
              code: 'PAYOUT_BANK_LIST_UNAVAILABLE',
            },
          })
        return route.fulfill({ json: payosBanks })
      },
    )
    await page.route(
      '**/api/consultation/specialist/payout-destination',
      async (route) => {
        saved.push(route.request().postDataJSON())
        await new Promise((resolve) => setTimeout(resolve, 300))
        state.facts = payosEarnings({ destination: payosPendingDestination })
        return route.fulfill({ json: payosPendingDestination })
      },
    )
    await page.route(
      '**/api/consultation/specialist/payouts',
      async (route) => {
        commands.push({
          key: route.request().headers()['idempotency-key'],
          body: route.request().postDataJSON(),
        })
        await new Promise((resolve) => setTimeout(resolve, 500))
        state.facts = payosEarnings({
          balance: {
            ...payosEarnings().balance,
            availableVnd: 0,
            processingVnd: 420000,
          },
          payouts: [payosPayout],
        })
        return route.fulfill({ json: state.facts })
      },
    )
  })

  // No destination: honest reason, one primary action.
  await expect(page.getByText('Cần thiết lập nơi nhận tiền')).toBeVisible()
  const setup = page.getByRole('button', {
    name: 'Thiết lập nơi nhận',
    exact: true,
  })
  await assertLayout(page, setup)

  // Add a bank account: bank-only form, list loading then a 503 with a text retry.
  await setup.click()
  const dialog = page.getByRole('dialog', { name: 'Thiết lập thông tin nhận' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('radio')).toHaveCount(0)
  const bank = dialog.getByRole('combobox', { name: 'Ngân hàng' })
  await expect(bank).toHaveAttribute(
    'placeholder',
    'Đang tải danh sách ngân hàng…',
  )
  await expect(
    dialog.getByText('Chưa tải được danh sách ngân hàng.'),
  ).toBeVisible()
  await dialog.getByRole('button', { name: 'Thử lại' }).click()
  await expect(bank).not.toHaveAttribute('aria-disabled', 'true')

  // Validation: holder first, then a bank that is not on the list.
  await dialog.getByRole('button', { name: 'Lưu thông tin nhận' }).click()
  await expect(dialog.getByLabel('Tên chủ tài khoản')).toBeFocused()
  await dialog.getByLabel('Tên chủ tài khoản').fill('nguyen van a')
  await expect(dialog.getByLabel('Tên chủ tài khoản')).toHaveValue(
    'NGUYEN VAN A',
  )
  await bank.fill('VCB123')
  await dialog.getByLabel('Số tài khoản').fill('123456')
  await dialog.getByRole('button', { name: 'Lưu thông tin nhận' }).click()
  await expect(dialog.getByRole('alert')).toContainText(
    'Chọn ngân hàng từ danh sách.',
  )
  await expect(bank).toBeFocused()

  // Pick from the list by search without accents, with the keyboard.
  await bank.fill('dong a')
  await expect(page.getByRole('option')).toHaveCount(1)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(bank).toHaveValue('DongA Bank')
  await dialog.getByLabel('Số tài khoản').fill('1234 5678 90')
  await dialog.getByRole('button', { name: 'Lưu thông tin nhận' }).click()
  await expect(dialog.getByLabel('Số tài khoản')).toBeDisabled()
  await expect(dialog).not.toBeVisible()
  expect(saved).toEqual([
    {
      destinationType: 'BANK_ACCOUNT',
      bankCode: '970406',
      accountReference: '1234567890',
      accountHolderName: 'NGUYEN VAN A',
    },
  ])

  // Pending: calm badge, one note, withdrawal blocked with its reason.
  await expect(page.getByText('Đã gửi tài khoản để xác nhận')).toBeVisible()
  await expect(page.getByText('Chờ xác nhận', { exact: true })).toBeVisible()
  await expect(
    page.getByText(/Chúng tôi kiểm tra tên chủ tài khoản một lần/),
  ).toBeVisible()
  await expect(page.getByText('Tài khoản đang chờ xác nhận')).toBeVisible()
  const withdraw = page.getByRole('button', {
    name: 'Rút toàn bộ số dư',
    exact: true,
  })
  await expect(withdraw).toBeDisabled()
  await assertLayout(
    page,
    page.getByRole('button', { name: 'Cập nhật nơi nhận tiền' }),
  )

  // Confirmed by an admin: the account becomes usable after a refresh.
  state.facts = payosEarnings({ destination: payosConfirmedDestination })
  await refresh(page)
  await expect(page.getByText('Đã xác nhận', { exact: true })).toBeVisible()
  await expect(page.getByText('Đủ điều kiện yêu cầu rút tiền')).toBeVisible()
  await expect(withdraw).toBeEnabled()
  await assertLayout(page, withdraw)

  // Submitting is locked, then the payout shows its steps while the bank confirms.
  await withdraw.click()
  const confirmDialog = page.getByRole('dialog', {
    name: 'Rút toàn bộ số dư khả dụng',
  })
  await confirmDialog.getByRole('button', { name: 'Xác nhận rút tiền' }).click()
  await expect(
    confirmDialog.getByRole('button', { name: 'Đang gửi…' }),
  ).toBeDisabled()
  await expect(confirmDialog).not.toBeVisible()
  expect(commands).toHaveLength(1)
  expect(commands[0].key).toBeTruthy()
  expect(commands[0].body).toEqual({
    destinationId: payosConfirmedDestination.id,
  })
  const steps = page.getByRole('list', { name: 'Tiến trình chuyển tiền' })
  await expect(steps).toBeVisible()
  await expect(steps.locator('[aria-current="step"]')).toContainText(
    'Ngân hàng đang xác nhận',
  )
  await expect(page.getByText('Qua PayOS')).toBeVisible()
  await expect(withdraw).toBeDisabled()
  await assertLayout(
    page,
    page.getByRole('heading', { name: 'Lịch sử chi trả' }),
  )

  // Paid: the check completes and the list collapses into the plain row.
  state.facts = payosEarnings({
    balance: { ...payosEarnings().balance, availableVnd: 0, paidVnd: 630000 },
    payouts: [
      {
        ...payosPayout,
        status: 'SUCCEEDED',
        completedAt: payosPayout.requestedAt,
        reconciliationStatus: 'COMPLETE',
      },
    ],
  })
  await refresh(page)
  await expect(steps).toBeHidden({ timeout: 5000 })
  await expect(
    page.getByText('Đã thanh toán', { exact: true }).first(),
  ).toBeVisible()
  expect(errors).toEqual([])
})

test('operator-side and uncertain states stay calm and never ask the specialist to act', async ({
  page,
}) => {
  test.setTimeout(120000)
  const state = { facts: payosEarnings() }
  await openEarnings(page, state)
  const heading = page.getByRole('heading', { name: 'Lịch sử chi trả' })

  // Insufficient PayOS balance: neutral wait, balance shown as waiting to be sent again.
  state.facts = payosEarnings({
    balance: {
      ...payosEarnings().balance,
      availableVnd: 0,
      retryPendingVnd: 420000,
    },
    payouts: [
      {
        ...payosPayout,
        status: 'FAILED',
        failureCode: 'PAYOUT_INSUFFICIENT_BALANCE',
        completedAt: payosPayout.requestedAt,
        reconciliationStatus: 'COMPLETE',
      },
    ],
  })
  await refresh(page)
  await expect(page.getByText(/bạn không cần làm gì/)).toBeVisible()
  await expect(page.getByText('Chờ chuyển lại')).toHaveCount(2)
  await expect(page.getByText(/PAYOUT_|nạp thêm|thử lại/i)).toHaveCount(0)
  await assertLayout(page, heading)

  // Rejected by the bank: money is safe, no retry for the specialist.
  state.facts = payosEarnings({
    payouts: [
      {
        ...payosPayout,
        status: 'FAILED',
        failureCode: 'PAYOUT_PROVIDER_REJECTED',
        completedAt: payosPayout.requestedAt,
        reconciliationStatus: 'COMPLETE',
      },
    ],
  })
  await refresh(page)
  await expect(page.getByText('Chưa thành công')).toBeVisible()
  await expect(page.getByText(/Ngân hàng chưa nhận giao dịch/)).toBeVisible()
  await expect(page.getByText(/PAYOUT_/)).toHaveCount(0)

  // Unknown and overdue: a review state that blocks a new withdrawal.
  state.facts = payosEarnings({
    balance: { ...payosEarnings().balance, processingVnd: 420000 },
    payouts: [
      {
        ...payosPayout,
        status: 'UNKNOWN',
        failureCode: 'PAYOUT_RECONCILIATION_OVERDUE',
        reconciliationStatus: 'NEEDS_REVIEW',
        reviewRequiredAt: payosPayout.requestedAt,
      },
    ],
  })
  await refresh(page)
  await expect(page.getByText('Đang kiểm tra', { exact: true })).toBeVisible()
  await expect(page.getByText(/vẫn được giữ cho bạn/)).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Rút toàn bộ số dư', exact: true }),
  ).toBeDisabled()

  // Provider disabled or not ready: one neutral reason, no internal code.
  state.facts = payosEarnings({
    payoutAvailability: {
      mode: 'PAYOS',
      ready: false,
      reasonCode: 'PAYOUT_CONFIGURATION_UNAVAILABLE',
    },
  })
  await refresh(page)
  await expect(
    page.getByText('Rút tiền tạm thời chưa mở. Vui lòng quay lại sau.'),
  ).toBeVisible()
  await expect(page.getByText(/CONFIGURATION/)).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Rút toàn bộ số dư', exact: true }),
  ).toBeDisabled()

  // Legacy MoMo wallet under PayOS: history only, one primary action to add a bank.
  state.facts = payosEarnings({ destination: payosLegacyMomo })
  await refresh(page)
  await expect(page.getByText('Không dùng để rút')).toBeVisible()
  await expect(page.getByText('Cần thêm tài khoản ngân hàng')).toBeVisible()
  const add = page.getByRole('button', { name: 'Thêm tài khoản ngân hàng' })
  await assertLayout(page, add)

  // Simulated provider: clear notice; historical simulated rows under PayOS do not trigger it.
  state.facts = payosEarnings({
    payoutProvider: 'FAKE',
    payoutAvailability: { mode: 'FAKE', ready: true, reasonCode: null },
  })
  await refresh(page)
  await expect(page.getByText('Chế độ thử nghiệm')).toBeVisible()
  state.facts = payosEarnings({
    payouts: [
      {
        ...payosPayout,
        provider: 'FAKE',
        status: 'SUCCEEDED',
        completedAt: payosPayout.requestedAt,
        reconciliationStatus: 'COMPLETE',
      },
    ],
  })
  await refresh(page)
  await expect(page.getByText('Mô phỏng', { exact: true })).toBeVisible()
  await expect(page.getByText('Chế độ thử nghiệm')).toHaveCount(0)
})

test('a lost response keeps the same key and a not-open answer is a definite refusal', async ({
  page,
}) => {
  test.setTimeout(90000)
  const state = { facts: payosEarnings() }
  const keys: (string | null)[] = []
  let mode: 'lost' | 'ok' | 'closed' = 'lost'
  await openEarnings(page, state, async () => {
    await page.route('**/api/consultation/specialist/payouts', (route) => {
      keys.push(route.request().headers()['idempotency-key'])
      if (mode === 'lost') return route.abort('connectionreset')
      if (mode === 'closed')
        return route.fulfill({
          status: 503,
          json: {
            type: 'about:blank',
            title: 'Unavailable',
            status: 503,
            code: 'REAL_PAYOUT_DISABLED',
            correlationId: 'e2e-correlation',
          },
        })
      state.facts = payosEarnings({
        payouts: [{ ...payosPayout, destinationId: workspaceId(300) }],
      })
      return route.fulfill({ json: state.facts })
    })
  })
  const withdraw = page.getByRole('button', {
    name: 'Rút toàn bộ số dư',
    exact: true,
  })
  await withdraw.click()
  const dialog = page.getByRole('dialog', {
    name: 'Rút toàn bộ số dư khả dụng',
  })
  await dialog.getByRole('button', { name: 'Xác nhận rút tiền' }).click()
  await expect(dialog.getByRole('alert')).toContainText(
    'Chưa nhận được kết quả',
  )
  mode = 'ok'
  await dialog.getByRole('button', { name: 'Kiểm tra lại yêu cầu' }).click()
  await expect(dialog).not.toBeVisible()
  expect(keys).toHaveLength(2)
  expect(keys[1]).toBe(keys[0])

  // A "not open" refusal is definite: no ambiguous recovery button, a new command may use a new key.
  state.facts = payosEarnings()
  mode = 'closed'
  await refresh(page)
  await withdraw.click()
  await dialog.getByRole('button', { name: 'Xác nhận rút tiền' }).click()
  await expect(dialog.getByRole('alert')).toContainText(
    'Rút tiền tạm thời chưa mở',
  )
  await expect(
    dialog.getByRole('button', { name: 'Kiểm tra lại yêu cầu' }),
  ).toHaveCount(0)
})
