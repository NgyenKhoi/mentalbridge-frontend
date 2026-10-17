import { expect } from '@playwright/test'
import type { ProfileAmendment } from '@/lib/consultation/consultation-validation'
import { test } from './test-fixtures'
import { approvedProfile, draftAmendment } from '../fixtures/profile-amendment'

test('approved specialist edits privately, reloads, and explicitly submits an amendment', async ({
  page,
}) => {
  let amendment: ProfileAmendment | null = null
  let publicWrites = 0
  await page.route('**/api/consultation/specialist-profile', (route) => {
    if (route.request().method() !== 'GET') publicWrites++
    return route.fulfill({ json: approvedProfile, headers: { etag: '"2"' } })
  })
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
  const form = page.locator('#specialist-profile-form')
  const displayName = page.getByLabel('Tên hiển thị', { exact: true })
  await displayName.fill('Chuyên gia Chi')
  await expect(
    form.getByRole('button', { name: 'Gửi xét duyệt' }),
  ).toBeDisabled()
  await expect(
    page.getByRole('heading', { name: 'Chuyên gia Chi' }),
  ).toHaveCount(2)
  await form.getByRole('button', { name: 'Lưu thay đổi' }).click()
  await expect(form.getByRole('status')).toContainText(
    'Đã lưu bản chỉnh sửa riêng tư',
  )
  await expect(
    form.getByRole('button', { name: 'Gửi xét duyệt' }),
  ).toBeEnabled()
  await expect(
    page.getByText('Tên hiển thị công khai hiện tại:'),
  ).toContainText('Chuyên gia An')
  await page.reload()
  await expect(displayName).toHaveValue('Chuyên gia Chi')
  await expect(
    page.getByText('Tên hiển thị công khai hiện tại:'),
  ).toContainText('Chuyên gia An')
  await form.getByRole('button', { name: 'Gửi xét duyệt' }).click()
  await expect(page.getByText('Bản chỉnh sửa (Chờ xét duyệt)')).toBeVisible()
  await expect(
    form.getByRole('button', { name: 'Gửi xét duyệt' }),
  ).toBeDisabled()
  await form.getByRole('button', { name: 'Hủy bản chỉnh sửa' }).click()
  await expect(form.getByRole('status')).toContainText('Đã hủy bản chỉnh sửa')
  await expect(displayName).toHaveValue('Chuyên gia An')
  await page.reload()
  await expect(displayName).toHaveValue('Chuyên gia An')
  await expect(
    form.getByRole('button', { name: 'Hủy bản chỉnh sửa' }),
  ).toHaveCount(0)
  expect(publicWrites).toBe(0)
})

test('incoming profile form keeps preview, keyboard controls and responsive layouts usable', async ({
  page,
}, testInfo) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route('**/api/consultation/specialist-profile', (route) =>
    route.fulfill({ json: approvedProfile, headers: { etag: '"2"' } }),
  )
  await page.route(
    '**/api/consultation/specialist-profile/amendments/current',
    (route) =>
      route.fulfill({
        json: { approvedProfile, amendment: draftAmendment },
        headers: { etag: '"1"' },
      }),
  )
  await page.route(
    '**/api/consultation/specialist-profile/documents',
    (route) => route.fulfill({ json: [] }),
  )
  await page.goto('/login')
  await page.getByLabel('Email').fill('specialist@example.com')
  await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/specialist\/dashboard$/)
  await page.goto('/specialist/profile')
  await page
    .getByLabel('Tên hiển thị', { exact: true })
    .fill('Tên đang chỉnh sửa')
  await expect(
    page.getByRole('heading', { name: 'Tên đang chỉnh sửa' }),
  ).toHaveCount(2)
  const years = page.getByRole('spinbutton')
  const originalYears = Number(await years.inputValue())
  await page.getByRole('button', { name: 'Tăng số năm kinh nghiệm' }).click()
  await expect(years).toHaveValue(String(originalYears + 1))
  await page.getByRole('button', { name: 'Giảm số năm kinh nghiệm' }).click()
  await expect(years).toHaveValue(String(originalYears))
  const english = page.getByRole('checkbox', { name: 'English' })
  await english.focus()
  await page.keyboard.press('Space')
  await expect(english).toBeChecked()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  for (const width of [1440, 1280, 768, 375]) {
    await page.setViewportSize({ width, height: 900 })
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true)
    await expect(
      page.getByRole('heading', { name: 'Hồ sơ chuyên gia', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'Xem giấy tờ', exact: true }),
    ).toBeVisible()
    await expect(english).toBeChecked()
    await testInfo.attach('profile-' + width, {
      body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
      contentType: 'image/png',
    })
  }
  await page.getByRole('button', { name: 'Xem giấy tờ', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Xem giấy tờ', exact: true }),
  ).toBeFocused()
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
