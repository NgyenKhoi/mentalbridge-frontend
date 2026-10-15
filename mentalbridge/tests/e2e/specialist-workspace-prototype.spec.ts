import { expect, type Page, type TestInfo } from '@playwright/test'
import type {
  SpecialistDashboard,
  SpecialistEarnings,
} from '@/lib/consultation/consultation-validation'
import { approvedProfile } from '../fixtures/profile-amendment'
import {
  workspaceAppointment,
  workspaceDashboard,
  workspaceEarnings,
  workspaceId,
  workspaceTime,
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
async function capture(
  page: Page,
  info: TestInfo,
  name: string,
  journey: string,
) {
  if (!(await page.getByRole('dialog').isVisible())) {
    const dismiss = page.getByRole('button', {
      name: 'Đóng thông báo',
      exact: true,
    })
    while (await dismiss.count())
      await dismiss
        .first()
        .click({ timeout: 1500 })
        .catch(() => {})
  }
  await page.mouse.move(0, 0)
  await page.evaluate(() => document.fonts.ready)
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true)
  expect(
    await page
      .locator('[data-specialist-journey="' + journey + '"]')
      .innerText(),
  ).not.toMatch(
    /\uFFFD|Ã[\u0080-\u00BF]|Ä[\u0080-\u00BF]|Æ[\u0080-\u00BF]|á[º»]/,
  )
  const path = info.outputPath(name + '.png')
  await page.screenshot({
    path,
    fullPage: !(await page.getByRole('dialog').isVisible()),
    animations: 'disabled',
  })
  await info.attach(name, { path, contentType: 'image/png' })
}

