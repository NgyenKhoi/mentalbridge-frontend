import { expect, type BrowserContext, type Route } from '@playwright/test'
import { test } from './test-fixtures'

type StoredCheckIn = {
  id: string
  localDate: string
  timezone: string
  emotion: 'GREAT' | 'GOOD' | 'OKAY' | 'LOW' | 'VERY_LOW'
  intensity: number
  note: string | null
  sourceLabel: 'SELF_REPORTED_EMOTION'
  clinicalUse: 'NOT_A_DIAGNOSIS_OR_SAFETY_CLASSIFIER'
  revision: number
  recordedAt: string
  createdAt: string
  updatedAt: string
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

function problem(status: number, code: string, title: string) {
  return {
    type: `/problems/${code.toLowerCase()}`,
    title,
    status,
    code,
    correlationId: 'mb-566-e2e-correlation',
  }
}

test('dashboard creates, retries, reloads, and updates the persisted daily emotion', async ({
  context,
  page,
}) => {
  await authenticated(context)

  let stored: StoredCheckIn | null = null
  const readStored = (): StoredCheckIn | null => stored
  let failNextSave = true
  const createKeys: string[] = []
  const handle = async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    const localDate = url.pathname.split('/').at(-1) ?? ''

    if (method === 'GET') {
      if (url.pathname.endsWith('/progress')) {
        const count = stored ? 1 : 0
        await route.fulfill({
          status: 200,
          json: {
            asOfLocalDate: stored?.localDate ?? '2026-09-27',
            timezone: url.searchParams.get('timezone') ?? 'UTC',
            currentEmotion: stored?.emotion ?? null,
            currentStreak: count,
            longestStreak: count,
            windows: [7, 14, 30].map((days) => ({
              days,
              startLocalDate: '2026-08-29',
              endLocalDate: stored?.localDate ?? '2026-09-27',
              checkedInDays: count,
              totalDays: days,
              distribution: {
                GREAT: stored?.emotion === 'GREAT' ? 1 : 0,
                GOOD: stored?.emotion === 'GOOD' ? 1 : 0,
                OKAY: stored?.emotion === 'OKAY' ? 1 : 0,
                LOW: stored?.emotion === 'LOW' ? 1 : 0,
                VERY_LOW: stored?.emotion === 'VERY_LOW' ? 1 : 0,
              },
            })),
            label: 'SELF_REPORTED_EMOTION',
            interpretation: 'FACTUAL_COUNTS_NOT_DIAGNOSIS_OR_RECOVERY',
          },
        })
        return
      }
      if (url.pathname === '/api/emotion-check-ins') {
        await route.fulfill({
          status: 200,
          json: {
            items: stored ? [stored] : [],
            page: { limit: 30, hasMore: false },
            label: 'SELF_REPORTED_EMOTION',
            interpretation: 'NOT_DIAGNOSIS_OR_RECOVERY',
          },
        })
        return
      }
      if (!stored) {
        await route.fulfill({
          status: 404,
          contentType: 'application/problem+json',
          body: JSON.stringify(
            problem(404, 'RESOURCE_NOT_FOUND', 'No daily check-in'),
          ),
        })
        return
      }
      await route.fulfill({ status: 200, json: stored })
      return
    }

    if (method === 'POST') {
      createKeys.push(request.headers()['idempotency-key'] ?? '')
      if (failNextSave) {
        failNextSave = false
        await route.fulfill({
          status: 503,
          contentType: 'application/problem+json',
          body: JSON.stringify(
            problem(503, 'DEPENDENCY_UNAVAILABLE', 'Temporarily unavailable'),
          ),
        })
        return
      }
      const body = request.postDataJSON() as {
        localDate: string
        timezone: string
        emotion: StoredCheckIn['emotion']
        intensity: number
      }
      const now = '2026-09-26T02:00:00.000Z'
      stored = {
        id: '40000000-0000-4000-8000-000000000001',
        localDate: body.localDate,
        timezone: body.timezone,
        emotion: body.emotion,
        intensity: body.intensity,
        note: null,
        sourceLabel: 'SELF_REPORTED_EMOTION',
        clinicalUse: 'NOT_A_DIAGNOSIS_OR_SAFETY_CLASSIFIER',
        revision: 1,
        recordedAt: now,
        createdAt: now,
        updatedAt: now,
      }
      await route.fulfill({ status: 201, json: stored })
      return
    }

    if (method === 'PATCH' && stored) {
      expect(localDate).toBe(stored.localDate)
      expect(request.headers()['if-match-revision']).toBe('1')
      const body = request.postDataJSON() as {
        emotion: StoredCheckIn['emotion']
        intensity: number
      }
      stored = {
        ...stored,
        emotion: body.emotion,
        intensity: body.intensity,
        revision: 2,
        updatedAt: '2026-09-26T03:00:00.000Z',
      }
      await route.fulfill({ status: 200, json: stored })
      return
    }

    await route.abort()
  }

  await page.route('**/api/emotion-check-ins**', handle)
  await page.goto('/dashboard')
  await expect(
    page.getByText('Hôm nay bạn chưa ghi nhận cảm xúc.'),
  ).toBeVisible()
  await expect(
    page.getByRole('radio', { name: 'Tốt', exact: true }),
  ).not.toBeChecked()

  await page.getByText('Tốt', { exact: true }).click()
  await page.getByText('4', { exact: true }).click()
  await page.getByRole('button', { name: 'Lưu ghi nhận' }).click()
  await expect(page.locator('.ref-mood').getByRole('alert')).toContainText(
    'Chưa thể lưu',
  )
  await expect(
    page.getByRole('radio', { name: 'Tốt', exact: true }),
  ).toBeChecked()
  await page.getByRole('button', { name: 'Thử lại' }).click()
  await expect(page.getByText('Đã lưu ghi nhận hôm nay.')).toBeVisible()
  await expect(
    page.locator('.ref-trend').getByText('Chuỗi hiện tại'),
  ).toBeVisible()
  await expect(
    page.locator('.ref-trend').getByText('Đã ghi nhận 1/7 ngày'),
  ).toBeVisible()
  expect(createKeys).toHaveLength(2)
  expect(createKeys[0]).toBe(createKeys[1])

  await page.reload()
  await expect(
    page.getByRole('radio', { name: 'Tốt', exact: true }),
  ).toBeChecked()
  await page.locator('.ref-mood').getByText('Rất tốt', { exact: true }).click()
  await page.getByRole('button', { name: 'Cập nhật ghi nhận' }).click()
  await expect(page.getByText('Đã cập nhật ghi nhận hôm nay.')).toBeVisible()
  await expect(
    page.locator('.ref-trend').getByRole('meter', { name: 'Rất tốt: 1 ngày' }),
  ).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 1400 })
  await page.locator('.ref-trend').screenshot({
    path: 'docs/evidence/mb-567-emotion-progress.png',
  })
  const finalStored = readStored()
  expect(finalStored).not.toBeNull()
  expect(finalStored?.emotion).toBe('GREAT')
  expect(finalStored?.revision).toBe(2)
})

