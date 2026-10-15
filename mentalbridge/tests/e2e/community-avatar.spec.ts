import { expect } from '@playwright/test'
import { test } from './test-fixtures'

const timestamp = '2026-10-13T13:00:00Z'
const mediaId = '30000000-0000-4000-8000-000000000091'
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1cAAAAASUVORK5CYII=',
  'base64',
)

test.describe('Community uploaded avatar', () => {
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'Synthetic upload/recovery checks never run against shared accounts or storage.',
  )

  test('enters through USER navigation, saves a photo independently and retries without uploading twice', async ({
    page,
    request,
  }) => {
    expect(
      (await request.post('http://127.0.0.1:3201/__test/reset')).status(),
    ).toBe(204)
    const profile = {
      communityProfileId: '10000000-0000-4000-8000-000000000091',
      displayName: 'Mầm Xanh',
      avatarPreset: 'SPROUT',
      avatarImage: null as null | {
        mediaId: string
        url: string
        width: number
        height: number
      },
      status: 'ACTIVE',
      version: 2,
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    let uploaded = 0
    let intents = 0
    let selections = 0
    await page.route('https://avatar.e2e.invalid/**', async (route) => {
      if (route.request().url().endsWith('/upload')) {
        uploaded++
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: {
            'Access-Control-Allow-Origin': new URL(page.url()).origin,
          },
          body: '{}',
        })
      }
      return route.fulfill({ contentType: 'image/png', body: png })
    })
    await page.route('**/api/community/**', async (route) => {
      const req = route.request()
      const path = new URL(req.url()).pathname
      const json = (body: unknown, status = 200) =>
        route.fulfill({
          status,
          contentType: 'application/json',
          headers: { ETag: `"${profile.version}"` },
          body: JSON.stringify(body),
        })
      if (path === '/api/community/profile' && req.method() === 'GET')
        return json({
          ...profile,
          ...(profile.avatarImage
            ? { avatarImage: profile.avatarImage }
            : { avatarImage: undefined }),
        })
      if (path === '/api/community/profile' && req.method() === 'PUT') {
        Object.assign(profile, req.postDataJSON(), {
          version: profile.version + 1,
        })
        return json({
          ...profile,
          avatarImage: profile.avatarImage ?? undefined,
        })
      }
      if (path === '/api/community/media/upload-intents') {
        intents++
        return json({
          mediaId,
          state: 'PENDING',
          version: 0,
          expiresAt: '2099-10-14T13:00:00Z',
          uploadUrl: 'https://avatar.e2e.invalid/upload',
          uploadFields: { signature: 'synthetic-only' },
        })
      }
      if (path === `/api/community/media/${mediaId}/finalize`)
        return json({
          mediaId,
          state: 'READY',
          mediaType: 'IMAGE',
          version: 1,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
      if (path === '/api/community/profile/avatar') {
        expect(req.headers()['if-match']).toBe(`"${profile.version}"`)
        expect(req.postDataJSON()).toEqual({ mediaId })
        selections++
        if (selections === 1)
          return json(
            {
              type: 'about:blank',
              title: 'Temporary failure',
              code: 'COMMUNITY_TEMPORARILY_UNAVAILABLE',
              status: 503,
              correlationId: '62cda42f-b286-43c6-aa48-88ef64ff3361',
            },
            503,
          )
        profile.avatarImage = {
          mediaId,
          url: 'https://avatar.e2e.invalid/photo.png',
          width: 1,
          height: 1,
        }
        profile.version++
        return json(profile)
      }
      return route.continue()
    })
    await page.goto('/login')
    await page.getByLabel('Email').fill('user@example.com')
    await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
    await page.getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await page
      .getByRole('banner')
      .getByRole('link', { name: 'Cộng đồng', exact: true })
      .click()
    await page
      .getByRole('link', { name: 'Danh tính', exact: true })
      .first()
      .click()
    await page.getByLabel('Tên hiển thị hoặc biệt danh').fill('Tên đang sửa')
    await page
      .getByLabel('Chọn tệp ảnh đại diện')
      .setInputFiles({ name: 'avatar.png', mimeType: 'image/png', buffer: png })
    await expect(page.getByText('avatar.png', { exact: true })).toBeVisible()
    await page.goBack()
    const leave = page.getByRole('dialog', { name: 'Rời trang khi chưa lưu?' })
    await expect(leave).toBeVisible()
    await leave.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }).click()
    await expect(page.getByLabel('Tên hiển thị hoặc biệt danh')).toHaveValue(
      'Tên đang sửa',
    )
    await page.getByRole('button', { name: 'Lưu ảnh đại diện' }).click()
    await expect(
      page
        .getByRole('region', { name: 'Ảnh đại diện cộng đồng' })
        .getByRole('alert'),
    ).toContainText('Chưa lưu được ảnh')
    await page.getByRole('button', { name: 'Lưu ảnh đại diện' }).click()
    await expect(page.getByRole('status')).toContainText('Đã lưu ảnh đại diện')
    expect(intents).toBe(1)
    expect(uploaded).toBe(1)
    await expect(page.getByLabel('Tên hiển thị hoặc biệt danh')).toHaveValue(
      'Tên đang sửa',
    )
    await page
      .getByRole('button', { name: 'Lưu thay đổi', exact: true })
      .click()
    await expect(
      page.getByText('Đã lưu danh tính cộng đồng', { exact: true }),
    ).toBeVisible()
    await page.reload()
    await expect(
      page.getByLabel('Ảnh đại diện hiện tại').locator('img'),
    ).toBeVisible()
    await expect(page.getByLabel('Tên hiển thị hoặc biệt danh')).toHaveValue(
      'Tên đang sửa',
    )
  })
})
