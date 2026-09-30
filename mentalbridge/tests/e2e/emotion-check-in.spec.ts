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

test('analytics shows one responsive dashboard without private notes or duplicate fetches', async ({
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

  let analyticsRequests = 0
  await page.route('**/api/analytics?**', async (route) => {
    analyticsRequests += 1
    const requestedRange = Number(
      new URL(route.request().url()).searchParams.get('range'),
    )
    expect([7, 30, 90]).toContain(requestedRange)
    const start = new Date('2026-09-30T00:00:00.000Z')
    start.setUTCDate(start.getUTCDate() - requestedRange + 1)
    const daily = Array.from({ length: requestedRange }, (_, index) => {
      const date = new Date(start)
      date.setUTCDate(date.getUTCDate() + index)
      const localDate = date.toISOString().slice(0, 10)
      const isEmotion = [
        '2026-09-24',
        '2026-09-26',
        '2026-09-28',
        '2026-09-29',
      ].includes(localDate)
      return {
        localDate,
        assessments: localDate === '2026-09-29' ? 4 : 0,
        journals: localDate === '2026-09-29' ? 1 : 0,
        emotions: isEmotion ? 1 : 0,
        emotionLevel:
          localDate === '2026-09-24' || localDate === '2026-09-29'
            ? 4
            : localDate === '2026-09-26'
              ? 3
              : localDate === '2026-09-28'
                ? 2
                : null,
        supportCompleted: 0,
        supportSkipped: 0,
        appointments: 0,
        total: (localDate === '2026-09-29' ? 5 : 0) + (isEmotion ? 1 : 0),
      }
    })
    await route.fulfill({
      status: 200,
      json: {
        asOfLocalDate: '2026-09-30',
        startLocalDate: daily[0].localDate,
        timezone: 'Asia/Ho_Chi_Minh',
        summary: {
          totalActivities: 9,
          activeDays: 4,
          assessmentSubmissions: 4,
          journalEntries: 1,
          journalActiveDays: 1,
          emotionCheckIns: 4,
          emotionActiveDays: 4,
          supportCompleted: 0,
          supportSkipped: 0,
          appointmentEvents: 0,
          currentEmotionStreak: 0,
          latestAssessmentInstrument: 'PHQ9',
          latestAssessmentSubmittedAt: '2026-09-29T02:00:00.000Z',
        },
        daily,
        sources: {
          assessments: 'available',
          journals: 'available',
          emotions: 'available',
          supportPlans: 'empty',
          appointments: 'empty',
        },
        partial: false,
        bounded: {
          windowDays: requestedRange,
          assessmentLimit: 50,
          journalLimit: 50,
          emotionLimit: 90,
          appointmentLimit: 100,
        },
      },
    })
  })

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
  await expect(page.getByText('Chuỗi ghi nhận cảm xúc')).toBeVisible()
  await expect(page.getByText('4/30 ngày có ghi nhận')).toBeVisible()
  await expect(page.getByText('Gần nhất: PHQ-9 · 29/09/2026')).toBeVisible()
  await expect(page.getByText(/trung bình tâm trạng/i)).toHaveCount(0)
  await expect(page.getByText(/tích cực hơn/i)).toHaveCount(0)
  await expect(
    page.getByRole('img', {
      name: 'Bản đồ nhiệt hoạt động từng ngày trong 30 ngày',
    }),
  ).toBeVisible()
  await expect(
    page.getByText('ghi chú riêng tư không được hiển thị'),
  ).toHaveCount(0)
  await expect(page.getByText(/Tạm gián đoạn|Đã tải/)).toHaveCount(0)
  await expect(page.getByText('Số ngày có ghi nhận')).toHaveCount(0)

  await page.getByRole('button', { name: '7 ngày' }).click()
  await expect(page).toHaveURL(/range=7/)
  await expect(
    page.getByRole('img', { name: 'Biểu đồ cột chồng hoạt động trong 7 ngày' }),
  ).toBeVisible()
  await page.getByRole('button', { name: '90 ngày' }).click()
  await expect(page).toHaveURL(/range=90/)
  await expect(
    page.getByRole('img', {
      name: 'Bản đồ nhiệt hoạt động từng ngày trong 90 ngày',
    }),
  ).toBeVisible()

  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 })
    const layout = await page
      .locator('.analytics-page')
      .evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        rect: element.getBoundingClientRect().toJSON(),
        computed: {
          boxSizing: getComputedStyle(element).boxSizing,
          width: getComputedStyle(element).width,
          padding: getComputedStyle(element).padding,
          overflow: getComputedStyle(element).overflow,
        },
        directChildren: Array.from(element.children).map((child) => ({
          className: child.className,
          clientWidth: (child as HTMLElement).clientWidth,
          scrollWidth: (child as HTMLElement).scrollWidth,
          rect: child.getBoundingClientRect().toJSON(),
        })),
        internallyOverflowingChildren: Array.from(
          element.querySelectorAll<HTMLElement>('*'),
        )
          .filter((child) => child.scrollWidth > child.clientWidth + 1)
          .slice(0, 10)
          .map((child) => ({
            className: child.className,
            clientWidth: child.clientWidth,
            scrollWidth: child.scrollWidth,
            overflow: getComputedStyle(child).overflow,
          })),
        overflowingChildren: Array.from(
          element.querySelectorAll<HTMLElement>('*'),
        )
          .filter(
            (child) =>
              child.getBoundingClientRect().right >
              element.getBoundingClientRect().right + 1,
          )
          .slice(0, 5)
          .map((child) => ({
            className: child.className,
            right: child.getBoundingClientRect().right,
            scrollWidth: child.scrollWidth,
          })),
      }))
    expect(
      layout.scrollWidth <= layout.clientWidth + 1,
      `analytics content overflows at ${width}px: ${JSON.stringify(layout)}`,
    ).toBe(true)
  }
  expect(analyticsRequests).toBe(3)
})
