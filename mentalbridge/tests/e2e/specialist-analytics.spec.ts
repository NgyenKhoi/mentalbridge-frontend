import { expect, type Page, type TestInfo } from '@playwright/test'
import type { SpecialistOperationalAnalytics as Analytics } from '@/lib/consultation/consultation-validation'
import { approvedProfile } from '../fixtures/profile-amendment'
import {
  blockedAnalytics,
  emptyAnalytics,
  readyAnalytics,
} from '../fixtures/specialist-analytics'
import { test } from './test-fixtures'

async function enterAnalytics(page: Page) {
  await page.route('**/api/consultation/specialist-profile', (route) =>
    route.fulfill({ json: approvedProfile, headers: { etag: '"2"' } }),
  )
  await page.goto('/login')
  await page.getByLabel('Email').fill('specialist@example.com')
  await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/specialist\/dashboard$/)
  await page.goto('/specialist/analytics')
  await expect(
    page.getByRole('heading', { name: 'Phân tích vận hành chuyên gia' }),
  ).toBeVisible()
}
async function capture(page: Page, info: TestInfo, name: string) {
  for (const dismiss of await page
    .getByRole('button', { name: 'Đóng thông báo', exact: true })
    .all()) {
    await dismiss.click()
  }
  await page.mouse.move(0, 0)
  await page.evaluate(() => document.fonts.ready)
  const path = info.outputPath(`${name}.png`)
  await page.screenshot({ path, fullPage: true, animations: 'disabled' })
  await info.attach(name, { path, contentType: 'image/png' })
}
async function noOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true)
}

test('analytics prototype interactions, meaningful details, responsive layout and reduced motion', async ({
  page,
}, info) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  let facts: Analytics = readyAnalytics
  await page.route('**/api/consultation/specialist/analytics?**', (route) => {
    const days = new URL(route.request().url()).searchParams.get('days')
    return route.fulfill({
      json:
        days === '7'
          ? {
              ...facts,
              period: { ...facts.period, from: '2026-09-29T01:00:00Z' },
              availability: {
                ...facts.availability,
                publishedSlotCount: 2,
                utilizedSlotCount: 1,
                unusedSlotCount: 1,
                utilizationRate: 50,
              },
            }
          : facts,
    })
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await enterAnalytics(page)
  await expect(page.getByText('75%', { exact: true })).toBeVisible()
  await noOverflow(page)
  await capture(page, info, 'analytics-ready-1440')

  const capacityCard = page.locator('section').filter({
    has: page.getByRole('heading', {
      name: 'Hiệu suất khai thác lịch tư vấn',
    }),
  })
  await capacityCard.hover()
  await expect
    .poll(() =>
      capacityCard.evaluate(
        (element) =>
          new DOMMatrixReadOnly(getComputedStyle(element).transform).m42,
      ),
    )
    .toBeLessThan(-2)
  const node = page.getByRole('button', {
    name: 'Yêu cầu mới: 18 lượt. Xem chi tiết',
  })
  await node.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Yêu cầu mới' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toContainText('không phải số yêu cầu hiện đang chờ')
  await capture(page, info, 'analytics-lifecycle-detail')
  await page.keyboard.press('Tab')
  await expect
    .poll(() =>
      dialog.evaluate((element) => element.contains(document.activeElement)),
    )
    .toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  await expect(node).toBeFocused()

  await page
    .getByRole('button', { name: 'Xem cách tính tỷ lệ sử dụng lịch' })
    .click()
  await expect(page.getByRole('dialog')).toContainText(
    'không phải số khung giờ trống còn có thể đặt ngay',
  )
  await page.getByRole('button', { name: 'Đã hiểu' }).click()
  await page.getByRole('button', { name: '7 ngày' }).click()
  await expect(page.getByText('50%', { exact: true })).toBeVisible()
  await expect(page.getByText('29/09/2026 – 06/10/2026')).toBeVisible()
  await expect(page.getByText('4,5', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Làm mới số liệu' }).click()
  await expect(page.getByText('Đã cập nhật số liệu vận hành.')).toBeVisible()
  await page.getByRole('button', { name: '30 ngày' }).click()
  await expect(page.getByText('75%', { exact: true })).toBeVisible()

  for (const viewport of [
    { width: 1280, height: 800 },
    { width: 768, height: 900 },
    { width: 375, height: 812 },
    { width: 640, height: 400 },
  ]) {
    await page.setViewportSize(viewport)
    await page.evaluate(() => window.scrollTo(0, 0))
    await noOverflow(page)
    if (viewport.width <= 980) {
      await expect
        .poll(() =>
          page
            .locator('.role-main')
            .evaluate((element) =>
              Math.abs(element.getBoundingClientRect().left),
            ),
        )
        .toBeLessThan(1)
      await expect
        .poll(() =>
          page
            .locator('.role-sidebar')
            .evaluate((element) => element.getBoundingClientRect().right),
        )
        .toBeLessThan(1)
      await page.getByRole('button', { name: 'Mở menu', exact: true }).click()
      const navigation = page.getByRole('dialog', {
        name: 'Điều hướng chuyên gia',
      })
      await expect(navigation).toBeVisible()
      await expect(navigation).toBeInViewport()
      await expect(
        navigation.getByRole('link', { name: 'Phân tích vận hành' }),
      ).toHaveAttribute('aria-current', 'page')
      await navigation.getByRole('button', { name: 'Đóng menu' }).click()
      await expect(navigation).not.toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Mở menu', exact: true }),
      ).toBeFocused()
      await expect(page.locator('.role-sidebar')).not.toBeInViewport()
    }
    await capture(page, info, `analytics-ready-${viewport.width}`)
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await capacityCard.hover()
  await expect(capacityCard).toHaveCSS('transform', 'none')
  await page.getByRole('button', { name: '7 ngày' }).click()
  await expect(page.getByText('50%', { exact: true })).toBeVisible()
  await expect(page.locator('[class*="gaugeProgress"]')).toHaveAttribute(
    'stroke-dashoffset',
    /125\.66/,
  )
  await page.getByRole('button', { name: 'Phạm vi dữ liệu' }).click()
  await expect(page.getByRole('dialog')).toContainText(
    'Không đọc điểm sàng lọc',
  )
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).not.toBeVisible()
  facts = {
    ...readyAnalytics,
    financials: {
      ...readyAnalytics.financials,
      state: 'UNAVAILABLE',
      currency: null,
      earnedAmountMinor: null,
      paidAmountMinor: null,
    },
  }
  await page.getByRole('button', { name: 'Làm mới số liệu' }).click()
  await expect(
    page.getByText(/Dữ liệu tài chính chưa thể kết nối/),
  ).toBeVisible()
  await capture(page, info, 'analytics-partial-financials')
  expect(errors).toEqual([])
})

test('analytics empty facts stay usable and locked profile states have a real destination', async ({
  page,
}, info) => {
  let facts: Analytics = emptyAnalytics
  await page.route('**/api/consultation/specialist/analytics?**', (route) =>
    route.fulfill({ json: facts }),
  )
  await page.setViewportSize({ width: 1280, height: 800 })
  await enterAnalytics(page)
  await expect(
    page.getByRole('link', { name: 'Quản lý lịch khả dụng' }),
  ).toHaveAttribute('href', '/specialist/availability')
  await expect(
    page.getByText('Chưa có đánh giá', { exact: true }),
  ).toBeVisible()
  await capture(page, info, 'analytics-empty-1280')
  await page
    .getByRole('button', { name: 'Yêu cầu mới: 00 lượt. Xem chi tiết' })
    .click()
  await expect(page.getByRole('dialog')).toContainText(
    'Không có sự kiện ở mốc này',
  )
  await page.keyboard.press('Escape')
  facts = blockedAnalytics('PENDING_APPROVAL')
  await page.route('**/api/consultation/specialist-profile', (route) =>
    route.fulfill({
      json: {
        ...approvedProfile,
        approvalStatus: 'PENDING',
        reviewedAt: null,
        reviewedBy: null,
      },
      headers: { etag: '"2"' },
    }),
  )
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Hồ sơ của bạn đang chờ duyệt' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Xem hồ sơ', exact: true }),
  ).toHaveAttribute('href', '/specialist/profile')
  await expect(page.getByRole('button', { name: '30 ngày' })).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Yêu cầu mới: — lượt. Xem chi tiết' }),
  ).toBeDisabled()
  await capture(page, info, 'analytics-profile-pending-1280')
  await page.setViewportSize({ width: 375, height: 812 })
  await noOverflow(page)
  await capture(page, info, 'analytics-profile-pending-375')
})

