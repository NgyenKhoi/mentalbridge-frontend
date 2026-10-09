import { expect, type Page } from '@playwright/test'

import { test } from './test-fixtures'

const generatedAt = '2026-10-06T03:00:00Z'
const profile = {
  accountId: 'f5297ec9-bbc9-4d51-8212-62778245335c',
  displayName: 'Chuyên gia An',
  bio: 'Đồng hành sức khỏe tinh thần trên MentalBridge.',
  supportAreas: ['ANXIETY_SYMPTOMS'],
  languages: ['vi'],
  yearsOfExperience: 4,
  timezone: 'Asia/Ho_Chi_Minh',
  approvalStatus: 'APPROVED',
  submittedAt: '2026-10-01T03:00:00Z',
  reviewedAt: '2026-10-02T03:00:00Z',
  reviewedBy: 'synthetic-admin',
  decisionReasonCode: null,
  createdAt: '2026-09-30T03:00:00Z',
  updatedAt: '2026-10-02T03:00:00Z',
  version: 2,
}

const emptySlice = {
  source: 'CONSULTATION',
  asOf: generatedAt,
  state: 'EMPTY',
  count: 0,
  localDate: null,
  timezone: 'Asia/Ho_Chi_Minh',
  items: [],
}

async function loginAsSpecialist(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('specialist@example.com')
  await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/specialist\/dashboard$/)
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/consultation/specialist-profile', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { etag: '"2"' },
      body: JSON.stringify(profile),
    }),
  )
  await page.route('**/api/consultation/specialist/dashboard', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        source: 'CONSULTATION',
        generatedAt,
        operationalStatus: 'READY',
        profile: {
          source: 'CONSULTATION',
          asOf: generatedAt,
          state: 'AVAILABLE',
          displayName: profile.displayName,
          timezone: profile.timezone,
          approvalStatus: profile.approvalStatus,
        },
        ratingAggregate: {
          source: 'CONSULTATION',
          asOf: generatedAt,
          state: 'EMPTY',
          averageRating: null,
          ratingCount: 0,
        },
        todayConfirmedSessions: emptySlice,
        pendingAppointmentRequests: emptySlice,
        nextAppointment: {
          source: 'CONSULTATION',
          asOf: generatedAt,
          state: 'EMPTY',
          item: null,
        },
        availability: {
          source: 'CONSULTATION',
          asOf: generatedAt,
          state: 'EMPTY',
          count: 0,
          items: [],
        },
        actionRequired: [],
      }),
    }),
  )
  await page.route('**/api/consultation/specialist/appointments', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], count: 0, generatedAt }),
    }),
  )
  await page.route('**/api/care/specialist/client-continuity', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], count: 0, generatedAt }),
    }),
  )
  await page.route('**/api/consultation/specialist/earnings', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/problem+json',
      body: JSON.stringify({
        status: 503,
        code: 'DEPENDENCY_UNAVAILABLE',
        title: 'Temporarily unavailable',
      }),
    }),
  )
})

test('MB-620 keeps the specialist portal on authoritative or explicitly deferred paths', async ({
  page,
}) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await loginAsSpecialist(page)

  await expect(
    page.getByRole('heading', { name: 'Chào bạn, Chuyên gia An' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Chào bạn, Chuyên gia An' }),
  ).toHaveCSS('opacity', '1')
  await expect(
    page.getByRole('button', {
      name: 'Mở menu tài khoản chuyên gia',
    }),
  ).toBeVisible()
  const navigation = page.getByRole('navigation', {
    name: 'Điều hướng specialist',
  })
  await expect(navigation.getByRole('link')).toHaveCount(9)
  await expect(
    navigation.getByRole('link', { name: 'Thu nhập & thanh toán' }),
  ).toHaveAttribute('href', '/specialist/earnings')
  await expect(
    navigation.getByRole('link', { name: 'Phân tích vận hành' }),
  ).toHaveAttribute('href', '/specialist/analytics')
  await expect(navigation.getByText(/Earnings|Notifications/)).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: 'Thông báo', exact: true }),
  ).toHaveCount(0)
  await page.screenshot({
    path: 'docs/evidence/mb-620-specialist-portal-desktop.png',
    fullPage: true,
  })

  await navigation.getByRole('link', { name: 'Lịch hẹn' }).click()
  await expect(
    page.getByRole('heading', { name: 'Phản hồi yêu cầu lịch hẹn' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /Tạo lịch hẹn/ })).toHaveCount(
    0,
  )
  await expect(page.getByText(/30 phút|45 phút|90 phút/)).toHaveCount(0)
  await expect(page.getByText(/Điện thoại|Tại phòng tư vấn/)).toHaveCount(0)

  await navigation.getByRole('link', { name: 'Khách hàng' }).click()
  await expect(
    page.getByRole('heading', { name: 'Khách hàng & phiên tư vấn' }),
  ).toBeVisible()
  await expect(
    page.getByText('Chưa có khách hàng trong phạm vi tiếp nối'),
  ).toBeVisible()

  await navigation.getByRole('link', { name: 'Tin nhắn' }).click()
  await expect(page.getByRole('heading', { name: 'Hộp thư' })).toBeVisible()
  await expect(page.getByText('Chưa có cuộc trò chuyện')).toBeVisible()

  await navigation.getByRole('link', { name: 'Sau tư vấn' }).click()
  await expect(
    page.getByRole('heading', { name: 'Nội dung đã thống nhất sau phiên' }),
  ).toBeVisible()
  await expect(
    page.getByText('Chưa có phiên tư vấn đã hoàn thành'),
  ).toBeVisible()

  await page.goto('/specialist/earnings')
  await expect(
    page.getByRole('heading', { name: 'Chưa thể tải thu nhập' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible()
  await expect(page.getByText(/8\.400\.000|6\.800\.000|PayOS/)).toHaveCount(0)

  await page.goto('/specialist/notifications')
  await expect(
    page.getByRole('heading', { name: 'Trung tâm thông báo chưa khả dụng' }),
  ).toBeVisible()
  await expect(page.getByText('Nguyễn Minh Anh')).toHaveCount(0)
  await expect(page.getByText('3', { exact: true })).toHaveCount(0)

  await page.goto('/specialist/prototype-only')
  await expect(page).toHaveURL(/\/specialist\/dashboard$/)

  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(
    page.getByRole('heading', { name: 'Chào bạn, Chuyên gia An' }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Chào bạn, Chuyên gia An' }),
  ).toHaveCSS('opacity', '1')
  await page.screenshot({
    path: 'docs/evidence/mb-620-specialist-portal-laptop.png',
    fullPage: true,
  })

  for (const viewport of [
    { width: 768, height: 900 },
    { width: 375, height: 812 },
  ]) {
    await page.setViewportSize(viewport)
    await expect(page.locator('.role-sidebar')).not.toBeInViewport()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    await page.getByRole('button', { name: 'Mở menu', exact: true }).click()
    const drawer = page.getByRole('dialog', { name: 'Điều hướng chuyên gia' })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByRole('navigation').getByRole('link')).toHaveCount(
      9,
    )
    await expect(
      drawer.getByRole('button', {
        name: 'Mở menu tài khoản chuyên gia',
      }),
    ).toBeVisible()
    await drawer.getByRole('button', { name: 'Đóng menu' }).click()
    await expect(drawer).not.toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Mở menu', exact: true }),
    ).toBeFocused()
    await expect(page.locator('.role-sidebar')).not.toBeInViewport()
  }

  await page.screenshot({
    path: 'docs/evidence/mb-620-specialist-portal-mobile.png',
    fullPage: true,
  })
})
