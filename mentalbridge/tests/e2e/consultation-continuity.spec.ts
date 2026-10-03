import { expect, type Page } from '@playwright/test'

import { test } from './test-fixtures'

const appointmentId = '123e4567-e89b-42d3-a456-426614174595'

async function loginAsSpecialist(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('specialist@example.com')
  await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/specialist\/dashboard$/)
}

test('MB-595 renders completed-session continuity without fabricated monitoring', async ({
  page,
}) => {
  await page.route('**/api/consultation/specialist/appointments', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: appointmentId,
            slotId: '223e4567-e89b-42d3-a456-426614174595',
            specialistAccountId: '323e4567-e89b-42d3-a456-426614174595',
            specialistDisplayName: 'Chuyên gia Nguyễn An',
            status: 'COMPLETED',
            modality: 'IN_APP_CHAT',
            scheduledStartAt: '2026-10-02T07:00:00Z',
            scheduledEndAt: '2026-10-02T08:00:00Z',
            timezone: 'Asia/Ho_Chi_Minh',
            requestedAt: '2026-09-30T07:00:00Z',
            decisionDeadlineAt: '2026-10-01T07:00:00Z',
            heldCreditId: '423e4567-e89b-42d3-a456-426614174595',
            replacesAppointmentId: null,
            replacedByAppointmentId: null,
            decidedAt: '2026-10-01T06:00:00Z',
            decisionReason: 'SPECIALIST_ACCEPTED',
            cancelledAt: null,
            cancellationReason: null,
            cancellationActor: null,
            cancellationCreditOutcome: null,
            sessionOutcome: 'COMPLETED',
            sessionOutcomeReason: 'EVIDENCE_REQUIREMENTS_MET',
            sessionPolicyVersion: 'chat-session-completion-v1',
            sessionEndedAt: '2026-10-02T08:00:00Z',
            sessionSettledAt: '2026-10-02T08:01:00Z',
            completionFactId: '523e4567-e89b-42d3-a456-426614174595',
            creditState: 'CONSUMED',
            history: [],
            version: 3,
          },
        ],
        count: 1,
        generatedAt: '2026-10-03T02:00:00Z',
      }),
    }),
  )
  await page.route(
    `**/api/consultation/specialist/appointments/${appointmentId}/session-summaries`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: '623e4567-e89b-42d3-a456-426614174595',
              appointmentId,
              userAccountId: '723e4567-e89b-42d3-a456-426614174595',
              specialistAccountId: '323e4567-e89b-42d3-a456-426614174595',
              version: 1,
              schemaVersion: 'session-summary-v1',
              topicsDiscussed: ['Giấc ngủ', 'Nhịp sinh hoạt'],
              progressSummary:
                'Đã cùng nhìn lại những thay đổi trong nhịp ngủ và chọn một bước nhỏ có thể duy trì.',
              specialistNoteForUser:
                'Duy trì giờ thức dậy đã thống nhất và ghi lại điều bạn nhận thấy.',
              followUpSuggested: true,
              amendsSummaryId: null,
              publishedAt: '2026-10-02T08:10:00Z',
              reuseConsent: null,
              agreedNextSteps: [
                {
                  id: '823e4567-e89b-42d3-a456-426614174595',
                  type: 'JOURNAL',
                  title: 'Ghi lại giờ ngủ trong ba ngày',
                  details: 'Ghi ngắn gọn sau khi thức dậy.',
                  resourceId: null,
                  resourceVersion: null,
                  resourceProposalReasonCode: null,
                  state: null,
                  hidden: false,
                  stateVersion: null,
                  stateUpdatedAt: null,
                },
              ],
            },
          ],
          count: 1,
          generatedAt: '2026-10-03T02:00:00Z',
        }),
      }),
  )

  await loginAsSpecialist(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/specialist/follow-up')

  await expect(
    page.getByRole('heading', {
      name: 'Nội dung đã thống nhất sau phiên',
    }),
  ).toBeVisible()
  await expect(page.getByText('Ghi lại giờ ngủ trong ba ngày')).toBeVisible()
  await expect(page.getByText('Đã thống nhất', { exact: true })).toBeVisible()
  await expect(page.getByText(/3\/5|check-in cần xem/i)).toHaveCount(0)
  await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll')
  await expect(page.getByRole('button', { name: 'Mới nhất' })).toHaveCSS(
    'color',
    'rgb(255, 255, 255)',
  )
  await expect(
    page.getByRole('button', { name: 'Mới nhất' }).locator('span'),
  ).toHaveCSS('background-color', 'rgb(30, 74, 67)')
  await expect(
    page.getByText('Đã đề xuất một phiên trao đổi tiếp theo'),
  ).toHaveCSS('color', 'rgb(255, 255, 255)')
  await page.screenshot({
    path: 'docs/evidence/mb-595-continuity-desktop.png',
    fullPage: true,
  })

  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(
    page.getByRole('heading', {
      name: 'Nội dung đã thống nhất sau phiên',
    }),
  ).toBeVisible()
  await page.screenshot({
    path: 'docs/evidence/mb-595-continuity-laptop.png',
    fullPage: true,
  })

  await page.setViewportSize({ width: 768, height: 900 })
  await expect(page.locator('.role-sidebar')).toBeHidden()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)

  await page.setViewportSize({ width: 375, height: 812 })
  await expect(
    page.getByRole('heading', {
      name: 'Nội dung đã thống nhất sau phiên',
    }),
  ).toBeVisible()
  await expect(page.getByText('Ghi lại giờ ngủ trong ba ngày')).toBeVisible()
  await expect(page.locator('.role-sidebar')).toBeHidden()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'docs/evidence/mb-595-continuity-mobile.png',
    fullPage: true,
  })
})
