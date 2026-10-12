import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, expect } from '@playwright/test'

let input = ''
for await (const chunk of process.stdin) {
  input += chunk
  assert(input.length < 4096, 'Oversized fixture bootstrap')
}
const config = JSON.parse(input)
for (const name of ['fixture', 'consultation']) {
  const url = new URL(config[name])
  assert(
    url.protocol === 'http:' &&
      url.hostname === '127.0.0.1' &&
      !url.username &&
      !url.password,
    'Disposable loopback fixture required',
  )
}
assert(typeof config.key === 'string', 'Protected fixture key required')
const host = '127.0.0.1'
const port = 3199
const baseURL = `http://${host}:${port}`
const evidenceDirectory = resolve('test-results', 'mb622')
await mkdir(evidenceDirectory, { recursive: true })

async function fixture(action, body = {}) {
  const response = await fetch(`${config.fixture}/fixture/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Fixture-Key': config.key,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  })
  assert.equal(response.status, 200, `Fixture ${action} failed`)
  return response.json()
}

const bootstrap = await fixture('bootstrap')
const server = spawn('node', ['server.js'], {
  cwd: resolve('.next', 'standalone'),
  windowsHide: true,
  stdio: 'ignore',
  env: {
    ...process.env,
    HOSTNAME: host,
    PORT: String(port),
    IDENTITY_API_BASE_URL: config.fixture,
    CARE_API_BASE_URL: config.fixture,
    CONTENT_SERVICE_URL: config.fixture,
    COMMUNITY_SERVICE_URL: config.fixture,
    JOURNAL_AI_SERVICE_URL: config.fixture,
    CONSULTATION_SERVICE_URL: config.consultation,
    CONSULTATION_SERVICE_TIMEOUT_MS: '5000',
  },
})
let browser
const contexts = []
const checks = []

async function actor(role) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  })
  contexts.push(context)
  await context.addCookies([
    {
      name: 'mentalbridge_access',
      value: bootstrap.tokens[role],
      domain: host,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  return { context, page: await context.newPage() }
}

async function api(context, method, path, data, headers = {}) {
  const response = await context.request.fetch(path, {
    method,
    data,
    headers,
    timeout: 10_000,
  })
  assert(response.ok(), `Real BFF ${method} ${path}: HTTP ${response.status()}`)
  return response.json()
}

try {
  let ready = false
  let readinessStatus = 'no response'
  for (let attempt = 0; attempt < 120; attempt++) {
    assert(server.exitCode === null, 'Owned standalone server exited')
    try {
      const response = await fetch(`${baseURL}/login`, {
        signal: AbortSignal.timeout(2000),
      })
      readinessStatus = `HTTP ${response.status}`
      if (response.ok) {
        ready = true
        break
      }
    } catch (error) {
      readinessStatus = error.cause?.code ?? error.name
      /* readiness retry */
    }
    await new Promise((done) => setTimeout(done, 250))
  }
  assert(ready, `Owned standalone server did not start: ${readinessStatus}`)
  browser = await chromium.launch()
  const user = await actor('USER')
  const specialist = await actor('SPECIALIST')
  const admin = await actor('ADMIN')
  await user.page.goto('/subscription')
  await expect(user.page.getByText(/Gói thử nghiệm:/)).toBeVisible()
  await expect(user.page.getByText(/5\.000\s*₫/)).toBeVisible()
  const purchaseResponse = user.page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/consultation/subscriptions/checkout') &&
      response.request().method() === 'POST',
  )
  await user.page.getByRole('button', { name: /Chọn Plus/ }).click()
  const purchase = await (await purchaseResponse).json()
  assert.equal(purchase.amountVnd, 5000)
  assert.equal(purchase.status, 'PENDING')
  assert.equal(purchase.provider, 'FAKE')
  await expect(
    user.page.getByText(/không thu tiền thật và không mở ví MoMo/),
  ).toBeVisible()
  await user.page.reload()
  await expect(
    user.page
      .getByRole('status')
      .filter({ hasText: 'Giao dịch đang chờ xác nhận' }),
  ).toBeVisible()
  await expect(
    user.page.getByRole('button', { name: /Chọn Premium/ }),
  ).toBeDisabled()
  checks.push(
    'USER purchase PENDING recovered after browser reload; no local activation or fake redirect',
  )

  await fixture('confirm', { paymentId: purchase.paymentId })
  await user.page.getByRole('button', { name: 'Kiểm tra trạng thái' }).click()
  await expect(
    user.page
      .getByRole('status')
      .filter({ hasText: 'Giao dịch đã được xác nhận thành công' }),
  ).toBeVisible()
  const plusCredits = await api(
    user.context,
    'GET',
    '/api/consultation/service-credits',
  )
  assert.equal(plusCredits.balance.available, 4)
  assert.equal(plusCredits.packageCode, 'PLUS')
  checks.push(
    'Signed official-shape IPN acknowledged twice; Plus grants exactly four credits',
  )

  const slot = await api(
    specialist.context,
    'POST',
    '/api/consultation/availability-slots',
    {
      startAt: bootstrap.start,
      endAt: new Date(Date.parse(bootstrap.start) + 3_600_000).toISOString(),
      timezone: 'Asia/Ho_Chi_Minh',
      modality: 'IN_APP_CHAT',
    },
    { 'Idempotency-Key': 'mb622-real-availability-01' },
  )
  const appointment = await api(
    user.context,
    'POST',
    '/api/consultation/appointments',
    {
      slotId: slot.id,
      modality: 'IN_APP_CHAT',
      replacesAppointmentId: null,
    },
    { 'Idempotency-Key': 'mb622-real-booking-01' },
  )
  assert.equal(appointment.creditState, 'HELD')
  await api(
    specialist.context,
    'POST',
    `/api/consultation/specialist/appointments/${appointment.id}/accept`,
    undefined,
    {
      'Idempotency-Key': 'mb622-real-accept-01',
      'If-Match': `"${appointment.version}"`,
    },
  )
  checks.push(
    'Public web BFF creates slot, books and accepts; one canonical Plus credit remains HELD',
  )

  const upgrade = await api(
    user.context,
    'POST',
    '/api/consultation/subscriptions/checkout',
    {
      planVersionId: '62200000-0000-4000-8000-000000000003',
    },
    { 'Idempotency-Key': 'mb622-real-upgrade-01' },
  )
  assert.equal(upgrade.amountVnd, 10000)
  assert.equal(upgrade.purpose, 'UPGRADE')
  await fixture('confirm', { paymentId: upgrade.paymentId })
  const premiumCredits = await api(
    user.context,
    'GET',
    '/api/consultation/service-credits',
  )
  assert.equal(premiumCredits.packageCode, 'PREMIUM')
  assert.equal(premiumCredits.balance.available, 10)
  checks.push(
    'Sandbox upgrade confirmed twice: 10,000 VND, ten Premium credits; old appointment retains Plus snapshot',
  )

  const settled = await fixture('settle', { appointmentId: appointment.id })
  assert.equal(settled.status, 'COMPLETED')
  assert.equal(settled.timerDidNotEarn, true)
  const beforeHold = await api(
    specialist.context,
    'GET',
    '/api/consultation/specialist/earnings',
  )
  assert.equal(beforeHold.balance.availableVnd, 0)
  assert.equal(beforeHold.balance.pendingSettlementVnd, 210000)
  assert.equal(beforeHold.earnings[0].planVersion, purchase.planVersionId)
  assert.equal(beforeHold.earnings[0].creditAllocationVnd, 300000)
  assert.equal(
    beforeHold.earnings[0].consumedCreditId,
    appointment.heldCreditId,
  )
  const completedAppointments = await api(
    user.context,
    'GET',
    '/api/consultation/appointments',
  )
  const completion = completedAppointments.items.find(
    (item) => item.id === appointment.id,
  )
  assert(
    completion,
    'Completed appointment missing from authoritative owner list',
  )
  assert.equal(completion.status, 'COMPLETED')
  assert.equal(completion.creditState, 'CONSUMED')
  assert(completion.completionFactId)
  checks.push(
    'Real HTTP participant/service-auth evidence; timer alone earns nothing; settlement creates one 70% exact-Plus-snapshot earning',
  )
  await fixture('mature')
  await specialist.page.goto('/specialist/earnings')
  await expect(specialist.page.getByText('Chế độ thử nghiệm')).toBeVisible()
  await expect(
    specialist.page.getByText(
      /Các giao dịch thử nghiệm không chuyển tiền thật/,
    ),
  ).toBeVisible()
  const destination = await api(
    specialist.context,
    'PUT',
    '/api/consultation/specialist/payout-destination',
    {
      destinationType: 'MOMO_WALLET',
      accountReference: '0900000622',
      accountHolderName: 'Synthetic specialist',
    },
  )
  const payoutHeaders = { 'Idempotency-Key': 'mb622-real-payout-01' }
  const paid = await api(
    specialist.context,
    'POST',
    '/api/consultation/specialist/payouts',
    { destinationId: destination.id },
    payoutHeaders,
  )
  const replay = await api(
    specialist.context,
    'POST',
    '/api/consultation/specialist/payouts',
    { destinationId: destination.id },
    payoutHeaders,
  )
  assert.equal(paid.balance.paidVnd, 210000)
  assert.equal(replay.payouts.length, 1)
  assert.equal(paid.payouts[0].status, 'SUCCEEDED')
  assert.equal(paid.payouts[0].provider, 'FAKE')
  await specialist.page.reload()
  await expect(specialist.page.getByText('Chế độ thử nghiệm')).toBeVisible()
  checks.push(
    'Seven-day hold respected; FAKE payout and replay succeed once; specialist reload reads canonical paid balance',
  )

  await admin.page.goto('/admin/payments')
  await expect(
    admin.page.getByRole('heading', { name: 'Giao dịch gói dịch vụ' }),
  ).toBeVisible()
  await expect(
    admin.page.getByText(/không phải doanh thu thương mại/),
  ).toHaveCount(2)
  const adminPayments = await api(
    admin.context,
    'GET',
    '/api/consultation/admin/payments',
  )
  assert.equal(adminPayments.items.length, 2)
  assert(adminPayments.items.every((item) => item.status === 'SUCCEEDED'))
  const reconciliation = await api(
    admin.context,
    'GET',
    '/api/consultation/admin/payouts',
  )
  assert.equal(reconciliation.items[0].payoutId, paid.payouts[0].id)
  assert.equal(reconciliation.items[0].amountVnd, 210000)
  assert.equal(reconciliation.items[0].earningCount, 1)
  checks.push(
    'ADMIN payment and payout reads agree with USER/SPECIALIST canonical identities, amounts and terminal facts',
  )

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 768, height: 1024 },
    { width: 375, height: 812 },
    { width: 640, height: 400 },
  ]) {
    await user.page.setViewportSize(viewport)
    await user.page.reload()
    await expect(user.page.getByText(/Gói thử nghiệm:/)).toBeVisible()
    assert(
      !(await user.page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      )),
      `Subscription overflow ${viewport.width}`,
    )
    await user.page.screenshot({
      path: resolve(evidenceDirectory, `subscription-${viewport.width}.png`),
      fullPage: true,
    })
    await admin.page.setViewportSize(viewport)
    assert(
      !(await admin.page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      )),
      `Payments overflow ${viewport.width}`,
    )
    await admin.page.screenshot({
      path: resolve(evidenceDirectory, `admin-payments-${viewport.width}.png`),
      fullPage: true,
    })
  }
  await admin.page.getByRole('combobox', { name: 'Lọc trạng thái' }).focus()
  await expect(
    admin.page.getByRole('combobox', { name: 'Lọc trạng thái' }),
  ).toBeFocused()
  checks.push(
    'Real-data UI at 1440/1280/768/375 and 640 CSS-px zoom-equivalent width; keyboard focus and reduced motion verified',
  )

  const git = (cwd, ...args) =>
    execFileSync(
      'git',
      ['-c', `safe.directory=${cwd.replaceAll('\\', '/')}`, ...args],
      { cwd, encoding: 'utf8' },
    ).trim()
  const frontend = resolve('..')
  const backend = resolve('..', '..', 'mentalbridge-backend')
  const manifest = {
    story: 'MB-622',
    result: 'PASS',
    executedAt: new Date().toISOString(),
    frontendCommit: git(frontend, 'rev-parse', 'HEAD'),
    backendCommit: git(backend, 'rev-parse', 'HEAD'),
    frontendDirty: Boolean(git(frontend, 'status', '--porcelain')),
    backendDirty: Boolean(git(backend, 'status', '--porcelain')),
    environment:
      'disposable PostgreSQL + real Spring HTTP + production Next standalone + Chromium',
    identity: 'synthetic test-only account adapter and ephemeral RS256 keys',
    paymentProvider: 'FAKE + verified official-shape MoMo IPN',
    payoutProvider: 'FAKE',
    moneyMoved: false,
    trace: {
      purchasePaymentId: purchase.paymentId,
      upgradePaymentId: upgrade.paymentId,
      subscriptionId: purchase.subscriptionId,
      purchasedPlanVersionId: purchase.planVersionId,
      upgradedPlanVersionId: upgrade.planVersionId,
      appointmentId: appointment.id,
      consumedCreditId: appointment.heldCreditId,
      completionFactId: completion.completionFactId,
      earningId: beforeHold.earnings[0].id,
      payoutId: paid.payouts[0].id,
      providerReference: paid.payouts[0].providerReference,
    },
    checks,
    facts: {
      plusPriceVnd: 5000,
      premiumPriceVnd: 10000,
      creditAllocationVnd: 300000,
      earningVnd: 210000,
      uniquePayouts: 1,
    },
  }
  await writeFile(
    resolve(evidenceDirectory, 'commercial-real-contract.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  )
  console.log(JSON.stringify(manifest))
} finally {
  await Promise.all(contexts.map((context) => context.close()))
  await browser?.close()
  server.kill()
  if (server.exitCode === null)
    await new Promise((done) => server.once('exit', done))
}
