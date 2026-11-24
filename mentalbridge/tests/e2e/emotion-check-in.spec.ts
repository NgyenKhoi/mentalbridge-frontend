import { expect, type BrowserContext, type Route } from '@playwright/test'
import { test } from './test-fixtures'
import { homeWorld, installHomeMocks } from './home-next-step-mocks'

type StoredCheckIn = {
  id: string
  localDate: string
  timezone: string
  emotion: 'GREAT' | 'GOOD' | 'OKAY' | 'LOW' | 'VERY_LOW'
  intensity: number
  factors: (
    'sleep' | 'work' | 'study' | 'family' | 'friends' | 'health' | 'other'
  )[]
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

test('dashboard and Resources share, update, reload, and delete the persisted daily emotion', async ({
  context,
  page,
}, testInfo) => {
  await authenticated(context)
  await installHomeMocks(page, homeWorld('first-use'))

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
        factors: StoredCheckIn['factors']
        note: string | null
      }
      const now = '2026-09-26T02:00:00.000Z'
      stored = {
        id: '40000000-0000-4000-8000-000000000001',
        localDate: body.localDate,
        timezone: body.timezone,
        emotion: body.emotion,
        intensity: body.intensity,
        factors: body.factors,
        note: body.note,
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
        factors: StoredCheckIn['factors']
        note: string | null
      }
      stored = {
        ...stored,
        emotion: body.emotion,
        intensity: body.intensity,
        factors: body.factors,
        note: body.note,
        revision: 2,
        updatedAt: '2026-09-26T03:00:00.000Z',
      }
      await route.fulfill({ status: 200, json: stored })
      return
    }

    if (method === 'DELETE' && stored) {
      expect(localDate).toBe(stored.localDate)
      expect(request.headers()['idempotency-key']).toMatch(/^emotion-check-in-/)
      const deletedDate = stored.localDate
      stored = null
      await route.fulfill({
        status: 200,
        json: {
          localDate: deletedDate,
          deleted: true,
          deletedAt: '2026-09-26T04:00:00.000Z',
        },
      })
      return
    }

    await route.abort()
  }

  await page.route('**/api/emotion-check-ins**', handle)
  await page.route('**/api/resources**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/resources/progress') {
      await route.fulfill({ status: 200, json: { items: [] } })
      return
    }
    if (url.pathname === '/api/resources/journey') {
      await route.fulfill({
        status: 409,
        contentType: 'application/problem+json',
        body: JSON.stringify(
          problem(409, 'ACTIVE_SUPPORT_PLAN_REQUIRED', 'Plan required'),
        ),
      })
      return
    }
    await route.fulfill({
      status: 200,
      json: {
        items: [
          {
            id: '00000000-0000-4000-8000-000000000215',
            category: 'BREATHING',
            resourceKind: 'PRACTICE',
            interactionType: 'BREATHING_PACER',
            repeatability: 'REPEATABLE',
            completionMode: 'EXPLICIT',
            streakEligible: true,
            expectedDurationMinutes: 4,
            cooldownDays: 0,
            recommendedFrequencyPerWeek: 5,
            planTags: ['ANXIETY_SYMPTOMS'],
            locale: 'vi-VN',
            title: 'Nhịp thở chậm',
            summary: 'Một bài thực hành dịu dàng để trở về với hiện tại.',
            sourceOrganization: 'MentalBridge Content Review',
            status: 'PUBLISHED',
            reviewedAt: '2026-09-20T00:00:00.000Z',
            createdAt: '2026-09-01T00:00:00.000Z',
          },
        ],
        hasMore: false,
      },
    })
  })
  await page.goto('/dashboard')
  const dailyEmotionCard = page.locator('#emotion-check-in')
  await expect(
    dailyEmotionCard.getByRole('group', { name: 'Cảm xúc hôm nay' }),
  ).toBeVisible()
  await expect(dailyEmotionCard.getByRole('radio')).toHaveCount(5)
  await expect(
    dailyEmotionCard.getByRole('radio', { checked: true }),
  ).toHaveCount(0)
  await expect(
    dailyEmotionCard.getByRole('group', { name: 'Mức độ cảm nhận' }),
  ).toHaveCount(0)
  await expect(
    dailyEmotionCard.getByRole('button', { name: 'Lưu ghi nhận' }),
  ).toBeDisabled()

  await page
    .locator('#emotion-check-in')
    .getByText('Tốt', { exact: true })
    .click()
  await page
    .locator('#emotion-check-in')
    .getByText('4', { exact: true })
    .click()
  await page
    .getByText('Thêm bối cảnh riêng tư (không bắt buộc)', { exact: true })
    .click()
  await page.getByRole('checkbox', { name: 'Giấc ngủ' }).locator('..').click()
  await page.getByRole('checkbox', { name: 'Công việc' }).locator('..').click()
  await page.getByLabel('Ghi chú riêng (không bắt buộc)').fill('Một ngày dài')
  await page.getByRole('button', { name: 'Lưu ghi nhận' }).click()
  await expect(
    page.locator('#emotion-check-in').getByRole('alert'),
  ).toContainText('Chưa thể lưu')
  await expect(
    page.getByRole('radio', { name: 'Tốt', exact: true }),
  ).toBeChecked()
  await page.getByRole('button', { name: 'Thử lại' }).click()
  await expect(page.getByText('Đã lưu ghi nhận hôm nay.')).toBeVisible()
  await expect(page.locator('.ref-panel-progress')).toHaveCount(0)
  expect(createKeys).toHaveLength(2)
  expect(createKeys[0]).toBe(createKeys[1])

  await page.setViewportSize({ width: 1440, height: 1100 })
  await dailyEmotionCard.screenshot({
    path: testInfo.outputPath('emotion-context-desktop.png'),
  })
  await page.setViewportSize({ width: 390, height: 844 })
  const dashboardWidth = await page.locator('main').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(dashboardWidth.scrollWidth).toBeLessThanOrEqual(
    dashboardWidth.clientWidth + 1,
  )
  await dailyEmotionCard.screenshot({
    path: testInfo.outputPath('emotion-context-mobile.png'),
  })
  await page.setViewportSize({ width: 1440, height: 900 })

  await page.reload()
  await expect(
    page.getByRole('radio', { name: 'Tốt', exact: true }),
  ).toBeChecked()
  await page
    .getByText('Thêm bối cảnh riêng tư (không bắt buộc)', { exact: true })
    .click()
  await expect(page.getByRole('checkbox', { name: 'Giấc ngủ' })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Công việc' })).toBeChecked()
  await expect(page.getByLabel('Ghi chú riêng (không bắt buộc)')).toHaveValue(
    'Một ngày dài',
  )
  await page.getByRole('checkbox', { name: 'Giấc ngủ' }).locator('..').click()
  await page.getByRole('checkbox', { name: 'Công việc' }).locator('..').click()
  await page.getByLabel('Ghi chú riêng (không bắt buộc)').fill('')
  await page
    .locator('#emotion-check-in')
    .getByText('Rất tốt', { exact: true })
    .click()
  await page.getByRole('button', { name: 'Cập nhật ghi nhận' }).click()
  await expect(page.getByText('Đã cập nhật ghi nhận hôm nay.')).toBeVisible()
  await page
    .getByRole('button', { name: 'Chỉnh sửa ghi nhận', exact: true })
    .click()
  await expect(
    page.getByRole('radio', { name: 'Rất tốt', exact: true }),
  ).toBeChecked()

  await context.clearCookies()
  await authenticated(context)
  await page.reload()
  await expect(
    page.getByRole('radio', { name: 'Rất tốt', exact: true }),
  ).toBeChecked()
  await page
    .getByText('Thêm bối cảnh riêng tư (không bắt buộc)', { exact: true })
    .click()
  await expect(page.getByRole('checkbox', { checked: true })).toHaveCount(0)
  await expect(page.getByLabel('Ghi chú riêng (không bắt buộc)')).toHaveValue(
    '',
  )

  await page.goto('/resources')
  const emotionCard = page.getByRole('region', {
    name: 'Cảm xúc đã ghi hôm nay',
  })
  await expect(emotionCard.getByText('Rất tốt', { exact: true })).toBeVisible()
  await expect(emotionCard.getByText(/Múi giờ/)).toBeVisible()
  await page.setViewportSize({ width: 1440, height: 1400 })
  await emotionCard.screenshot({
    path: testInfo.outputPath('resources-emotion-desktop.png'),
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(emotionCard).toBeVisible()
  const resourcesWidth = await page.locator('main').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  expect(resourcesWidth.scrollWidth).toBeLessThanOrEqual(
    resourcesWidth.clientWidth + 1,
  )
  await emotionCard.screenshot({
    path: testInfo.outputPath('resources-emotion-mobile.png'),
  })

  await page.goto('/dashboard')
  await page
    .locator('#emotion-check-in')
    .getByRole('button', { name: 'Xóa ghi nhận' })
    .click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Xóa ghi nhận' })
    .click()
  await expect(page.getByText('Đã xóa ghi nhận cảm xúc hôm nay.')).toBeVisible()
  await expect(page.locator('.ref-panel-progress')).toHaveCount(0)
  await page.goto('/resources')
  await expect(
    page.getByText('Hôm nay chưa có ghi nhận cảm xúc.'),
  ).toBeVisible()
  await expect(emotionCard.getByText('Rất tốt', { exact: true })).toHaveCount(0)
  const finalStored = readStored()
  expect(finalStored).toBeNull()
})
