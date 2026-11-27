import { expect, type Page } from '@playwright/test'
import { test } from './test-fixtures'

// FAKE-mode in-app QR checkout (MB-786). The browser-side consultation calls are
// mocked so the countdown, steps and poll transitions are deterministic.
const viewports = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1280', width: 1280, height: 800 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'mobile-375', width: 375, height: 812 },
] as const

const plusId = '62200000-0000-4000-8000-000000000002'
const paymentId = 'aa100000-0000-4000-8000-000000000786'

function plan(
  planVersionId: string,
  planCode: 'FREE' | 'PLUS' | 'PREMIUM',
  priceVnd: number,
) {
  const premium = planCode === 'PREMIUM'
  return {
    planVersionId,
    planCode,
    version: 'sandbox-vnd-2026-10',
    pricingPolicyVersion: 'sandbox-full-price-v1',
    displayName: planCode === 'FREE' ? 'Free' : premium ? 'Premium' : 'Plus',
    currency: 'VND',
    priceVnd,
    billingPeriodMonths: 1,
    consultationCredits: planCode === 'FREE' ? 0 : premium ? 10 : 4,
    maxActiveReservations: planCode === 'FREE' ? 0 : premium ? 4 : 2,
    creditAllocationVnd: 300000,
    aiQuotaCode: `${planCode}_QUOTA`,
    supportPlanEnabled: planCode !== 'FREE',
    entitlements: ['AI_JOURNAL_BASIC'],
    allowedUpgrades: planCode === 'FREE' ? ['PLUS', 'PREMIUM'] : [],
    effectiveFrom: '2026-01-01T00:00:00Z',
  }
}

function payment(expiresInMs: number, extra: Record<string, unknown> = {}) {
  const expires = new Date(Date.now() + expiresInMs).toISOString()
  return {
    paymentId,
    subscriptionId: 'aa100000-0000-4000-8000-000000000787',
    planVersionId: plusId,
    planCode: 'PLUS',
    planVersion: 'sandbox-vnd-2026-10',
    pricingPolicyVersion: 'sandbox-full-price-v1',
    purpose: 'PURCHASE',
    provider: 'FAKE',
    status: 'PENDING',
    terminalReason: null,
    amountVnd: 5000,
    currency: 'VND',
    qrCode:
      '00020101021238540010A00000072701240006970422011000000007860208QRIBFTTA5303704540450005802VN6304A1B2',
    bin: '970422',
    accountNumber: '0000000786',
    accountName: 'MENTALBRIDGE TEST',
    description: 'MB000786',
    amount: 5000,
    expiredAt: expires,
    expiresAt: expires,
    createdAt: new Date().toISOString(),
    paidAt: null,
    failedAt: null,
    ...extra,
  }
}

async function mockConsultation(
  page: Page,
  checkout: Record<string, unknown>,
  poll: (call: number) => Record<string, unknown>,
) {
  let polls = 0
  await page.route('**/api/consultation/service-plans', (route) =>
    route.fulfill({
      json: {
        plans: [
          plan('51500000-0000-4000-8000-000000000001', 'FREE', 0),
          plan(plusId, 'PLUS', 5000),
          plan('62200000-0000-4000-8000-000000000003', 'PREMIUM', 10000),
        ],
        checkoutEnabled: true,
        paymentProvider: 'FAKE',
        generatedAt: new Date().toISOString(),
      },
    }),
  )
  await page.route('**/api/consultation/service-credits', (route) =>
    route.fulfill({
      json: {
        accountId: 'f5297ec9-bbc9-4d51-8212-62778245335c',
        packageCode: 'FREE',
        source: 'DEFAULT_FREE',
        sourceReference: null,
        periodStart: null,
        periodEnd: null,
        policyVersion: 'consultation-credit-v2',
        balance: {
          available: 0,
          held: 0,
          consumed: 0,
          forfeited: 0,
          total: 0,
          releasedTransitions: 0,
        },
        reservationCapacity: { active: 0, maximum: 0, remaining: 0 },
        history: [],
        generatedAt: new Date().toISOString(),
        entitlementState: 'ACTIVE',
        supportPlanEnabled: false,
      },
    }),
  )
  await page.route('**/api/consultation/payments', (route) =>
    route.fulfill({
      json: { items: [], count: 0, generatedAt: new Date().toISOString() },
    }),
  )
  await page.route('**/api/consultation/subscriptions/checkout', (route) =>
    route.fulfill({ json: checkout }),
  )
  await page.route(`**/api/consultation/payments/${paymentId}`, (route) =>
    route.fulfill({ json: poll(++polls) }),
  )
}

