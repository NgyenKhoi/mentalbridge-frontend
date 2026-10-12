import { expect, type Page } from '@playwright/test'
import { approvedProfile } from '../fixtures/profile-amendment'
import { workspaceDashboard } from '../fixtures/specialist-workspace'
import { test } from './test-fixtures'

test.beforeEach(async ({ request }) => {
  expect(
    (await request.post('http://127.0.0.1:3201/__test/reset')).status(),
  ).toBe(204)
})

async function enter(page: Page) {
  await page.route('**/api/consultation/specialist-profile', (route) =>
    route.fulfill({ json: approvedProfile }),
  )
  await page.route('**/api/consultation/specialist/dashboard', (route) =>
    route.fulfill({ json: workspaceDashboard }),
  )
  await page.goto('/login')
  await page.getByLabel('Email').fill('specialist@example.com')
  await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/specialist\/dashboard$/)
}

async function supportAtBottom(page: Page, width: number) {
  const trigger = page.getByRole('button', { name: 'Mở hỗ trợ khẩn cấp' })
  await expect(trigger).toHaveCount(1)
  await page.mouse.move(0, 0)
  await expect
    .poll(async () => {
      const box = (await trigger.boundingBox())!
      return Math.abs(
        page.viewportSize()!.height -
          box.y -
          box.height -
          (width <= 640 ? 16 : 24),
      )
    })
    .toBeLessThan(1)
  const box = (await trigger.boundingBox())!
  expect(
    Math.abs(width - box.x - box.width - (width <= 640 ? 16 : 24)),
  ).toBeLessThan(1)
}

test('one specialist identity, usable collapsed menu, consistent floating support across all destinations', async ({
  page,
}, info) => {
  test.setTimeout(90000)
  await enter(page)
  for (const width of [1440, 1280, 768, 375]) {
    await page.setViewportSize({ width, height: width === 1280 ? 800 : 900 })
    await supportAtBottom(page, width)
    await expect(
      page.getByRole('button', { name: 'Mở menu tài khoản', exact: true }),
    ).toHaveCount(0)
    if (width > 980) {
      const sidebar = page.locator('.role-sidebar')
      const account = sidebar.getByRole('button', {
        name: 'Mở menu tài khoản chuyên gia',
      })
      await expect(account).toHaveCount(1)
      await expect(account).toContainText(approvedProfile.displayName)
      await expect(account).toContainText('Chuyên gia đã được duyệt')
      expect(
        await account
          .locator('span[aria-hidden="true"]')
          .evaluate((el) => getComputedStyle(el).color),
      ).toBe('rgb(255, 255, 255)')
      await expect(sidebar).not.toContainText('Tài khoản cá nhân')
      await account.click()
      await expect(
        sidebar.getByRole('menuitem', { name: 'Hồ sơ chuyên gia' }),
      ).toHaveAttribute('href', '/specialist/profile')
      await expect(
        sidebar.getByRole('menuitem', { name: 'Đăng xuất', exact: true }),
      ).toBeVisible()
      await expect(
        sidebar.getByRole('menuitem', { name: 'Đăng xuất mọi thiết bị' }),
      ).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(account).toBeFocused()
    } else {
      await page.getByRole('button', { name: 'Mở menu' }).click()
      const drawer = page.getByRole('dialog', { name: 'Điều hướng chuyên gia' })
      const account = drawer.getByRole('button', {
        name: 'Mở menu tài khoản chuyên gia',
      })
      await expect(account).toHaveCount(1)
      await expect(account).toContainText(approvedProfile.displayName)
      await expect(drawer).not.toContainText('Tài khoản cá nhân')
      await account.click()
      await expect(
        drawer.getByRole('menuitem', { name: 'Đăng xuất', exact: true }),
      ).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(drawer).toBeVisible()
      await expect(account).toBeFocused()
      await expect(drawer.getByRole('menu')).toHaveCount(0)
      await page.keyboard.press('Escape')
      await expect(drawer).not.toBeVisible()
    }
    await expect(
      page.locator('[data-overview-artwork] canvas'),
    ).toHaveAttribute('data-scene-phase', 'idle')
    await page.screenshot({
      path: info.outputPath(`single-account-${width}.png`),
      fullPage: true,
      animations: 'disabled',
    })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('button', { name: 'Thu gọn thanh bên' }).click()
  const sidebar = page.locator('.role-sidebar')
  const account = sidebar.getByRole('button', {
    name: 'Mở menu tài khoản chuyên gia',
  })
  await account.click()
  const profile = sidebar.getByRole('menuitem', { name: 'Hồ sơ chuyên gia' })
  await expect(profile).toBeVisible()
  await expect(profile).toHaveText('Hồ sơ chuyên gia')
  await profile.focus()
  await page.keyboard.press('Tab')
  await expect(
    sidebar.getByRole('menuitem', { name: 'Gói dịch vụ' }),
  ).toBeFocused()
  await page.screenshot({
    path: info.outputPath('single-account-collapsed-menu.png'),
    animations: 'disabled',
  })
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Mở rộng thanh bên' }).click()
  for (const key of [
    'appointments',
    'availability',
    'clients',
    'messages',
    'follow-up',
    'earnings',
    'profile',
    'analytics',
    'dashboard',
  ]) {
    await sidebar.locator(`a[href="/specialist/${key}"]`).first().click()
    await expect(page).toHaveURL(new RegExp(`/specialist/${key}$`))
    await supportAtBottom(page, 1440)
    await expect(
      sidebar.getByRole('button', { name: 'Mở menu tài khoản chuyên gia' }),
    ).toHaveCount(1)
  }
  const support = page.getByRole('button', { name: 'Mở hỗ trợ khẩn cấp' })
  await support.click()
  await expect(
    page.getByRole('dialog', { name: 'Bảng hỗ trợ khẩn cấp' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(support).toBeFocused()
  await page.mouse.move(0, 0)
  await page.getByRole('button', { name: 'Làm mới', exact: true }).focus()
  await supportAtBottom(page, 1440)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await supportAtBottom(page, 1440)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await supportAtBottom(page, 1440)
})

test('specialist unified account can still log out', async ({ page }) => {
  await enter(page)
  await page
    .getByRole('button', { name: 'Mở menu tài khoản chuyên gia' })
    .click()
  await page.getByRole('menuitem', { name: 'Đăng xuất', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/specialist/dashboard')
  await expect(page).toHaveURL(/\/login\?next=/)
})
