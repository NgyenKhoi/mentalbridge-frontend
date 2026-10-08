import { expect } from '@playwright/test'
import { test } from './test-fixtures'
import { approvedProfile, draftAmendment } from '../fixtures/profile-amendment'

test('approved specialist edits privately, reloads, and explicitly submits an amendment', async ({
  page,
}) => {
  let amendment: typeof draftAmendment | null = null
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
        amendment = structuredClone(draftAmendment)
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
  await expect(page.getByRole('alert')).toContainText(
    'Bản chỉnh sửa vừa thay đổi',
  )
  await expect(
    page.getByRole('button', { name: 'Phê duyệt và công khai' }),
  ).toBeDisabled()
  await expect(
    page.getByRole('button', { name: 'Tải lại danh sách' }),
  ).toBeEnabled()
})