async function open(page: Page, viewport: { width: number; height: number }) {
  await page.context().addCookies([
    {
      name: 'mentalbridge_access',
      value: 'synthetic-care-e2e-other-access',
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  await page.setViewportSize(viewport)
  await page.goto('/subscription')
  await page.getByRole('button', { name: 'Chọn Plus' }).click()
}

for (const viewport of viewports) {
  test(`MB-786 shows the in-app QR and reaches success from the poll at ${viewport.name}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(30_000)
    await mockConsultation(page, payment(15 * 60_000), (call) =>
      call < 2
        ? payment(15 * 60_000)
        : payment(15 * 60_000, {
            status: 'SUCCEEDED',
            paidAt: new Date().toISOString(),
          }),
    )
    await open(page, viewport)

    await expect(
      page.getByRole('heading', { name: /Đăng ký Gói Plus · 5\.000đ/ }),
    ).toBeVisible()
    await expect(
      page.getByRole('img', { name: /Mã QR chuyển khoản 5\.000đ/ }),
    ).toBeVisible()
    await expect(page.getByRole('timer')).toHaveAccessibleName(
      /Mã còn hiệu lực/,
    )
    await expect(page.getByText('MENTALBRIDGE TEST')).toBeVisible()
    await expect(
      page.getByRole('listitem').filter({ hasText: 'Chờ ngân hàng' }),
    ).toBeVisible()
    await expect(
      page.getByText('Thanh toán thử (không trừ tiền thật)'),
    ).toBeVisible()
    await expect(page.getByText(/MoMo/)).toHaveCount(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
    ).toBe(false)
    await page.screenshot({
      path: testInfo.outputPath(`payment-waiting-${viewport.name}.png`),
      fullPage: true,
    })

    await expect(
      page.getByRole('heading', { name: 'Đã nhận thanh toán' }),
    ).toBeVisible({ timeout: 12_000 })
    await expect(
      page.getByRole('button', { name: 'Xem quyền lợi gói Plus' }),
    ).toBeVisible()
    await expect(page.getByRole('img', { name: /Mã QR/ })).toHaveCount(0)
  })
}

test('MB-786 replaces the QR with the expired state from the server reason', async ({
  page,
}) => {
  test.setTimeout(30_000)
  await mockConsultation(page, payment(15 * 60_000), () =>
    payment(15 * 60_000, {
      status: 'FAILED',
      terminalReason: 'EXPIRED',
      failedAt: new Date().toISOString(),
    }),
  )
  await open(page, { width: 375, height: 812 })
  await expect(
    page.getByRole('heading', { name: 'Mã thanh toán đã hết hạn' }),
  ).toBeVisible({ timeout: 12_000 })
  await expect(page.getByText('Chưa có khoản nào được ghi nhận.')).toBeVisible()
  await expect(page.getByRole('img', { name: /Mã QR/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Tạo mã mới' })).toBeVisible()
})

test('MB-786 expires the QR when the countdown ends', async ({ page }) => {
  test.setTimeout(30_000)
  await mockConsultation(page, payment(4_000), () => payment(4_000))
  await open(page, { width: 1440, height: 900 })
  await expect(page.getByRole('timer')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Mã thanh toán đã hết hạn' }),
  ).toBeVisible({ timeout: 12_000 })
  await expect(page.getByRole('img', { name: /Mã QR/ })).toHaveCount(0)
})
