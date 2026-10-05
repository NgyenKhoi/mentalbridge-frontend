import { expect } from '@playwright/test'
import { test } from './test-fixtures'

const appointmentId = '26000000-0000-4000-8000-000000000001'

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

test('MB-550 saves and reloads the one-email opt-in independently of the digest', async ({
  page,
}) => {
  await authenticate(page)
  let preferences = {
    notificationsEnabled: true,
    channels: { inApp: true, email: true, push: false },
    contentGroups: {
      journalReminder: true,
      emotionCheckIn: true,
      streakMilestone: true,
      screeningReassessment: true,
      appointmentMessage: true,
      resourceSystem: true,
      communityInteraction: true,
    },
    quietHours: {
      enabled: true,
      start: '22:00',
      end: '07:00',
      timeZone: 'Asia/Ho_Chi_Minh',
    },
    email: {
      cadence: 'DAILY_DIGEST',
      wellbeingDigestEnabled: false,
      resourceRemindersEnabled: false,
      appointmentRemindersEnabled: false,
      dailyDigestTime: '19:00',
      resourceReminderTime: '18:30',
    },
    version: 0,
    updatedAt: '2029-01-01T00:00:00.000Z',
  }
  await page.route('**/api/notifications/preferences', async (route) => {
    if (route.request().method() === 'PATCH') {
      expect(route.request().headers()['if-match']).toBe('"0"')
      const patch = route.request().postDataJSON()
      expect(patch.email).toMatchObject({
        appointmentRemindersEnabled: true,
        wellbeingDigestEnabled: false,
        cadence: 'DAILY_DIGEST',
      })
      expect(patch.quietHours).toMatchObject({
        enabled: true,
        timeZone: 'Europe/Paris',
      })
      preferences = { ...preferences, ...patch, version: 1 }
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { ETag: `"${preferences.version}"` },
      body: JSON.stringify(preferences),
    })
  })

  await page.goto('/notifications')
  await page.getByRole('button', { name: /Cài đặt/i }).click()
  await page.getByRole('switch', { name: 'Nhắc lịch hẹn qua email' }).click()
  await page.getByLabel('Múi giờ').selectOption('Europe/Paris')
  await page.getByRole('button', { name: 'Lưu cài đặt' }).click()
  await expect(page.getByText('Đã lưu cài đặt thông báo.')).toBeVisible()
  await expect(
    page.getByText(/Không gộp vào bản tổng hợp hằng ngày/),
  ).toBeVisible()

  await page.reload()
  await page.getByRole('button', { name: /Cài đặt/i }).click()
  await expect(
    page.getByRole('switch', { name: 'Nhắc lịch hẹn qua email' }),
  ).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByLabel('Múi giờ')).toHaveValue('Europe/Paris')
})

test('MB-550 email entry path opens only an owned appointment', async ({
  page,
}) => {
  await authenticate(page)
  await page.route('**/api/consultation/bookable-slots*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [],
        count: 0,
        generatedAt: '2029-01-01T00:00:00.000Z',
        videoEnabled: false,
      }),
    }),
  )
  await page.route('**/api/consultation/appointments', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: appointmentId,
            slotId: '26000000-0000-4000-8000-000000000002',
            specialistAccountId: '26000000-0000-4000-8000-000000000003',
            specialistDisplayName: 'Chuyên gia thử nghiệm',
            status: 'REQUESTED',
            modality: 'IN_APP_CHAT',
            scheduledStartAt: '2030-01-02T03:00:00.000Z',
            scheduledEndAt: '2030-01-02T04:00:00.000Z',
            timezone: 'Asia/Ho_Chi_Minh',
            requestedAt: '2029-01-01T00:00:00.000Z',
            decisionDeadlineAt: '2029-01-02T03:00:00.000Z',
            heldCreditId: '26000000-0000-4000-8000-000000000004',
            replacesAppointmentId: null,
            replacedByAppointmentId: null,
            decidedAt: null,
            decisionReason: null,
            cancelledAt: null,
            cancellationReason: null,
            cancellationActor: null,
            cancellationCreditOutcome: null,
            creditState: 'HELD',
            history: [],
            version: 0,
          },
        ],
        count: 1,
        generatedAt: '2029-01-01T00:00:00.000Z',
      }),
    }),
  )

  await page.goto(`/appointments/${appointmentId}`)
  await expect(page.locator('#appointment-from-reminder')).toContainText(
    'Chuyên gia thử nghiệm',
  )
  await page.goto('/appointments/26000000-0000-4000-8000-000000000099')
  await expect(
    page.getByText(/Không tìm thấy lịch hẹn này trong tài khoản của bạn/),
  ).toBeVisible()
})
