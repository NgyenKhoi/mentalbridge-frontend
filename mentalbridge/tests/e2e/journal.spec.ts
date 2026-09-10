import { expect, test, type BrowserContext } from '@playwright/test'

const ownerAccountId = '10000000-0000-4000-8000-000000000005'
const journalId = '40000000-0000-4000-8000-000000000001'
const timestamp = '2026-09-10T09:00:00.000Z'

function entry(text: string, revision = 1, tags = ['riêng tư']) {
  return {
    id: journalId,
    ownerAccountId,
    currentRevision: revision,
    occurredAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
    deleted: false,
    tags,
    encryption: {
      algorithm: 'AES-256-GCM',
      keyId: 'e2e-v1',
      encryptedAt: timestamp,
    },
    analysisState: revision === 1 ? 'not_requested' : 'stale',
    content: { text, byteLength: new TextEncoder().encode(text).byteLength },
  }
}

async function authenticated(context: BrowserContext) {
  await context.addCookies([
    {
      name: 'mentalbridge_access',
      value: 'synthetic-resource-e2e-access',
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
}

test.describe('Private Journal CRUD', () => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    'Controlled session fixture is available only with the managed local server.',
  )

  test('creates, refreshes, revises, handles conflict, and tombstones on desktop', async ({
    context,
    page,
  }) => {
    await authenticated(context)
    let current: ReturnType<typeof entry> | null = null
    let conflictOnce = true
    await context.route('**/api/journals**', async (route) => {
      const request = route.request()
      const path = new URL(request.url()).pathname
      const method = request.method()
      if (path === '/api/journals' && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: current
              ? [
                  {
                    ...current,
                    content: {
                      preview: current.content.text,
                      byteLength: current.content.byteLength,
                    },
                  },
                ]
              : [],
            page: { limit: 20, hasMore: false },
          }),
        })
        return
      }
      if (path === '/api/journals' && method === 'POST') {
        const payload = request.postDataJSON() as {
          content: { text: string }
          tags: string[]
        }
        current = entry(payload.content.text, 1, payload.tags)
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(current),
        })
        return
      }
      if (
        path === `/api/journals/${journalId}` &&
        method === 'GET' &&
        current
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(current),
        })
        return
      }
      if (
        path === `/api/journals/${journalId}` &&
        method === 'PATCH' &&
        current
      ) {
        if (conflictOnce) {
          conflictOnce = false
          await route.fulfill({
            status: 412,
            contentType: 'application/problem+json',
            body: JSON.stringify({
              code: 'PRECONDITION_FAILED',
              title: 'Conflict',
            }),
          })
          return
        }
        const payload = request.postDataJSON() as {
          content: { text: string }
          tags: string[]
        }
        current = entry(payload.content.text, 2, payload.tags)
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(current),
        })
        return
      }
      if (path === `/api/journals/${journalId}` && method === 'DELETE') {
        current = null
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: journalId,
            ownerAccountId,
            deleted: true,
            deletedAt: timestamp,
          }),
        })
        return
      }
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: '{}',
      })
    })

    await page.goto('/journal')
    await expect(
      page.getByRole('heading', { name: 'Chưa có nhật ký' }),
    ).toBeVisible()
    await page.locator('.journal-live-hero button').click()
    await page.getByLabel('Nội dung').fill('Nội dung được giữ sau khi tải lại')
    await page.getByLabel('Thẻ do bạn đặt').fill('riêng tư, hôm nay')
    await page.getByRole('button', { name: 'Lưu nhật ký' }).click()
    await expect(
      page.getByText('Nội dung được giữ sau khi tải lại'),
    ).toBeVisible()
    await page.reload()
    await expect(
      page.getByText('Nội dung được giữ sau khi tải lại'),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Xem chi tiết' }).click()
    await page.getByRole('button', { name: 'Chỉnh sửa' }).click()
    await page.getByLabel('Nội dung').fill('Bản chỉnh sửa không bị mất')
    await page.getByRole('button', { name: 'Lưu nhật ký' }).click()
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText(
      'cập nhật ở nơi khác',
    )
    await expect(page.getByLabel('Nội dung')).toHaveValue(
      'Bản chỉnh sửa không bị mất',
    )
    await page.getByRole('button', { name: 'Lưu nhật ký' }).click()
    await expect(page.getByText('Phiên bản 2')).toBeVisible()
    await page.screenshot({
      path: 'docs/evidence/mb-236-journal-desktop.png',
      fullPage: true,
    })
    await page.getByRole('button', { name: 'Xóa' }).click()
    await expect(
      page.getByText(/không có nghĩa dữ liệu vật lý được xóa ngay/i),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Xóa nhật ký' }).click()
    await expect(
      page.getByRole('heading', { name: 'Chưa có nhật ký' }),
    ).toBeVisible()
  })

  test('keeps the Journal action and detail usable on mobile', async ({
    context,
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await authenticated(context)
    const seeded = entry('Nhật ký trên thiết bị di động')
    await context.route('**/api/journals**', async (route) => {
      const path = new URL(route.request().url()).pathname
      const response = path.endsWith(journalId)
        ? seeded
        : {
            items: [
              {
                ...seeded,
                content: {
                  preview: seeded.content.text,
                  byteLength: seeded.content.byteLength,
                },
              },
            ],
            page: { limit: 20, hasMore: false },
          }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(response),
      })
    })
    await page.goto('/journal')
    const detail = page.getByRole('button', { name: 'Xem chi tiết' })
    await expect(detail).toBeVisible()
    await detail.click()
    await expect(page.getByRole('dialog')).toContainText(
      'Nhật ký trên thiết bị di động',
    )
    await expect(page.getByRole('button', { name: 'Chỉnh sửa' })).toBeVisible()
    await page.screenshot({
      path: 'docs/evidence/mb-236-journal-mobile.png',
      fullPage: true,
    })
  })
})
