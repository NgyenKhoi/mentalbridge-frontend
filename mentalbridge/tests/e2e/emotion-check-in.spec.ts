import { expect, type BrowserContext, type Route } from '@playwright/test'
import { test } from './test-fixtures'

type StoredCheckIn = {
  id: string
  localDate: string
  timezone: string
  emotion: 'GREAT' | 'GOOD' | 'OKAY' | 'LOW' | 'VERY_LOW'
  intensity: number
  note: null
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
  expect(createKeys).toHaveLength(2)
  expect(createKeys[0]).toBe(createKeys[1])

  await page.reload()
  await expect(
    page.getByRole('radio', { name: 'Tốt', exact: true }),
  ).toBeChecked()
  await page.getByText('Rất tốt', { exact: true }).click()
  await page.getByRole('button', { name: 'Cập nhật ghi nhận' }).click()
  await expect(page.getByText('Đã cập nhật ghi nhận hôm nay.')).toBeVisible()
  const finalStored = readStored()
  expect(finalStored).not.toBeNull()
  expect(finalStored?.emotion).toBe('GREAT')
  expect(finalStored?.revision).toBe(2)
})
