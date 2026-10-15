import { expect, type Locator } from '@playwright/test'
import type { ProfileAmendment } from '@/lib/consultation/consultation-validation'
import { test } from './test-fixtures'
import { approvedProfile, draftAmendment } from '../fixtures/profile-amendment'

// Observe the real browser animation at creation time: a short animation may
// finish before the next Playwright round-trip on a busy machine.
async function observeNativeAnimation(locator: Locator) {
  await locator.evaluate((element) => {
    const animate = element.animate.bind(element)
    let calls = 0
    element.animate = (...args: Parameters<Element['animate']>) => {
      const animation = animate(...args)
      element.setAttribute('data-e2e-motion-calls', String(++calls))
      element.setAttribute('data-e2e-motion-state', animation.playState)
      element.setAttribute(
        'data-e2e-motion-keyframes',
        JSON.stringify(
          animation.effect instanceof KeyframeEffect
            ? animation.effect.getKeyframes()
            : [],
        ),
      )
      return animation
    }
  })
}

test('approved specialist edits privately, reloads, and explicitly submits an amendment', async ({
  page,
}) => {
  let amendment: ProfileAmendment | null = null
  await page.route('**/api/consultation/specialist-profile', (route) =>
    route.fulfill({ json: approvedProfile, headers: { etag: '"2"' } }),
  )
  await page.route(
    '**/api/consultation/specialist-profile/amendments**',
    async (route) => {
      const request = route.request()
      if (request.url().endsWith('/current'))
        return route.fulfill({
          json: { approvedProfile, amendment },
          headers: { etag: amendment ? `"${amendment.version}"` : '"2"' },
        })
      if (request.url().endsWith('/amendments')) {
        expect(request.headers()['if-match']).toBe('"2"')
        const {
          displayName,
          bio,
          supportAreas,
          languages,
          yearsOfExperience,
          timezone,
        } = approvedProfile
        amendment = structuredClone({
          ...draftAmendment,
          proposedProfile: {
            displayName,
            bio,
            supportAreas,
            languages: languages.map((language) => {
              if (language !== 'vi' && language !== 'en')
                throw new Error('Unsupported fixture language')
              return language
            }),
            yearsOfExperience,
            timezone,
          },
        })
      } else if (request.method() === 'PUT') {
        expect(request.headers()['if-match']).toBe(`"${amendment!.version}"`)
        amendment = {
          ...amendment!,
          proposedProfile: request.postDataJSON(),
          version: amendment!.version + 1,
        }
      } else if (request.url().endsWith('/submit')) {
        expect(request.headers()['if-match']).toBe(`"${amendment!.version}"`)
        amendment = {
          ...amendment!,
          status: 'PENDING_REVIEW',
          submittedAt: '2026-10-08T03:00:00Z',
          version: amendment!.version + 1,
        }
      } else if (request.url().endsWith('/cancel')) {
        expect(request.headers()['if-match']).toBe(`"${amendment!.version}"`)
        amendment = {
          ...amendment!,
          status: 'CANCELLED',
          submittedAt: null,
          reviewedAt: null,
          reviewedBy: null,
          reasonCode: null,
          version: amendment!.version + 1,
        }
      }
      return route.fulfill({
        json: amendment,
        headers: { etag: `"${amendment!.version}"` },
      })
    },
  )
  await page.goto('/login')
  await page.getByLabel('Email').fill('specialist@example.com')
  await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/specialist\/dashboard$/)
  await page.goto('/specialist/profile')
  await page.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }).click()
  await page.getByLabel('Tên hiển thị', { exact: true }).fill('Chuyên gia Chi')
  await expect(
    page.getByRole('button', { name: 'Gửi xét duyệt' }),
  ).toBeDisabled()
  await expect(
    page.getByRole('region', { name: 'Xem trước bản chỉnh sửa' }),
  ).toContainText('Chuyên gia Chi')
  await page
    .getByRole('button', { name: 'Đang công khai', exact: true })
    .click()
  await page.getByRole('button', { name: 'Lưu bản nháp' }).click()
  await page.reload()
  await page
    .getByRole('button', { name: 'Đang công khai', exact: true })
    .click()
  await expect(
    page.getByRole('region', { name: 'Hồ sơ đang công khai' }),
  ).toContainText('Chuyên gia An')
  await expect(
    page.getByRole('region', { name: 'Bản chỉnh sửa · Chưa công khai' }),
  ).toContainText('Chuyên gia Chi')
  await page.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }).click()
  await page.getByRole('button', { name: 'Gửi xét duyệt' }).click()
  await expect(page.getByText('Đang chờ duyệt', { exact: true })).toBeVisible()
  await page
    .getByRole('button', { name: 'Đang công khai', exact: true })
    .click()
  await expect(
    page.getByRole('region', { name: 'Hồ sơ đang công khai' }),
  ).toContainText('Chuyên gia An')
  await page.getByRole('button', { name: 'Hủy bản chỉnh sửa' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Giữ bản chỉnh sửa' })
    .click()
  await expect(page.getByText('Đang chờ duyệt', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Hủy bản chỉnh sửa' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Hủy bản chỉnh sửa' })
    .click()
  await expect(
    page.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }),
  ).toBeEnabled()
  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Hủy bản chỉnh sửa' }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }).click()
  await page
    .getByLabel('Tên hiển thị', { exact: true })
    .fill('Thay đổi chưa lưu')
  await page.getByRole('button', { name: 'Hủy thay đổi chưa lưu' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Hủy thay đổi', exact: true })
    .click()
  await page.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }).click()
  await expect(page.getByLabel('Tên hiển thị', { exact: true })).toHaveValue(
    'Chuyên gia An',
  )
})

