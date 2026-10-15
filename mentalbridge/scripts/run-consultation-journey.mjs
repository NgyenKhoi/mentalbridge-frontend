import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium, expect } from '@playwright/test'

let config
try {
  let input = ''
  for await (const chunk of process.stdin) {
    input += chunk
    assert(input.length <= 4096)
  }
  config = JSON.parse(input)
  for (const name of ['fixture', 'consultation']) {
    const url = new URL(config[name])
    assert(
      url.protocol === 'http:' &&
        url.hostname === '127.0.0.1' &&
        url.port &&
        !url.username &&
        !url.password &&
        url.pathname === '/' &&
        !url.search &&
        !url.hash,
    )
  }
  assert(typeof config.key === 'string' && /^[a-f0-9-]{36}$/.test(config.key))
} catch {
  console.error(
    'MB-623 requires a protected disposable loopback fixture configuration on stdin.',
  )
  process.exit(2)
}

const baseURL = 'http://127.0.0.1:3197'
const evidence = resolve('test-results/mb623-consultation')
const checks = []
const contexts = []
const renderErrors = []
let browser
let server
let step = 'startup'

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
  assert.equal(response.status, 200, `Controlled ${action} failed`)
  return response.json()
}

async function api(context, method, path, data, headers = {}, expected = 200) {
  const response = await context.request.fetch(path, {
    method,
    data,
    headers,
    timeout: 15_000,
  })
  assert.equal(
    response.status(),
    expected,
    `${method} ${path.split('/').slice(0, 4).join('/')}: HTTP ${response.status()}`,
  )
  return response.json()
}

