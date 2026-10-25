import { expect } from '@playwright/test'
import { test } from './test-fixtures'

const appointmentId = '123e4567-e89b-42d3-a456-426614174003'
const userId = '323e4567-e89b-42d3-a456-426614174003'
const timezone = 'Asia/Ho_Chi_Minh'

const appointment = {
  id: appointmentId,
  slotId: '123e4567-e89b-42d3-a456-426614174004',
  specialistAccountId: '123e4567-e89b-42d3-a456-426614174005',
  specialistDisplayName: 'Chuyên gia Nguyễn An',
  status: 'REQUESTED',
  modality: 'IN_APP_CHAT',
  scheduledStartAt: '2099-01-03T04:00:00Z',
  scheduledEndAt: '2099-01-03T05:00:00Z',
  timezone,
  requestedAt: '2099-01-01T00:00:00Z',
  decisionDeadlineAt: '2099-01-02T04:00:00Z',
  heldCreditId: '123e4567-e89b-42d3-a456-426614174006',
  replacesAppointmentId: null,
  replacedByAppointmentId: null,
  decidedAt: null,
  decisionReason: null,
  cancelledAt: null,
  cancellationReason: null,
  cancellationActor: null,
  cancellationCreditOutcome: null,
  creditState: 'HELD',
  history: [
    {
      eventId: '223e4567-e89b-42d3-a456-426614174003',
      fromStatus: null,
      toStatus: 'REQUESTED',
      actorType: 'USER',
      actorId: userId,
      reason: 'APPOINTMENT_REQUESTED',
      creditOutcome: null,
      occurredAt: '2099-01-01T00:00:00Z',
    },
  ],
  version: 0,
}

const slots = {
  items: [
    {
      id: '123e4567-e89b-42d3-a456-426614174001',
      specialistAccountId: '123e4567-e89b-42d3-a456-426614174002',
      specialistDisplayName: 'Chuyên gia Trần Minh',
      startAt: '2099-01-04T02:00:00Z',
      endAt: '2099-01-04T03:00:00Z',
      timezone,
      modality: 'IN_APP_CHAT',
    },
  ],
  count: 1,
  generatedAt: '2099-01-01T00:00:00Z',
  videoEnabled: false,
}