test('prototype interactions mirror real fields and respect reduced motion and responsive layouts', async ({
  page,
}, testInfo) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route('**/api/consultation/specialist-profile', (route) =>
    route.fulfill({ json: approvedProfile }),
  )
  await page.route(
    '**/api/consultation/specialist-profile/amendments/current',
    (route) =>
      route.fulfill({ json: { approvedProfile, amendment: draftAmendment } }),
  )
  await page.goto('/login')
  await page.getByLabel('Email').fill('specialist@example.com')
  await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/specialist\/dashboard$/)
  await page.goto('/specialist/profile')
  await page.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }).click()
  const hero = page.getByRole('region', { name: 'Danh tính chuyên gia' })
  const sheen = hero.locator(':scope > span[aria-hidden="true"]')
  const beforeSheen = await sheen.evaluate(
    (element) => getComputedStyle(element).transform,
  )
  await hero.hover()
  await expect
    .poll(() =>
      sheen.evaluate((element) => getComputedStyle(element).transform),
    )
    .not.toBe(beforeSheen)
  await observeNativeAnimation(sheen)
  await hero.click()
  await expect(sheen).toHaveAttribute('data-e2e-motion-calls', '1')
  await expect(sheen).toHaveAttribute('data-e2e-motion-state', 'running')
  await page
    .getByLabel('Tên hiển thị', { exact: true })
    .fill('Tên đang chỉnh sửa')
  await expect(hero).toContainText('Tên đang chỉnh sửa')
  const preview = page.getByRole('region', { name: 'Xem trước bản chỉnh sửa' })
  await expect(preview).toContainText('Tên đang chỉnh sửa')
  const years = page.getByRole('spinbutton', { name: 'Số năm kinh nghiệm' })
  await observeNativeAnimation(years)
  await page.getByRole('button', { name: 'Tăng năm kinh nghiệm' }).click()
  await expect(years).toHaveValue('6')
  await expect(years).toHaveAttribute('data-e2e-motion-calls', '1')
  await expect(years).toHaveAttribute('data-e2e-motion-state', 'running')
  await expect(years).toHaveAttribute(
    'data-e2e-motion-keyframes',
    /scale\(1\.28\) translateY\(-2px\)/,
  )
  await expect(hero).toContainText('6 năm kinh nghiệm')
  await expect(preview).toContainText('6 năm kinh nghiệm')
  await page.getByRole('button', { name: 'Giảm năm kinh nghiệm' }).click()
  await expect(years).toHaveValue('5')
  await expect(years).toHaveAttribute('data-e2e-motion-calls', '2')
  await expect(years).toHaveAttribute('data-e2e-motion-state', 'running')
  const english = page.getByRole('checkbox', { name: 'Tiếng Anh' })
  await english.focus()
  await page.keyboard.press('Space')
  await expect(english).toBeChecked()
  const tag = preview.getByText('Tiếng Anh', { exact: true })
  await expect(tag).toBeVisible()
  expect(
    await tag.evaluate((element) => getComputedStyle(element).animationName),
  ).toContain('profileTagPop')
  const ring = page.locator('[title^="Độ hoàn thiện"]')
  await ring.hover()
  await expect
    .poll(() => ring.evaluate((element) => getComputedStyle(element).transform))
    .not.toBe('none')
  const book = page.getByRole('button', { name: 'Đặt lịch tư vấn · 60 phút' })
  const beforeBook = await book.evaluate(
    (element) => getComputedStyle(element).backgroundImage,
  )
  expect(beforeBook).toContain('linear-gradient')
  await book.hover()
  await expect
    .poll(() =>
      book.evaluate((element) => getComputedStyle(element).backgroundImage),
    )
    .not.toBe(beforeBook)
  await book.click()
  await expect(
    page.getByRole('region', { name: 'Phản hồi thao tác' }),
  ).toContainText('Đây là bản xem trước')
  await page
    .getByRole('region', { name: 'Phản hồi thao tác' })
    .getByRole('button')
    .click()
  for (const width of [1440, 1280, 768, 375]) {
    await page.setViewportSize({ width, height: 900 })
    await page.evaluate(() => window.scrollTo(0, 0))
    if (width <= 980) {
      await expect
        .poll(() =>
          page
            .locator('.role-sidebar')
            .evaluate((element) => element.getBoundingClientRect().right),
        )
        .toBeLessThanOrEqual(1)
      await expect
        .poll(() =>
          page
            .locator('.role-main')
            .evaluate((element) =>
              Math.abs(element.getBoundingClientRect().left),
            ),
        )
        .toBeLessThanOrEqual(1)
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    const headerLayout = await page
      .getByRole('heading', { name: 'Hồ sơ chuyên gia', exact: true })
      .locator('xpath=ancestor::header')
      .getByRole('button')
      .evaluateAll((buttons) =>
        buttons.every((element) => {
          const rect = element.getBoundingClientRect()
          return (
            rect.left >= 0 &&
            rect.right <= innerWidth &&
            element.scrollWidth <= element.clientWidth
          )
        }),
      )
    expect(headerLayout).toBe(true)
    expect(
      await book.evaluate(
        (element) => getComputedStyle(element).backgroundImage,
      ),
    ).toContain('linear-gradient')
    await expect(tag).toBeVisible()
    await testInfo.attach(`profile-prototype-${width}`, {
      body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
      contentType: 'image/png',
    })
  }
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await ring.hover()
  expect(
    await ring.evaluate((element) => getComputedStyle(element).transform),
  ).toBe('none')
  await page.getByRole('button', { name: 'Tăng năm kinh nghiệm' }).click()
  expect(
    await years.evaluate((element) => element.getAnimations().length),
  ).toBe(0)
  await expect(years).toHaveValue('6')
  await expect(years).toHaveAttribute('data-e2e-motion-calls', '2')
  expect(
    await tag.evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none')
  const previewButton = page.getByRole('button', {
    name: 'Xem hồ sơ đang công khai',
  })
  await previewButton.click()
  await expect(page.getByRole('dialog')).toContainText('Chuyên gia An')
  await page.keyboard.press('Escape')
  await expect(previewButton).toBeFocused()
  expect(pageErrors).toEqual([])
})