test('overview real projections, context navigation, mobile menu and recovery states', async ({
  page,
}, info) => {
  test.setTimeout(90000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  let facts: SpecialistDashboard = structuredClone(workspaceDashboard)
  let failure = 0
  await page.route('**/api/consultation/specialist/dashboard', (route) =>
    failure
      ? route.fulfill({
          status: failure,
          json: {
            title: 'Temporarily unavailable',
            status: failure,
            code: failure === 403 ? 'FORBIDDEN' : 'SERVICE_UNAVAILABLE',
          },
        })
      : route.fulfill({ json: facts }),
  )
  await page.route('**/api/consultation/specialist/appointments', (route) =>
    route.fulfill({
      json: {
        items: [
          workspaceAppointment(1, 'REQUESTED'),
          workspaceAppointment(2, 'CONFIRMED'),
        ],
        count: 2,
        generatedAt: workspaceTime,
      },
    }),
  )
  await enter(page)
  await expect(page.getByRole('link', { name: 'Mở tin nhắn' })).toHaveAttribute(
    'href',
    '/specialist/messages?appointmentId=' + workspaceId(2),
  )
  await expect(
    page.getByRole('link', { name: 'Chuẩn bị cho phiên' }),
  ).toHaveAttribute(
    'href',
    '/specialist/clients?appointmentId=' + workspaceId(2),
  )
  await expect(
    page.getByRole('link', { name: 'Xem yêu cầu', exact: true }),
  ).toHaveAttribute(
    'href',
    '/specialist/appointments?appointmentId=' + workspaceId(1),
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  const overview = page.locator('[data-specialist-journey="overview"]')
  const nextSession = page.getByRole('region', { name: 'Phiên hẹn tiếp theo' })
  const artwork = nextSession.locator('[data-overview-artwork]')
  const canvas = artwork.locator('canvas')
  await expect(artwork).toHaveAttribute('data-overview-artwork', '3d')
  expect(
    await canvas.evaluate(
      (node) => !!(node as HTMLCanvasElement).getContext('webgl2'),
    ),
  ).toBe(true)
  expect(
    (await page.getByRole('link', { name: 'Mở tin nhắn' }).boundingBox())!.y,
  ).toBeLessThan(800)
  const sessionTime = nextSession.getByRole('link', {
    name: /Mở phiên tiếp theo/,
  })
  const stableText = await sessionTime.boundingBox()
  const artworkBounds = (await artwork.boundingBox())!
  await page.mouse.move(
    artworkBounds.x + artworkBounds.width * 0.85,
    artworkBounds.y + artworkBounds.height * 0.2,
  )
  await expect
    .poll(() =>
      canvas
        .getAttribute('data-scene-yaw')
        .then((value) => Math.abs(Number(value))),
    )
    .toBeGreaterThan(0.01)
  expect((await sessionTime.boundingBox())!.x).toBeCloseTo(stableText!.x, 1)
  expect((await sessionTime.boundingBox())!.y).toBeCloseTo(stableText!.y, 1)
  const playArtwork = page.getByRole('button', { name: 'Xoay minh hoạ 3D' })
  await playArtwork.focus()
  await page.keyboard.press('Enter')
  await expect(canvas).toHaveAttribute('data-scene-phase', 'playing')
  await expect(canvas).toHaveAttribute('data-scene-phase', 'idle', {
    timeout: 3000,
  })
  await page.mouse.move(0, 0)
  await expect
    .poll(() =>
      canvas
        .getAttribute('data-scene-yaw')
        .then((value) => Math.abs(Number(value))),
    )
    .toBeLessThan(0.001)
  await playArtwork.dispatchEvent('pointermove', {
    pointerType: 'touch',
    clientX: artworkBounds.x,
    clientY: artworkBounds.y,
  })
  expect(
    Math.abs(Number(await canvas.getAttribute('data-scene-yaw'))),
  ).toBeLessThan(0.001)
  await capture(page, info, 'overview-00-interactive-3d', 'overview')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(artwork).toHaveAttribute('data-overview-artwork', 'image')
  await expect(playArtwork).toBeDisabled()
  await expect(artwork.locator('img')).toBeVisible()
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect(artwork).toHaveAttribute('data-overview-artwork', '3d')
  await expect(overview).not.toContainText(/HIPAA|PHI|đã chuẩn bị|70%/)
  for (const width of [1440, 1280, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 })
    await capture(page, info, 'overview-01-ready-' + width, 'overview')
    const actions = page.locator('[data-specialist-journey="overview"] button')
    for (const button of await actions.all())
      expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44)
    for (const link of await overview.locator('a').all())
      expect((await link.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  }
  await page.getByRole('button', { name: 'Mở menu' }).click()
  const menu = page.getByRole('dialog', { name: 'Điều hướng chuyên gia' })
  await expect(menu).toBeVisible()
  for (let n = 0; n < 15; n++) {
    await page.keyboard.press('Tab')
    expect(await menu.evaluate((e) => e.contains(document.activeElement))).toBe(
      true,
    )
  }
  await capture(page, info, 'overview-02-mobile-menu', 'overview')
  await page.keyboard.press('Escape')
  await expect(menu).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Mở menu' })).toBeFocused()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.getByRole('link', { name: 'Xem yêu cầu', exact: true }).click()
  await expect(page).toHaveURL(new RegExp('appointmentId=' + workspaceId(1)))
  await expect(page.locator('#appointment-' + workspaceId(1))).toBeFocused()
  await page.goto('/specialist/dashboard')
  await expect(page.getByRole('link', { name: 'Mở tin nhắn' })).toBeVisible()
  failure = 503
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(
    page.locator('[data-specialist-journey="overview"]').getByRole('alert'),
  ).toContainText('lần tải thành công gần nhất')
  await expect(page.getByRole('link', { name: 'Mở tin nhắn' })).toBeVisible()
  await capture(page, info, 'overview-03-refresh-error-retained', 'overview')
  failure = 0
  facts = {
    ...facts,
    nextAppointment: { ...facts.nextAppointment, state: 'EMPTY', item: null },
    ratingAggregate: {
      ...facts.ratingAggregate,
      state: 'EMPTY',
      averageRating: null,
      ratingCount: 0,
    },
    pendingAppointmentRequests: {
      ...facts.pendingAppointmentRequests,
      state: 'EMPTY',
      items: [],
      count: 0,
    },
    todayConfirmedSessions: {
      ...facts.todayConfirmedSessions,
      state: 'EMPTY',
      items: [],
      count: 0,
    },
    availability: { ...facts.availability, state: 'UNAVAILABLE', count: 0 },
  }
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByText('Chưa có phiên hẹn tiếp theo')).toBeVisible()
  await expect(
    page.getByText('Chưa có đánh giá', { exact: true }),
  ).toBeVisible()
  await capture(page, info, 'overview-04-empty-and-missing', 'overview')
  facts = { ...facts, operationalStatus: 'PENDING_APPROVAL' }
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Hồ sơ đang được xét duyệt' }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Xem hồ sơ' })).toHaveAttribute(
    'href',
    '/specialist/profile',
  )
  await expect(
    page.getByRole('region', { name: 'Tổng quan nhanh' }),
  ).not.toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Mở tin nhắn' }),
  ).not.toBeVisible()
  await capture(page, info, 'overview-05-pending-profile', 'overview')
  failure = 403
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Chưa thể tải dashboard' }),
  ).toBeVisible()
  await capture(page, info, 'overview-06-access-revoked', 'overview')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  facts = workspaceDashboard
  failure = 0
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByRole('link', { name: 'Mở tin nhắn' })).toBeVisible()
  expect(errors).toEqual([])
})