test('analytics shows authoritative emotion progress without private notes or inferred trends', async ({
  context,
  page,
}) => {
  await authenticated(context)

  const entries: StoredCheckIn[] = [
    ['2026-09-29', 'GOOD', 5],
    ['2026-09-28', 'LOW', 2],
    ['2026-09-26', 'OKAY', 3],
    ['2026-09-24', 'GOOD', 4],
  ].map(([localDate, emotion, intensity], index) => ({
    id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    localDate: String(localDate),
    timezone: 'Asia/Ho_Chi_Minh',
    emotion: emotion as StoredCheckIn['emotion'],
    intensity: Number(intensity),
    note: 'ghi chú riêng tư không được hiển thị',
    sourceLabel: 'SELF_REPORTED_EMOTION',
    clinicalUse: 'NOT_A_DIAGNOSIS_OR_SAFETY_CLASSIFIER',
    revision: 1,
    recordedAt: `${String(localDate)}T02:00:00.000Z`,
    createdAt: `${String(localDate)}T02:00:00.000Z`,
    updatedAt: `${String(localDate)}T02:00:00.000Z`,
  }))

  await page.route('**/api/emotion-check-ins**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/progress')) {
      await route.fulfill({
        status: 200,
        json: {
          asOfLocalDate: '2026-09-30',
          timezone: 'Asia/Ho_Chi_Minh',
          currentEmotion: null,
          currentStreak: 2,
          longestStreak: 5,
          windows: [7, 14, 30].map((days) => ({
            days,
            startLocalDate:
              days === 7
                ? '2026-09-24'
                : days === 14
                  ? '2026-09-17'
                  : '2026-09-01',
            endLocalDate: '2026-09-30',
            checkedInDays: 4,
            totalDays: days,
            distribution: {
              GREAT: 0,
              GOOD: 2,
              OKAY: 1,
              LOW: 1,
              VERY_LOW: 0,
            },
          })),
          label: 'SELF_REPORTED_EMOTION',
          interpretation: 'FACTUAL_COUNTS_NOT_DIAGNOSIS_OR_RECOVERY',
        },
      })
      return
    }
    if (url.pathname === '/api/emotion-check-ins') {
      await route.fulfill({
        status: 200,
        json: {
          items: entries,
          page: { limit: 30, hasMore: false },
          label: 'SELF_REPORTED_EMOTION',
          interpretation: 'NOT_DIAGNOSIS_OR_RECOVERY',
        },
      })
      return
    }
    await route.abort()
  })

  await page.goto('/analytics')
  await page.getByRole('button', { name: 'Xem chi tiết' }).click()

  const dialog = page.getByRole('dialog', { name: 'Tiến trình cảm xúc' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByText('4/7 ngày')).toBeVisible()
  await expect(
    dialog.getByRole('button', {
      name: /25 tháng 9, chưa ghi nhận/i,
    }),
  ).toBeVisible()
  await expect(
    dialog.getByText('ghi chú riêng tư không được hiển thị'),
  ).toHaveCount(0)
  await expect(dialog.getByText(/trung bình/i)).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: '90 ngày' })).toHaveCount(0)

  await dialog.getByRole('button', { name: '14 ngày' }).click()
  await expect(dialog.getByText('4/14 ngày')).toBeVisible()
})
