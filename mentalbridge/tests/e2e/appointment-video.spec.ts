import { expect } from '@playwright/test'
import { test } from './test-fixtures'
import type { Appointment } from '@/lib/consultation/consultation-validation'

const id = '123e4567-e89b-42d3-a456-426614174003'
const appointment: Appointment = {
  id,
  slotId: '123e4567-e89b-42d3-a456-426614174004',
  specialistAccountId: '10000000-0000-4000-8000-000000000003',
  specialistDisplayName: 'Chuyên gia An',
  status: 'CONFIRMED',
  modality: 'IN_APP_VIDEO',
  scheduledStartAt: '2099-01-03T04:00:00Z',
  scheduledEndAt: '2099-01-03T05:00:00Z',
  timezone: 'Asia/Ho_Chi_Minh',
  requestedAt: '2099-01-01T00:00:00Z',
  decisionDeadlineAt: '2099-01-01T05:00:00Z',
  heldCreditId: '123e4567-e89b-42d3-a456-426614174006',
  replacesAppointmentId: null,
  replacedByAppointmentId: null,
  originatingPlanActionId: null,
  decidedAt: '2099-01-01T01:00:00Z',
  decisionReason: 'SPECIALIST_ACCEPTED',
  cancelledAt: null,
  cancellationReason: null,
  cancellationActor: null,
  cancellationCreditOutcome: null,
  sessionOutcome: null,
  sessionOutcomeReason: null,
  sessionPolicyVersion: null,
  sessionEndedAt: null,
  sessionSettledAt: null,
  completionFactId: null,
  creditState: 'HELD',
  history: [],
  version: 1,
}
for (const role of ['USER', 'SPECIALIST'] as const) {
  test(`${role} appointment routes to a dedicated room and explicitly recovers token failure`, async ({
    page,
  }) => {
    let accesses = 0
    const prefix = role === 'USER' ? '' : '/specialist'
    await page.route(`**/api/consultation${prefix}/appointments`, (route) =>
      route.fulfill({
        json: {
          items: [appointment],
          count: 1,
          generatedAt: '2099-01-03T03:57:00Z',
        },
      }),
    )
    await page.route('**/api/consultation/bookable-slots', (route) =>
      route.fulfill({
        json: {
          items: [],
          count: 0,
          generatedAt: '2099-01-03T03:57:00Z',
          videoEnabled: true,
        },
      }),
    )
    await page.route(
      '**/api/consultation/appointments/*/video-session',
      (route) =>
        route.fulfill({
          json: {
            appointmentId: id,
            phase: 'ACTIVE',
            previewAllowed: true,
            joinAllowed: true,
            startsAt: appointment.scheduledStartAt,
            endsAt: appointment.scheduledEndAt,
            serverTime: '2099-01-03T04:01:00Z',
            version: 1,
            completion: null,
          },
        }),
    )
    await page.route(
      '**/api/consultation/appointments/*/video-access',
      (route) => {
        accesses++
        return route.fulfill({
          status: 503,
          json: {
            status: 503,
            code: 'VIDEO_PROVIDER_UNAVAILABLE',
            title: 'Unavailable',
            detail: 'private-fixture-detail',
          },
        })
      },
    )
    await page.goto('/login')
    await page
      .getByLabel('Email')
      .fill(role === 'USER' ? 'user@example.com' : 'specialist@example.com')
    await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
    await expect(page).toHaveURL(
      role === 'USER' ? /\/dashboard$/ : /\/specialist\/dashboard$/,
    )
    await page.goto(
      role === 'USER'
        ? `/appointments/${id}`
        : `/specialist/appointments?appointmentId=${id}`,
    )
    await expect(
      page.getByRole('button', { name: 'Tham gia phiên tư vấn' }),
    ).toHaveCount(0)
    await page
      .getByRole('link', { name: /Mở phòng tư vấn/ })
      .or(page.getByRole('button', { name: /Mở phòng tư vấn/ }))
      .first()
      .click()
    await expect(page).toHaveURL(
      new RegExp(`${prefix}/appointments/${id}/video$`),
    )
    await expect(
      page.getByRole('heading', { name: 'Phòng tư vấn video', level: 1 }),
    ).toBeAttached()
    await expect(
      page.getByRole('button', { name: 'Tham gia phiên tư vấn' }),
    ).toBeEnabled()
    expect(accesses).toBe(0)
    await page.getByRole('button', { name: 'Tham gia phiên tư vấn' }).click()
    await expect(
      page.getByRole('region', { name: 'Cuộc gọi tư vấn' }).getByRole('alert'),
    ).toContainText('Chưa thể kết nối cuộc gọi')
    expect(accesses).toBe(1)
    await expect(page.getByText('private-fixture-detail')).toHaveCount(0)
    if (role === 'USER')
      await expect(
        page.getByRole('button', { name: 'Xác nhận kết thúc buổi tư vấn' }),
      ).toHaveCount(0)
    await page
      .getByRole('link', { name: 'Trở về lịch hẹn', exact: true })
      .click()
    await expect(page).toHaveURL(
      role === 'USER'
        ? new RegExp(`/appointments/${id}$`)
        : new RegExp(`/specialist/appointments\\?appointmentId=${id}$`),
    )
  })
}
test('dedicated video routes do not expose a call to a logged-out visitor', async ({
  page,
}) => {
  for (const prefix of ['', '/specialist']) {
    await page.goto(`${prefix}/appointments/${id}/video`)
    await expect(page).toHaveURL(/\/login(?:\?|$)/)
    await expect(
      page.getByRole('heading', { name: 'Phòng tư vấn video' }),
    ).toHaveCount(0)
  }
})