async function actor(role, tokens) {
  const context = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
  })
  contexts.push(context)
  await context.addCookies([
    {
      name: 'mentalbridge_access',
      value: tokens[role],
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  const page = await context.newPage()
  page.on('pageerror', (error) => renderErrors.push(error.name))
  return { context, page }
}

async function screenshot(page, name) {
  await page.evaluate(async () => {
    await document.fonts.ready
    scrollTo({ top: 0, behavior: 'instant' })
  })
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    'Page overflows horizontally',
  )
  await page.screenshot({
    path: resolve(evidence, name),
    fullPage: true,
    animations: 'disabled',
  })
}

function revision(directory) {
  const args = ['-C', directory, '-c', `safe.directory=${directory}`]
  return {
    head: execFileSync('git', [...args, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
    }).trim(),
    clean: !execFileSync('git', [...args, 'status', '--porcelain'], {
      encoding: 'utf8',
    }).trim(),
  }
}

try {
  await mkdir(evidence, { recursive: true })
  const bootstrap = await fixture('bootstrap')
  server = spawn(process.execPath, ['.next/standalone/server.js'], {
    windowsHide: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      HOSTNAME: '127.0.0.1',
      PORT: '3197',
      IDENTITY_API_BASE_URL: config.fixture,
      CARE_API_BASE_URL: config.fixture,
      CONTENT_SERVICE_URL: config.fixture,
      COMMUNITY_SERVICE_URL: config.fixture,
      JOURNAL_AI_SERVICE_URL: config.fixture,
      CONSULTATION_SERVICE_URL: config.consultation,
      CONSULTATION_SERVICE_TIMEOUT_MS: '10000',
    },
  })
  await expect
    .poll(
      async () => {
        if (server.exitCode !== null)
          throw new Error('Controlled standalone server exited')
        try {
          return (
            await fetch(`${baseURL}/login`, {
              signal: AbortSignal.timeout(1000),
            })
          ).ok
        } catch {
          return false
        }
      },
      { timeout: 30_000 },
    )
    .toBe(true)
  browser = await chromium.launch({
    channel:
      process.env.PLAYWRIGHT_BROWSER_CHANNEL === 'chrome'
        ? 'chrome'
        : undefined,
  })
  const user = await actor('USER', bootstrap.tokens)
  const specialist = await actor('SPECIALIST', bootstrap.tokens)
  const outsider = await actor('OUTSIDER', bootstrap.tokens)
  const admin = await actor('ADMIN', bootstrap.tokens)
  const publishSlot = async (start, key) =>
    api(
      specialist.context,
      'POST',
      '/api/consultation/availability-slots',
      {
        startAt: start,
        endAt: new Date(Date.parse(start) + 3_600_000).toISOString(),
        timezone: 'Asia/Ho_Chi_Minh',
        modality: 'IN_APP_CHAT',
      },
      { 'Idempotency-Key': key },
      201,
    )
  const bookSlot = async (slot, key) =>
    api(
      user.context,
      'POST',
      '/api/consultation/appointments',
      {
        slotId: slot.id,
        modality: 'IN_APP_CHAT',
      },
      { 'Idempotency-Key': key },
      201,
    )
  const accept = async (booking) =>
    api(
      specialist.context,
      'POST',
      `/api/consultation/specialist/appointments/${booking.id}/accept`,
      undefined,
      {
        'If-Match': `"${booking.version}"`,
        'Idempotency-Key': `mb623-accept-${booking.id}`,
      },
    )

  step = 'approved discovery and browser booking'
  const slot = await publishSlot(bootstrap.start, 'mb623-cross-slot-golden')
  const detail = await api(
    user.context,
    'GET',
    `/api/consultation/specialists/${bootstrap.specialistId}`,
  )
  assert(
    detail.selectableSlots.some(
      (value) => value.id === slot.id && value.modality === 'IN_APP_CHAT',
    ),
  )
  const discovery = await api(
    user.context,
    'GET',
    '/api/consultation/specialists',
  )
  assert.equal(discovery.videoEnabled, false)
  await user.page.goto('/appointments')
  const created = user.page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === '/api/consultation/appointments' &&
      response.request().method() === 'POST',
  )
  await user.page
    .getByRole('button', {
      name: new RegExp(
        `Yêu cầu lịch hẹn với ${bootstrap.specialistDisplayName}`,
      ),
    })
    .click()
  const createdResponse = await created
  assert.equal(createdResponse.status(), 201)
  const booking = await createdResponse.json()
  assert.equal(booking.creditState, 'HELD')
  const replay = await api(
    user.context,
    'POST',
    '/api/consultation/appointments',
    { slotId: slot.id, modality: 'IN_APP_CHAT' },
    {
      'Idempotency-Key': createdResponse.request().headers()['idempotency-key'],
    },
    201,
  )
  assert.equal(replay.id, booking.id)
  checks.push(
    'Approved discovery -> exact 60-minute slot -> actual browser booking -> one persisted HELD credit; same-key BFF replay.',
  )

  step = 'assigned Specialist browser confirmation and dependency truth'
  await specialist.page.goto(
    `/specialist/appointments?appointmentId=${booking.id}`,
  )
  const accepted = specialist.page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith(`/${booking.id}/accept`),
  )
  await specialist.page
    .getByRole('button', { name: 'Xác nhận', exact: true })
    .click()
  assert.equal((await accepted).status(), 200)
  await user.page.reload()
  await expect(
    user.page.getByText('Đã xác nhận', { exact: true }).first(),
  ).toBeVisible()
  const unavailableBrief = await user.context.request.get(
    `/api/care/consultation-briefs/${booking.id}`,
  )
  assert.equal(unavailableBrief.status(), 503)
  await api(
    outsider.context,
    'GET',
    `/api/consultation/appointments/${booking.id}/rating`,
    undefined,
    {},
    404,
  )
  await screenshot(user.page, 'confirmed-1440.png')
  checks.push(
    'Assigned Specialist confirms through UI; reload reads CONFIRMED. Controlled Care outage stays 503, outsider denied, video explicitly disabled.',
  )

  step = 'evidence and timer-only end'
  await fixture('participate', { appointmentId: booking.id })
  await fixture('end', { appointmentId: booking.id })
  const ended = await fixture('snapshot', { appointmentId: booking.id })
  assert.equal(ended.status, 'SESSION_ENDED')
  assert.equal(ended.creditState, 'HELD')
  assert.equal(ended.earningCount, 0)
  await user.page.reload()
  await expect(
    user.page.getByRole('button', { name: 'Đánh giá chuyên gia' }),
  ).toHaveCount(0)
  await fixture('settle', { appointmentId: booking.id })
  const completed = await fixture('snapshot', { appointmentId: booking.id })
  assert.equal(completed.status, 'COMPLETED')
  assert.equal(completed.consumptions, 1)
  assert.equal(completed.earningCount, 1)
  checks.push(
    'Synthetic trusted-producer evidence entered real internal HTTP contract; timer-only end remains HELD/no earning; replayed settlement consumes and earns once.',
  )

  step = 'summary, private next step, rating and authoritative reload'
  const summary = await api(
    specialist.context,
    'POST',
    `/api/consultation/specialist/appointments/${booking.id}/session-summaries`,
    {
      topicsDiscussed: ['Thói quen hằng ngày'],
      progressSummary: 'Nội dung thử nghiệm đã cùng thống nhất.',
      followUpSuggested: true,
      agreedNextSteps: [
        { type: 'JOURNAL', title: 'Viết một ghi chú riêng tư' },
      ],
    },
    { 'Idempotency-Key': 'mb623-cross-summary' },
    201,
  )
  await user.page.goto(`/appointments/${booking.id}`)
  await user.page
    .locator('summary')
    .filter({ hasText: 'Tóm tắt sau phiên' })
    .click()
  await expect(
    user.page.getByText('Viết một ghi chú riêng tư', { exact: true }),
  ).toBeVisible()
  const stepSaved = user.page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith(
        `/${summary.agreedNextSteps[0].id}`,
      ) && response.request().method() === 'PUT',
  )
  await user.page
    .getByLabel('Trạng thái Viết một ghi chú riêng tư')
    .selectOption('COMPLETED')
  assert.equal((await stepSaved).status(), 200)
  await user.page.getByRole('button', { name: 'Đánh giá chuyên gia' }).click()
  await user.page.getByRole('button', { name: '5 sao', exact: true }).click()
  const rated = user.page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname.endsWith(`/${booking.id}/rating`) &&
      response.request().method() === 'PUT',
  )
  await user.page
    .getByRole('button', { name: 'Gửi đánh giá', exact: true })
    .click()
  assert.equal((await rated).status(), 200)
  await user.page.reload()
  await user.page
    .locator('summary')
    .filter({ hasText: 'Tóm tắt sau phiên' })
    .click()
  await expect(
    user.page.getByLabel('Trạng thái Viết một ghi chú riêng tư'),
  ).toHaveValue('COMPLETED')
  const persistedRating = await api(
    user.context,
    'GET',
    `/api/consultation/appointments/${booking.id}/rating`,
  )
  assert.equal(persistedRating.rating, 5)
  assert.equal(persistedRating.specialistAggregate.ratingCount, 1)
  const privateState = await api(
    specialist.context,
    'GET',
    `/api/consultation/specialist/appointments/${booking.id}/session-summaries`,
  )
  assert.equal(privateState.items[0].reuseConsent, null)
  assert.equal(privateState.items[0].agreedNextSteps[0].state, null)
  await screenshot(user.page, 'completed-1440.png')
  await user.page.setViewportSize({ width: 375, height: 812 })
  await screenshot(user.page, 'completed-375.png')
  checks.push(
    'Real summary persisted; USER changes a private next step and submits rating through UI; reload preserves both; Specialist response excludes mutable user state/consent.',
  )

  async function verifyExceptionBranches() {
    step = 'cancel and no-show BFF branches'
    const cancelSlot = await publishSlot(
      new Date(Date.parse(bootstrap.start) + 3 * 86_400_000).toISOString(),
      'mb623-cross-cancel-slot',
    )
    const cancelled = await bookSlot(cancelSlot, 'mb623-cross-cancel-book')
    const confirmed = await accept(cancelled)
    const cancellationHeaders = {
      'If-Match': `"${confirmed.version}"`,
      'Idempotency-Key': 'mb623-cross-cancel-command',
    }
    for (let replay = 0; replay < 2; replay++) {
      const result = await api(
        user.context,
        'POST',
        `/api/consultation/appointments/${cancelled.id}/cancel`,
        undefined,
        cancellationHeaders,
      )
      assert.equal(result.creditState, 'AVAILABLE')
    }
    assert.equal(
      (await fixture('snapshot', { appointmentId: cancelled.id })).releases,
      1,
    )
    const noShowSlot = await publishSlot(
      new Date(Date.parse(bootstrap.start) + 4 * 86_400_000).toISOString(),
      'mb623-cross-noshow-slot',
    )
    const noShow = await bookSlot(noShowSlot, 'mb623-cross-noshow-book')
    await accept(noShow)
    await fixture('user-only', { appointmentId: noShow.id })
    await fixture('end', { appointmentId: noShow.id })
    await fixture('settle', { appointmentId: noShow.id })
    const absent = await fixture('snapshot', { appointmentId: noShow.id })
    assert.equal(absent.outcome, 'SPECIALIST_NO_SHOW')
    assert.equal(absent.creditState, 'AVAILABLE')
    assert.equal(absent.earningCount, 0)
    const ownerHistory = await api(
      user.context,
      'GET',
      '/api/consultation/appointments',
    )
    assert.equal(
      ownerHistory.items.find((value) => value.id === noShow.id).sessionOutcome,
      'SPECIALIST_NO_SHOW',
    )
    checks.push(
      'Confirmed early cancellation + replay releases once; server-evidence specialist no-show releases once and never earns; owner BFF parses actual settled history.',
    )
  }

  step = 'bounded dispute and adjustment'
  const dispute = await api(
    user.context,
    'POST',
    `/api/consultation/appointments/${booking.id}/dispute`,
    { reasonCode: 'OUTCOME_INCORRECT' },
    { 'Idempotency-Key': 'mb623-cross-dispute' },
  )
  assert.equal(dispute.settlementGated, true)
  for (let replay = 0; replay < 2; replay++)
    await api(
      admin.context,
      'POST',
      `/api/consultation/admin/appointment-disputes/${dispute.id}/resolve`,
      {
        outcome: 'RELEASE_USER_CREDIT',
        reasonCode: 'TECHNICAL_FAILURE_CONFIRMED',
      },
      {
        'If-Match': `"${dispute.version}"`,
        'Idempotency-Key': 'mb623-cross-dispute-resolve',
      },
    )
  const adjusted = await fixture('snapshot', { appointmentId: booking.id })
  assert.equal(adjusted.adjustments, 1)
  assert.equal(adjusted.consumptions, 1)
  assert.equal(adjusted.completionFactPresent, true)
  const afterAdjustment = await api(
    user.context,
    'GET',
    '/api/consultation/appointments',
  )
  assert.equal(
    afterAdjustment.items.find((value) => value.id === booking.id).creditState,
    'AVAILABLE',
  )
  checks.push(
    'Participant dispute gates settlement; ADMIN exact-version resolution/replay appends one credit adjustment while immutable completion and consumption remain historical.',
  )
  await verifyExceptionBranches()

  assert.equal(renderErrors.length, 0, 'Browser render exception')
  await writeFile(
    resolve(evidence, 'manifest.json'),
    JSON.stringify(
      {
        task: 'MB-623',
        stateMap: 'consultation-journey-v1',
        executedAt: new Date().toISOString(),
        evidenceClass: 'service-integration-with-production-browser',
        frontend: revision(resolve('..')),
        backend: revision(config.backend),
        consultation:
          'real Spring HTTP + disposable PostgreSQL + real owner migrations',
        identity:
          'synthetic signed JWT/current-account fixture, not Identity-login E2E',
        chatEvidence:
          'synthetic trusted producer through real HTTP, not live Realtime/WebSocket',
        care: 'controlled dependency-unavailable fixture; real Care owner integration verified separately',
        video: 'capability-disabled; no Cloud call or Android claim',
        checks,
      },
      null,
      2,
    ),
  )
  console.log(
    `PASS MB-623: ${checks.length} consultation journey checks; sanitized evidence: test-results/mb623-consultation.`,
  )
} catch (error) {
  const location =
    error instanceof Error
      ? error.stack?.match(/run-consultation-journey\.mjs:(\d+):\d+/)?.[1]
      : undefined
  for (const [index, context] of contexts.entries()) {
    const page = context.pages()[0]
    if (page)
      await page
        .screenshot({
          path: resolve(evidence, `failure-${index}.png`),
          fullPage: true,
        })
        .catch(() => {})
  }
  console.error(
    `FAIL MB-623 at ${step}, runner line ${location ?? 'unknown'}: ${error instanceof Error ? error.name : 'UnknownError'}. No request bodies or credentials retained.`,
  )
  process.exitCode = 1
} finally {
  for (const context of contexts) await context.close()
  await browser?.close()
  if (server && server.exitCode === null) server.kill()
}