test('admin reviews profile updates separately and refuses stale approval', async ({
  page,
}) => {
  const amendment = {
    ...draftAmendment,
    status: 'PENDING_REVIEW',
    submittedAt: '2026-10-08T03:00:00Z',
    version: 2,
  }
  await page.route('**/api/admin/specialist-profiles?**', (route) =>
    route.fulfill({ json: { items: [], count: 0 } }),
  )
  await page.route('**/api/admin/specialist-profiles/amendments?**', (route) =>
    route.fulfill({ json: { items: [amendment], count: 1, hasMore: false } }),
  )
  await page.route(
    `**/api/admin/specialist-profiles/amendments/${amendment.id}`,
    (route) =>
      route.fulfill({
        json: { approvedProfile, amendment },
        headers: { etag: '"2"' },
      }),
  )
  await page.route('**/amendments/*/approve', (route) =>
    route.fulfill({
      status: 412,
      json: { title: 'Changed', code: 'PROFILE_AMENDMENT_VERSION_MISMATCH' },
    }),
  )
  await page.goto('/login')
  await page.getByLabel('Email').fill('admin-resource-e2e@example.com')
  await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/admin\/dashboard$/)
  await page.goto('/admin/specialists')
  await page
    .getByRole('button', { name: 'Cập nhật hồ sơ', exact: true })
    .click()
  await page.getByRole('button', { name: /Chuyên gia Bình/ }).click()
  await expect(page.getByText('Đang công khai', { exact: true })).toHaveCount(6)
  await page.getByRole('button', { name: 'Phê duyệt và công khai' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Phê duyệt và công khai' })
    .click()
  await expect(
    page.getByRole('alert').filter({ hasText: 'Bản chỉnh sửa vừa thay đổi' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Phê duyệt và công khai' }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Tải lại danh sách' }),
  ).toBeEnabled()
})
