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
  await page.getByRole('button', { name: 'Hủy lịch' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Hủy lịch hẹn này?')).toBeVisible()
  await dialog.getByRole('button', { name: 'Hủy lịch hẹn' }).click()

  await expect(page.getByText('Thông tin hủy lịch')).toBeVisible()
  await expect(page.getByText('Đã được hoàn lại')).toBeVisible()
  await expect(page.getByText('Lý do: bạn yêu cầu hủy')).toBeVisible()
  await page.getByText('Lịch sử thay đổi').click()
  await expect(page.getByText('Đã hủy').last()).toBeVisible()
  await page.screenshot({
    path: 'docs/evidence/mb-380-appointment-changes.png',
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
  await page.getByRole('button', { name: 'Đổi lịch' }).click()
  await expect(page.getByText(/chỉ được hủy khi yêu cầu mới/)).toBeVisible()
  await page.getByRole('button', { name: 'Đổi sang giờ này' }).click()
  await expect.poll(() => listCalls).toBeGreaterThan(1)
})