async function authenticate(page: import('@playwright/test').Page) {
  await page.context().addCookies([
    {
      name: 'mentalbridge_access',
      value: 'synthetic-care-e2e-access',
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
}

test('MB-380 cancels an appointment and renders persisted audit evidence', async ({
  page,
}) => {
  await authenticate(page)
  let current: Record<string, unknown> = appointment
  await page.route('**/api/consultation/bookable-slots*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(slots),
    }),
  )
  await page.route('**/api/consultation/appointments', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [current],
        count: 1,
        generatedAt: '2099-01-01T01:00:01Z',
      }),
    }),
  )
  await page.route(
    '**/api/consultation/appointments/*/cancel',
    async (route) => {
      expect(route.request().headers()['if-match']).toBe('"0"')
      expect(route.request().headers()['idempotency-key']).toMatch(
        /^appointment-cancel-/,
      )
      current = {
        ...appointment,
        status: 'CANCELLED',
        cancelledAt: '2099-01-01T01:00:00Z',
        cancellationReason: 'USER_CANCELLED',
        cancellationActor: 'USER',
        cancellationCreditOutcome: 'RELEASED',
        creditState: 'AVAILABLE',
        history: [
          ...appointment.history,
          {
            eventId: '423e4567-e89b-42d3-a456-426614174003',
            fromStatus: 'REQUESTED',
            toStatus: 'CANCELLED',
            actorType: 'USER',
            actorId: userId,
            reason: 'USER_CANCELLED',
            creditOutcome: 'RELEASED',
            occurredAt: '2099-01-01T01:00:00Z',
          },
        ],
        version: 1,
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { ETag: '"1"' },
        body: JSON.stringify(current),
      })
    },
  )

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/appointments')
  await expect(
    page.getByRole('button', {
      name: /Xem chi tiết lịch hẹn với Chuyên gia Nguyễn An/,
    }),
  ).toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Cuộc hẹn kế tiếp' }),
  ).toBeVisible()
  await page.screenshot({
    path: 'docs/evidence/appointments-overview-redesign.png',
    fullPage: true,
  })
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 375, height: 812 },
    { width: 640, height: 400 },
  ]) {
    await page.setViewportSize(viewport)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(viewport.width)
  }
  await page.setViewportSize({ width: 1280, height: 900 })
  await page
    .getByRole('button', {
      name: /Xem chi tiết lịch hẹn với Chuyên gia Nguyễn An/,
    })
    .click()
  await expect(
    page.getByRole('dialog', { name: 'Chi tiết lịch hẹn' }),
  ).toBeVisible()
  await page
    .getByRole('dialog', { name: 'Chi tiết lịch hẹn' })
    .getByRole('button', { name: 'Hủy lịch' })
    .click()
  const dialog = page.getByRole('dialog', { name: 'Hủy lịch hẹn này?' })
  await dialog.getByRole('button', { name: 'Hủy lịch hẹn' }).click()

  await page
    .getByRole('button', {
      name: /Xem chi tiết lịch hẹn với Chuyên gia Nguyễn An/,
    })
    .click()
  const detail = page.getByRole('dialog', { name: 'Chi tiết lịch hẹn' })
  await expect(detail.getByText('Thông tin hủy lịch')).toBeVisible()
  await expect(
    detail.getByText('Đã được hoàn lại', { exact: true }),
  ).toBeVisible()
  await expect(detail.getByText('Lý do: bạn yêu cầu hủy')).toBeVisible()
  await detail.getByText('Lịch sử thay đổi').click()
  await expect(detail.getByText('Đã hủy').last()).toBeVisible()
  await page.screenshot({
    path: 'docs/evidence/mb-380-appointment-changes.png',
    fullPage: true,
  })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.waitForTimeout(400)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    375,
  )
  await page.screenshot({
    path: 'docs/evidence/appointments-detail-mobile-redesign.png',
    fullPage: true,
  })
})

test('MB-380 reschedule carries the old appointment identity and version', async ({
  page,
}) => {
  await authenticate(page)
  await page.route('**/api/consultation/bookable-slots*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(slots),
    }),
  )
  let listCalls = 0
  await page.route('**/api/consultation/appointments', async (route) => {
    if (route.request().method() === 'POST') {
      expect(route.request().headers()['if-match']).toBe('"0"')
      expect(await route.request().postDataJSON()).toMatchObject({
        slotId: slots.items[0].id,
        replacesAppointmentId: appointmentId,
      })
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ...appointment,
          id: '523e4567-e89b-42d3-a456-426614174003',
          slotId: slots.items[0].id,
          replacesAppointmentId: appointmentId,
        }),
      })
      return
    }
    listCalls += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [appointment],
        count: 1,
        generatedAt: '2099-01-01T01:00:01Z',
      }),
    })
  })

  await page.goto('/appointments')
  await page.getByRole('button', { name: '+ Đặt lịch mới' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Chọn khung giờ tư vấn' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Đóng chọn khung giờ' }).click()
  await page
    .getByRole('button', {
      name: /Xem chi tiết lịch hẹn với Chuyên gia Nguyễn An/,
    })
    .click()
  await page
    .getByRole('dialog', { name: 'Chi tiết lịch hẹn' })
    .getByRole('button', { name: 'Đổi lịch' })
    .click()
  await expect(page.getByText(/chỉ được hủy khi yêu cầu mới/)).toBeVisible()
  const booking = page.getByRole('dialog', { name: 'Chọn thời gian mới' })
  await booking.getByRole('button', { name: /Chuyên gia Trần Minh/ }).click()
  await booking.getByRole('button', { name: 'Gửi yêu cầu đổi lịch' }).click()
  await expect.poll(() => listCalls).toBeGreaterThan(1)
})

