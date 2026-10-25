import { expect } from '@playwright/test'
import { test } from './test-fixtures'
import type { EmotionCheckIn } from '../../lib/emotion-check-in/contract'
import {
  emotionCompletionFixture,
  emotionOccurrenceFixture,
  nativeSupportPlanFixture,
} from '../../features/support-plan/testing/native-support-plan-fixture'

test.describe('MB-641 canonical Emotion action', () => {
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'Controlled origin/evidence states must not mutate shared accounts.',
  )

  test('returns to the exact action and checks completion once from owner evidence', async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(90_000)
    // Let Date.now advance: freezing it also freezes GSAP's animation ticker.
    await page.clock.install({ time: new Date('2026-10-13T13:00:00Z') })
    await context.addCookies([
      {
        name: 'mentalbridge_access',
        value: 'synthetic-mb273-e2e-access',
        url: 'http://127.0.0.1:3100',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])
    const plan = nativeSupportPlanFixture()
    let occurrence = emotionOccurrenceFixture()
    let checkIn: EmotionCheckIn | null = null
    let source: 'RECORDED' | 'MISSING' | 'DELETED' = 'MISSING'
    let unavailable = false
    let saveAttempts = 0
    let checks = 0
    const saveKeys: string[] = []
    const runtimeErrors: string[] = []
    page.on('pageerror', (error) => runtimeErrors.push(error.message))
    await page.route('**/api/**', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      const path = url.pathname
      const json = (body: unknown, status = 200) =>
        route.fulfill({
          status,
          contentType: 'application/json',
          body: JSON.stringify(body),
        })
      const problem = (status: number, code: string) =>
        json(
          {
            type: 'about:blank',
            title: 'Controlled test response',
            status,
            code,
            correlationId: '62cda42f-b286-43c6-aa48-88ef64ff3361',
          },
          status,
        )
      if (path === '/api/care/v2/support-plans/current') return json(plan)
      if (path === '/api/care/v2/support-plans/current-draft')
        return problem(404, 'SUPPORT_PLAN_NOT_FOUND')
      if (path === '/api/care/v2/support-plans/history')
        return json({ items: [], hasMore: false, nextCursor: null })
      if (path === '/api/care/v2/support-plan-occurrences') {
        // The plan reads its 7+7 day window; the dashboard reads one exact day.
        expect(['2026-10-07..2026-10-20', '2026-10-13..2026-10-13']).toContain(
          `${url.searchParams.get('from')}..${url.searchParams.get('through')}`,
        )
        return json({
          supportPlanId: plan.supportPlanId,
          supportPlanStatus: 'ACTIVE',
          representationMode: 'NATIVE_V3',
          from: url.searchParams.get('from'),
          through: url.searchParams.get('through'),
          occurrences: [occurrence],
          interpretationCode:
            'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
        })
      }
      if (
        path ===
        `/api/care/v2/support-plan-occurrences/${occurrence.occurrenceId}/emotion-check-in/reconcile`
      ) {
        expect(request.method()).toBe('POST')
        expect(request.postData() ?? '').toBe('')
        checks++
        if (unavailable)
          return problem(503, 'EMOTION_CHECK_IN_EVIDENCE_UNAVAILABLE')
        if (source === 'RECORDED' && occurrence.state !== 'COMPLETED')
          occurrence = {
            ...occurrence,
            state: 'COMPLETED',
            displayState: 'COMPLETED',
            version: 1,
            completionEvidence: emotionCompletionFixture(),
            outcomeRecordedAt: '2026-10-13T13:01:00Z',
          }
        return json({
          schemaVersion: 'emotion-check-in-occurrence-reconciliation-v1',
          occurrenceId: occurrence.occurrenceId,
          actionId: occurrence.actionId,
          localDate: occurrence.localDate,
          sourceState: source,
          occurrenceState: occurrence.state,
          version: occurrence.version,
          completionEvidence: occurrence.completionEvidence,
          completedAt: occurrence.outcomeRecordedAt,
        })
      }
      if (path === '/api/care/guided-journey')
        return problem(503, 'CARE_UNAVAILABLE')
      if (path.startsWith('/api/care/v2/'))
        throw new Error(
          `Unexpected native command: ${request.method()} ${path}`,
        )
      if (path === '/api/emotion-check-ins' && request.method() === 'POST') {
        saveAttempts++
        saveKeys.push(request.headers()['idempotency-key'])
        expect(request.postDataJSON()).toMatchObject({
          localDate: '2026-10-13',
          timezone: 'Asia/Ho_Chi_Minh',
          emotion: 'GOOD',
          intensity: 4,
        })
        if (saveAttempts === 1) return problem(503, 'JOURNAL_UNAVAILABLE')
        checkIn = {
          ...request.postDataJSON(),
          id: '70000000-0000-4000-8000-000000000641',
          revision: 1,
          sourceLabel: 'SELF_REPORTED_EMOTION',
          clinicalUse: 'NOT_A_DIAGNOSIS_OR_SAFETY_CLASSIFIER',
          createdAt: '2026-10-13T13:00:00Z',
          recordedAt: '2026-10-13T13:00:00Z',
          updatedAt: '2026-10-13T13:00:00Z',
        }
        source = 'RECORDED'
        return json(checkIn, 201)
      }
      if (path === '/api/emotion-check-ins/2026-10-13')
        return checkIn
          ? json(checkIn)
          : problem(404, 'EMOTION_CHECK_IN_NOT_FOUND')
      if (path === '/api/emotion-check-ins')
        return json({
          items: checkIn ? [checkIn] : [],
          page: {
            limit: Number(url.searchParams.get('limit') ?? 30),
            hasMore: false,
          },
          label: 'SELF_REPORTED_EMOTION',
          interpretation: 'NOT_DIAGNOSIS_OR_RECOVERY',
        })
      if (path === '/api/emotion-check-ins/progress')
        return json({
          asOfLocalDate: '2026-10-13',
          timezone: 'Asia/Ho_Chi_Minh',
          currentEmotion: checkIn?.emotion ?? null,
          currentStreak: checkIn ? 1 : 0,
          longestStreak: checkIn ? 1 : 0,
          label: 'SELF_REPORTED_EMOTION',
          interpretation: 'FACTUAL_COUNTS_NOT_DIAGNOSIS_OR_RECOVERY',
          windows: [7, 14, 30].map((days) => ({
            days,
            totalDays: days,
            startLocalDate:
              days === 7
                ? '2026-10-07'
                : days === 14
                  ? '2026-09-30'
                  : '2026-09-14',
            endLocalDate: '2026-10-13',
            checkedInDays: checkIn ? 1 : 0,
            distribution: {
              GREAT: 0,
              GOOD: checkIn ? 1 : 0,
              OKAY: 0,
              LOW: 0,
              VERY_LOW: 0,
            },
          })),
        })
      if (path.startsWith('/api/emotion-check-ins'))
        throw new Error(
          `Unexpected Emotion command: ${request.method()} ${path}`,
        )
      return route.continue()
    })
    await page.goto('/support-plan')
    const activity = () =>
      page.getByRole('region', { name: 'Check-in cảm xúc', exact: true })
    await expect(activity()).toBeVisible()
    expect(checks).toBe(0)
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [768, 1024],
      [375, 812],
      [640, 400],
    ]) {
      await page.setViewportSize({ width, height })
      await page.evaluate(() => document.fonts.ready)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false)
      expect(
        await page.evaluate(() =>
          document.fonts.check('14px "Be Vietnam Pro"'),
        ),
      ).toBe(true)
      const target = await activity()
        .getByRole('link', { name: 'Ghi lại cảm xúc' })
        .boundingBox()
      expect(target?.height).toBeGreaterThanOrEqual(44)
      await page.screenshot({
        path: testInfo.outputPath(`today-${width}x${height}.png`),
        fullPage: true,
        animations: 'disabled',
      })
    }
    await page.setViewportSize({ width: 1280, height: 800 })
    expect(occurrence.state).toBe('SCHEDULED')
    await activity().getByRole('link', { name: 'Ghi lại cảm xúc' }).click()
    await expect(page).toHaveURL(
      new RegExp(
        `/dashboard\\?occurrenceId=${occurrence.occurrenceId}&actionId=${occurrence.actionId}&localDate=2026-10-13#emotion-check-in`,
      ),
    )
    await expect(
      page
        .locator('#emotion-check-in')
        .getByRole('radio', { name: 'Tốt', exact: true }),
    ).toBeVisible()
    // Playwright visibility does not reject an opacity:0 ancestor. The canonical
    // form must actually be painted after an asynchronous deep-link scroll.
    await expect
      .poll(() =>
        page
          .locator('#emotion-check-in')
          .evaluate((element) => getComputedStyle(element).opacity),
      )
      .toBe('1')
    await page
      .locator('label')
      .filter({ has: page.getByRole('radio', { name: 'Tốt', exact: true }) })
      .click()
    await page
      .locator('label')
      .filter({ has: page.getByRole('radio', { name: '4', exact: true }) })
      .click()
    await page
      .getByRole('banner')
      .getByRole('link', { name: 'Cộng đồng', exact: true })
      .click()
    const leave = page.getByRole('dialog', { name: 'Rời trang khi chưa lưu?' })
    await expect(leave).toBeVisible()
    await leave.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }).click()
    await expect(
      page.getByRole('radio', { name: 'Tốt', exact: true }),
    ).toBeChecked()
    await page
      .getByRole('button', { name: 'Lưu ghi nhận', exact: true })
      .click()
    await expect(
      page.getByText(/Lựa chọn của bạn vẫn được giữ để thử lại/),
    ).toBeVisible()
    await page
      .locator('#emotion-check-in')
      .getByRole('button', { name: 'Thử lại', exact: true })
      .click()
    await expect(
      page.getByText('Đã lưu ghi nhận hôm nay.', { exact: true }),
    ).toBeVisible()
    expect(saveKeys[0]).toBeTruthy()
    expect(saveKeys[1]).toBe(saveKeys[0])
    expect(checks).toBe(0)
    expect(occurrence.state).toBe('SCHEDULED')
    await page.screenshot({
      path: testInfo.outputPath('canonical-emotion-saved.png'),
      fullPage: true,
      animations: 'disabled',
    })
    await page
      .getByRole('link', { name: 'Quay lại hoạt động trong kế hoạch' })
      .click()
    const done = page.getByRole('region', { name: 'Đã ghi nhận hôm nay' })
    await expect(done).toContainText('Check-in cảm xúc')
    await expect(done).toContainText('Đã xong')
    expect(checks).toBe(1)
    expect(occurrence.state).toBe('COMPLETED')
    await page.reload()
    await expect(done).toContainText('Đã xong')
    // Accepted completion is not re-checked on every reload.
    expect(checks).toBe(1)
    unavailable = true
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.getByRole('tab', { name: 'Tiến triển' }).click()
    await expect(
      page.getByRole('definition').filter({ hasText: '1 ngày' }).first(),
    ).toBeVisible()
    await expect(page.locator('.mbw-page')).not.toContainText('%')
    expect(occurrence.version).toBe(1)
    expect(runtimeErrors).toEqual([])
  })
})