test('overview stays usable without WebGL and with reduced motion at load', async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    Reflect.deleteProperty(window, 'WebGL2RenderingContext')
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.route('**/api/consultation/specialist/dashboard', (route) =>
    route.fulfill({ json: workspaceDashboard }),
  )
  await page.setViewportSize({ width: 375, height: 900 })
  await enter(page)
  const artwork = page.locator('[data-overview-artwork]')
  await expect(artwork).toHaveAttribute('data-overview-artwork', 'image')
  await expect(artwork.locator('img')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Xoay minh hoạ 3D' }),
  ).toBeDisabled()
  await expect(page.getByRole('link', { name: 'Mở tin nhắn' })).toHaveAttribute(
    'href',
    '/specialist/messages?appointmentId=' + workspaceId(2),
  )
  await capture(page, info, 'overview-07-no-gpu-reduced-motion', 'overview')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect(artwork).toHaveAttribute('data-overview-artwork', 'image')
  await expect(
    page.getByRole('button', { name: 'Xoay minh hoạ 3D' }),
  ).toBeDisabled()
})

test('earnings destination cancel, validation, busy locks, payout replay and responsive states', async ({
  page,
}, info) => {
  test.setTimeout(120000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  let facts: SpecialistEarnings = structuredClone(workspaceEarnings)
  let failure = 0,
    payoutFailure = true,
    payoutDelay = false,
    destinationFailure = false
  const commands: { key: string | null; body: unknown }[] = []
  const destinations: unknown[] = []
  await page.route('**/api/consultation/specialist/earnings', (route) =>
    failure
      ? route.fulfill({
          status: failure,
          json: {
            title: 'Unavailable',
            status: failure,
            code: failure === 403 ? 'FORBIDDEN' : 'SERVICE_UNAVAILABLE',
          },
        })
      : route.fulfill({ json: facts }),
  )
  await page.route(
    '**/api/consultation/specialist/payout-destination',
    async (route) => {
      const body = route.request().postDataJSON()
      destinations.push(body)
      await new Promise((resolve) => setTimeout(resolve, 400))
      if (destinationFailure)
        return route.fulfill({
          status: 503,
          json: {
            title: 'Unavailable',
            status: 503,
            code: 'SERVICE_UNAVAILABLE',
          },
        })
      facts = {
        ...facts,
        destination: {
          ...workspaceEarnings.destination!,
          id: workspaceId(120),
          destinationType: body.destinationType,
          displayHint: '•••• ' + body.accountReference.slice(-4),
        },
      }
      return route.fulfill({ json: facts.destination })
    },
  )
  await page.route('**/api/consultation/specialist/payouts', async (route) => {
    commands.push({
      key: route.request().headers()['idempotency-key'],
      body: route.request().postDataJSON(),
    })
    if (payoutDelay) await new Promise((resolve) => setTimeout(resolve, 600))
    if (payoutFailure)
      return route.fulfill({
        status: 503,
        json: {
          title: 'Unavailable',
          status: 503,
          code: 'SERVICE_UNAVAILABLE',
        },
      })
    facts = {
      ...facts,
      balance: { ...facts.balance, availableVnd: 0, processingVnd: 420000 },
      payouts: [
        {
          id: workspaceId(121),
          destinationId: facts.destination!.id,
          provider: 'FAKE',
          amountVnd: 420000,
          status: 'UNKNOWN',
          requestedAt: workspaceTime,
          completedAt: null,
        },
        ...facts.payouts,
      ],
    }
    return route.fulfill({ json: facts })
  })
  await enter(page)
  await page.goto('/specialist/earnings')
  await expect(
    page.getByRole('heading', { name: 'Số dư khả dụng' }),
  ).toBeVisible()
  for (const width of [1440, 1280, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 })
    await capture(page, info, 'earnings-01-ready-' + width, 'earnings')
  }
  await page.getByRole('button', { name: 'Cập nhật nơi nhận tiền' }).click()
  const destinationDialog = page.getByRole('dialog', {
    name: 'Cập nhật thông tin nhận',
  })
  await expect(destinationDialog).toBeVisible()
  await page.getByRole('button', { name: 'Lưu thông tin nhận' }).click()
  await expect(page.getByLabel('Tên chủ tài khoản hoặc chủ ví')).toBeFocused()
  await page.getByLabel('Tên chủ tài khoản hoặc chủ ví').fill('Nguyễn Thị An')
  await page.getByRole('radio', { name: 'Tài khoản ngân hàng' }).check()
  await page.getByLabel('Mã ngân hàng').fill('VCB')
  await page.getByLabel('Số tài khoản', { exact: true }).fill('12345')
  await page.getByRole('button', { name: 'Lưu thông tin nhận' }).click()
  await expect(page.getByLabel('Số tài khoản', { exact: true })).toBeFocused()
  await capture(
    page,
    info,
    'earnings-02-destination-validation-375',
    'earnings',
  )
  await page.keyboard.press('Escape')
  await expect(destinationDialog).not.toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Cập nhật nơi nhận tiền' }),
  ).toBeFocused()
  await page.getByRole('button', { name: 'Cập nhật nơi nhận tiền' }).click()
  await expect(page.getByLabel('Tên chủ tài khoản hoặc chủ ví')).toHaveValue('')
  await expect(page.getByRole('radio', { name: 'Ví MoMo' })).toBeChecked()
  await page.getByLabel('Tên chủ tài khoản hoặc chủ ví').fill('Nguyễn Thị An')
  await page.getByLabel('Số điện thoại MoMo').fill('0912345678')
  destinationFailure = true
  await page.getByRole('button', { name: 'Lưu thông tin nhận' }).click()
  await expect(page.getByLabel('Tên chủ tài khoản hoặc chủ ví')).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(destinationDialog).toBeVisible()
  await expect(destinationDialog.getByRole('alert')).toBeVisible()
  await expect(page.getByLabel('Tên chủ tài khoản hoặc chủ ví')).toHaveValue(
    'Nguyễn Thị An',
  )
  await capture(page, info, 'earnings-03-save-error-retains-form', 'earnings')
  destinationFailure = false
  await page.getByRole('button', { name: 'Lưu thông tin nhận' }).click()
  await expect(destinationDialog).not.toBeVisible()
  expect(destinations[1]).toEqual({
    destinationType: 'MOMO_WALLET',
    accountReference: '0912345678',
    accountHolderName: 'Nguyễn Thị An',
  })
  await page
    .getByRole('button', { name: 'Rút toàn bộ số dư', exact: true })
    .click()
  const withdraw = page.getByRole('dialog', {
    name: 'Rút toàn bộ số dư khả dụng',
  })
  await expect(withdraw).toBeVisible()
  await expect(withdraw.getByRole('spinbutton')).toHaveCount(0)
  for (let n = 0; n < 8; n++) {
    await page.keyboard.press('Tab')
    expect(
      await withdraw.evaluate((e) => e.contains(document.activeElement)),
    ).toBe(true)
  }
  await capture(page, info, 'earnings-04-withdraw-confirm-375', 'earnings')
  await page.getByRole('button', { name: 'Xác nhận rút tiền' }).click()
  await expect(withdraw.getByRole('alert')).toContainText(
    'Chưa nhận được kết quả',
  )
  await page.getByRole('button', { name: 'Quay lại' }).click()
  await expect(withdraw).not.toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Cập nhật nơi nhận tiền' }),
  ).toBeDisabled()
  await page
    .getByRole('button', { name: 'Kiểm tra lại yêu cầu', exact: true })
    .click()
  payoutFailure = false
  payoutDelay = true
  await withdraw.getByRole('button', { name: 'Kiểm tra lại yêu cầu' }).click()
  await expect(
    withdraw.getByRole('button', { name: 'Quay lại' }),
  ).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(withdraw).toBeVisible()
  await expect(withdraw).not.toBeVisible()
  expect(commands).toHaveLength(2)
  expect(commands[1]).toEqual(commands[0])
  expect(commands[1].body).toEqual({ destinationId: workspaceId(120) })
  await expect(page.getByText('Chưa rõ kết quả', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Rút toàn bộ số dư', exact: true }),
  ).toBeDisabled()
  await capture(page, info, 'earnings-05-unknown-result', 'earnings')
  await page.setViewportSize({ width: 1440, height: 1000 })
  failure = 503
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(
    page.locator('[data-specialist-journey="earnings"]').getByRole('alert'),
  ).toContainText('lần tải thành công gần nhất')
  await capture(page, info, 'earnings-06-refresh-error-retained', 'earnings')
  failure = 0
  facts = {
    ...workspaceEarnings,
    balance: { ...workspaceEarnings.balance, availableVnd: 50000 },
  }
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByText('Số dư chưa đạt mức rút tối thiểu')).toBeVisible()
  await capture(page, info, 'earnings-07-below-minimum', 'earnings')
  facts = {
    ...workspaceEarnings,
    destination: null,
    earnings: [],
    payouts: [],
    balance: {
      availableVnd: 0,
      pendingSettlementVnd: 0,
      processingVnd: 0,
      paidVnd: 0,
    },
  }
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(page.getByText('Chưa có thu nhập được ghi nhận')).toBeVisible()
  await page
    .getByRole('button', { name: 'Thiết lập nơi nhận', exact: true })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Thiết lập thông tin nhận' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await capture(page, info, 'earnings-08-empty-no-destination', 'earnings')
  failure = 403
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Chưa thể tải thu nhập' }),
  ).toBeVisible()
  await capture(page, info, 'earnings-09-access-revoked', 'earnings')
  expect(errors).toEqual([])
})