test('MB-716 keeps the saved credit transfer and replacement link on a rescheduled original', async ({
  page,
}) => {
  await authenticate(page)
  const replacementId = '523e4567-e89b-42d3-a456-426614174003'
  const original = {
    ...appointment,
    status: 'CANCELLED',
    cancelledAt: '2099-01-01T01:00:00Z',
    cancellationReason: 'USER_RESCHEDULED',
    cancellationActor: 'USER',
    cancellationCreditOutcome: 'TRANSFERRED_TO_REPLACEMENT',
    replacedByAppointmentId: replacementId,
    version: 1,
  }
  const replacement = {
    ...appointment,
    id: replacementId,
    slotId: '123e4567-e89b-42d3-a456-426614174001',
    scheduledStartAt: '2099-01-04T02:00:00Z',
    scheduledEndAt: '2099-01-04T03:00:00Z',
    replacesAppointmentId: appointmentId,
  }
  await page.route('**/api/consultation/bookable-slots*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(slots),
    }),
  )
  await page.route('**/api/consultation/appointments', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [original, replacement],
        count: 2,
        generatedAt: '2099-01-01T01:00:01Z',
      }),
    }),
  )

  await page.goto(`/appointments/${appointmentId}`)
  const info = page.getByRole('region', { name: 'Thông tin hủy lịch' })
  await expect(
    info.getByText('Lượt tư vấn đã chuyển sang lịch mới'),
  ).toBeVisible()
  await expect(info.getByText(/^Đã đổi sang /)).toBeVisible()
  await expect(info.getByText('Lý do: bạn đã đổi lịch')).toBeVisible()
})

test('MB-716 blocks a second cancel while the authoritative reload is pending', async ({
  page,
}) => {
  await authenticate(page)
  let cancelling = false
  let reloadsDuringCancel = 0
  let releaseReload: () => void = () => {}
  const reloadGate = new Promise<void>((resolve) => (releaseReload = resolve))
  await page.route('**/api/consultation/bookable-slots*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(slots),
    }),
  )
  await page.route('**/api/consultation/appointments', async (route) => {
    const duringCancel = cancelling
    if (duringCancel) {
      reloadsDuringCancel += 1
      await reloadGate
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          duringCancel ? { ...appointment, status: 'EXPIRED' } : appointment,
        ],
        count: 1,
        generatedAt: '2099-01-01T01:00:01Z',
      }),
    })
  })

  await page.goto(`/appointments/${appointmentId}`)
  const cancel = page.getByRole('button', { name: 'Hủy lịch' })
  await expect(cancel).toBeEnabled()
  // Let page-load reads settle so only the cancel's own reload is gated and counted.
  await page.waitForLoadState('networkidle')
  cancelling = true
  await cancel.click()
  await expect(cancel).toHaveAttribute('aria-disabled', 'true')
  await expect(cancel).toHaveAttribute('aria-busy', 'true')
  await expect(cancel).toBeFocused()
  await expect(page.getByRole('button', { name: 'Đổi lịch' })).toHaveAttribute(
    'aria-disabled',
    'true',
  )
  await page.waitForTimeout(300)
  const reloadsBeforeSecondClick = reloadsDuringCancel
  // Playwright treats aria-disabled as disabled and would wait; dispatch the click a user can still make.
  await cancel.dispatchEvent('click')
  await page.waitForTimeout(300)
  expect(reloadsDuringCancel).toBe(reloadsBeforeSecondClick)
  releaseReload()
  await expect(
    page
      .getByText('Lịch hẹn vừa được cập nhật và không còn có thể hủy.', {
        exact: false,
      })
      .first(),
  ).toBeVisible()
  expect(reloadsDuringCancel).toBe(reloadsBeforeSecondClick)
})