test('analytics loading, missing data and failed refresh recover without hiding safe facts', async ({
  page,
}, info) => {
  let unavailable = true
  let release!: () => void
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  let first = true
  await page.route(
    '**/api/consultation/specialist/analytics?**',
    async (route) => {
      if (first) {
        first = false
        await pending
      }
      return unavailable
        ? route.fulfill({
            status: 503,
            json: {
              type: 'about:blank',
              title: 'Unavailable',
              status: 503,
              code: 'DEPENDENCY_UNAVAILABLE',
              detail: 'Synthetic service failure',
            },
          })
        : route.fulfill({ json: readyAnalytics })
    },
  )
  await page.setViewportSize({ width: 1440, height: 900 })
  await enterAnalytics(page)
  await expect(page.getByRole('status')).toContainText('Đang tổng hợp')
  await capture(page, info, 'analytics-loading-1440')
  release()
  await expect(page.locator('section[role="alert"]')).toContainText(
    'Chưa thể tải số liệu vận hành',
  )
  await expect(
    page.getByRole('button', { name: 'Yêu cầu mới: — lượt. Xem chi tiết' }),
  ).toBeDisabled()
  await capture(page, info, 'analytics-missing-1440')
  unavailable = false
  await page.getByRole('button', { name: 'Thử tải lại' }).click()
  await expect(page.getByText('75%', { exact: true })).toBeVisible()
  unavailable = true
  await page.getByRole('button', { name: 'Làm mới số liệu' }).click()
  await expect(page.locator('section[role="alert"]')).toContainText(
    'lần tải thành công gần nhất',
  )
  await expect(page.getByText('75%', { exact: true })).toBeVisible()
  await page.setViewportSize({ width: 375, height: 812 })
  await noOverflow(page)
  await capture(page, info, 'analytics-failed-refresh-375')
})
