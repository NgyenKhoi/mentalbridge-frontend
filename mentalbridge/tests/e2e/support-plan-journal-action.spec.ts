import { expect } from '@playwright/test'
import { test } from './test-fixtures'
import type {
  JournalEntry,
  JournalSummary,
} from '../../lib/journal/journal-contract'
import { journalPlanHref } from '../../features/support-plan/journal-plan-origin'
import {
  journalCompletionFixture,
  journalDay,
  journalEntryId,
  journalOccurrenceFixture,
  journalSupportPlanFixture,
} from '../../features/support-plan/testing/journal-support-plan-fixture'

test.describe('MB-642 canonical Journal action', () => {
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'Controlled Journal/evidence states must not mutate shared accounts.',
  )

  test('keeps writing private, returns the saved ID and checks completion once on return', async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(120_000)
    await page.clock.install({ time: new Date(`${journalDay}T12:06:00Z`) })
    await context.addCookies([
      {
        name: 'mentalbridge_access',
        value: 'synthetic-mb273-e2e-access',
        url: 'http://127.0.0.1:3100',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])
    const plan = journalSupportPlanFixture()
    let occurrence = journalOccurrenceFixture()
    let entry: JournalEntry | null = null
    let source: 'RECORDED' | 'MISSING' | 'DELETED' = 'MISSING'
    let unavailable = false
    let saveAttempts = 0
    let checks = 0
    let revisions = 0
    let releaseFirstSave: (() => void) | undefined
    const firstSaveGate = new Promise<void>((resolve) => {
      releaseFirstSave = resolve
    })
    const saveKeys: string[] = []
    const clientEntryIds: string[] = []
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
      if (path.startsWith('/api/care/')) {
        // Private writing, mood and tags belong only to Journal, never to Care.
        expect(request.postData() ?? '').not.toMatch(
          /synthetic private|content|mood|tags/,
        )
      }
      if (path === '/api/care/v2/support-plans/current') return json(plan)
      if (path === '/api/care/v2/support-plans/current-draft')
        return problem(404, 'SUPPORT_PLAN_NOT_FOUND')
      if (path === '/api/care/v2/support-plans/history')
        return json({ items: [], hasMore: false, nextCursor: null })
      if (path === '/api/care/v2/support-plan-occurrences') {
        const from = url.searchParams.get('from') ?? ''
        const through = url.searchParams.get('through') ?? ''
        // The plan reads a window around today; Journal resolves one exact day.
        expect(from <= journalDay && journalDay <= through).toBe(true)
        return json({
          supportPlanId: plan.supportPlanId,
          supportPlanStatus: 'ACTIVE',
          representationMode: 'NATIVE_V3',
          from,
          through,
          occurrences: [occurrence],
          interpretationCode:
            'SELF_REPORTED_WELLBEING_ACTIVITY_NOT_TREATMENT_ADHERENCE',
        })
      }
      if (
        path ===
        `/api/care/v2/support-plan-occurrences/${occurrence.occurrenceId}/journal/reconcile`
      ) {
        expect(request.method()).toBe('POST')
        expect(request.postDataJSON()).toEqual({ journalId: journalEntryId })
        checks++
        if (unavailable)
          return problem(503, 'JOURNAL_ENTRY_EVIDENCE_UNAVAILABLE')
        if (source === 'RECORDED' && occurrence.state !== 'COMPLETED')
          occurrence = {
            ...occurrence,
            state: 'COMPLETED',
            displayState: 'COMPLETED',
            version: 1,
            completionEvidence: journalCompletionFixture(),
            outcomeRecordedAt: `${journalDay}T12:07:00Z`,
          }
        return json({
          schemaVersion: 'journal-entry-occurrence-reconciliation-v1',
          occurrenceId: occurrence.occurrenceId,
          actionId: occurrence.actionId,
          localDate: occurrence.localDate,
          journalId: journalEntryId,
          sourceState: source,
          occurrenceState: occurrence.state,
          version: occurrence.version,
          completedAt: occurrence.outcomeRecordedAt,
          completionEvidence: occurrence.completionEvidence,
        })
      }
      if (path === '/api/care/guided-journey')
        return problem(503, 'CARE_UNAVAILABLE')
      if (path.startsWith('/api/care/v2/'))
        throw new Error(
          `Unexpected native command: ${request.method()} ${path}`,
        )
      if (path === '/api/journals' && request.method() === 'POST') {
        saveAttempts++
        const body = request.postDataJSON()
        expect(Object.keys(body).sort()).toEqual([
          'clientEntryId',
          'content',
          'mood',
          'occurredAt',
          'tags',
        ])
        expect(body).toMatchObject({
          content: { text: 'synthetic private Journal writing' },
          mood: 'GOOD',
          tags: ['synthetic'],
        })
        saveKeys.push(request.headers()['idempotency-key'])
        clientEntryIds.push(body.clientEntryId)
        if (saveAttempts === 1) {
          await firstSaveGate
          return problem(503, 'JOURNAL_MUTATION_OUTCOME_UNKNOWN')
        }
        // The returned owner ID, not a guessed client ID, is the candidate.
        entry = {
          id: journalEntryId,
          ownerAccountId: '10000000-0000-4000-8000-000000000001',
          currentRevision: 1,
          occurredAt: body.occurredAt,
          createdAt: `${journalDay}T12:06:00Z`,
          updatedAt: `${journalDay}T12:06:00Z`,
          deleted: false,
          tags: body.tags,
          mood: body.mood,
          encryption: {
            algorithm: 'AES-256-GCM',
            keyId: 'test-v1',
            encryptedAt: `${journalDay}T12:06:00Z`,
          },
          analysisState: 'not_requested',
          content: {
            text: body.content.text,
            byteLength: new TextEncoder().encode(body.content.text).byteLength,
          },
        }
        source = 'RECORDED'
        return json(entry, 201)
      }
      if (path === '/api/journals' && request.method() === 'GET') {
        const summary: JournalSummary[] = entry
          ? [
              {
                ...entry,
                content: {
                  preview: entry.content.text,
                  byteLength: entry.content.byteLength,
                },
              },
            ]
          : []
        return json({ items: summary, page: { limit: 20, hasMore: false } })
      }
      if (path === `/api/journals/${journalEntryId}`) {
        if (request.method() === 'GET')
          return entry ? json(entry) : problem(404, 'JOURNAL_NOT_FOUND')
        if (request.method() === 'PATCH' && entry) {
          revisions++
          const body = request.postDataJSON()
          entry = {
            ...entry,
            currentRevision: entry.currentRevision + 1,
            updatedAt: `${journalDay}T12:08:00Z`,
            mood: body.mood,
            tags: body.tags,
            content: {
              text: body.content.text,
              byteLength: new TextEncoder().encode(body.content.text)
                .byteLength,
            },
          }
          return json(entry)
        }
      }
      if (path.startsWith('/api/journals'))
        throw new Error(
          `Unexpected Journal/AI command: ${request.method()} ${path}`,
        )
      return route.continue()
    })

    await page.goto('/support-plan')
    const activity = () =>
      page.getByRole('region', { name: 'Viết một suy nghĩ ngắn', exact: true })
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
      expect(
        (
          await activity()
            .getByRole('link', { name: 'Viết vài dòng' })
            .boundingBox()
        )?.height,
      ).toBeGreaterThanOrEqual(44)
      await page.screenshot({
        path: testInfo.outputPath(`journal-today-${width}x${height}.png`),
        fullPage: true,
        animations: 'disabled',
      })
    }
    await page.setViewportSize({ width: 375, height: 812 })
    await activity().getByRole('link', { name: 'Viết vài dòng' }).click()
    const editor = page.getByRole('dialog', {
      name: 'Viết nhật ký',
      exact: true,
    })
    await expect(editor).toBeVisible()
    await expect(
      editor.getByRole('heading', { name: 'Viết nhật ký', exact: true }),
    ).toBeFocused()
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [768, 1024],
      [375, 812],
      [640, 400],
    ]) {
      await page.setViewportSize({ width, height })
      const save = editor.getByRole('button', {
        name: 'Lưu nhật ký',
        exact: true,
      })
      await save.scrollIntoViewIfNeeded()
      expect((await save.boundingBox())?.height).toBeGreaterThanOrEqual(44)
      expect(
        await save.evaluate((button) => {
          const rect = button.getBoundingClientRect()
          const top = document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          )
          return top === button || (top !== null && button.contains(top))
        }),
      ).toBe(true)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false)
      await page.screenshot({
        path: testInfo.outputPath(`journal-editor-${width}x${height}.png`),
        fullPage: true,
        animations: 'disabled',
      })
    }
    await page.setViewportSize({ width: 375, height: 812 })
    await editor
      .locator('label')
      .filter({ has: page.getByRole('radio', { name: 'Tốt', exact: true }) })
      .click()
    await editor
      .getByLabel('Nội dung', { exact: false })
      .fill('synthetic private Journal writing')
    await editor.locator('#journal-tags-input').fill('synthetic')
    await page.keyboard.press('Escape')
    const leave = page.getByRole('dialog', {
      name: 'Bạn còn nội dung chưa lưu',
    })
    await expect(leave).toBeVisible()
    await leave.getByRole('button', { name: 'Tiếp tục viết' }).click()
    await expect(editor.getByLabel('Nội dung', { exact: false })).toHaveValue(
      'synthetic private Journal writing',
    )
    const writingUrl = page.url()
    await page.evaluate(() => history.back())
    await expect(leave).toBeVisible()
    await leave.getByRole('button', { name: 'Tiếp tục viết' }).click()
    await expect(page).toHaveURL(writingUrl)
    await expect(editor.getByLabel('Nội dung', { exact: false })).toHaveValue(
      'synthetic private Journal writing',
    )
    await editor
      .getByRole('button', { name: 'Lưu nhật ký', exact: true })
      .click()
    await expect(
      editor.getByRole('button', { name: 'Đang lưu…', exact: true }),
    ).toBeDisabled()
    await page.evaluate(() => history.back())
    await expect(page).toHaveURL(writingUrl)
    await expect(editor).toBeVisible()
    await expect(leave).toHaveCount(0)
    releaseFirstSave?.()
    await expect(editor.getByRole('alert')).toBeVisible()
    await expect(editor.getByLabel('Nội dung', { exact: false })).toHaveValue(
      'synthetic private Journal writing',
    )
    await editor
      .getByRole('button', { name: 'Lưu nhật ký', exact: true })
      .click()
    const detail = page.getByRole('dialog', {
      name: 'Chi tiết nhật ký',
      exact: true,
    })
    await expect(detail).toContainText(
      'việc lưu bài chưa tự xác nhận hoàn thành',
    )
    expect(saveKeys[0]).toBeTruthy()
    expect(saveKeys[1]).toBe(saveKeys[0])
    expect(clientEntryIds[1]).toBe(clientEntryIds[0])
    expect(clientEntryIds[0]).not.toBe(journalEntryId)
    expect(checks).toBe(0)
    const returnHref = journalPlanHref(
      {
        source: 'journal',
        occurrenceId: occurrence.occurrenceId,
        actionId: occurrence.actionId,
        localDate: journalDay,
        journalId: journalEntryId,
      },
      '/support-plan',
    )
    await expect(
      detail.getByRole('link', { name: 'Quay lại hoạt động', exact: true }),
    ).toHaveAttribute('href', returnHref)
    await page.screenshot({
      path: testInfo.outputPath('journal-saved-mobile.png'),
      fullPage: true,
      animations: 'disabled',
    })
    // Journal evidence is briefly unavailable when the user comes back.
    unavailable = true
    await detail
      .getByRole('link', { name: 'Quay lại hoạt động', exact: true })
      .click()
    await expect(activity().getByText(/Chưa thực hiện được/)).toBeVisible()
    expect(checks).toBe(1)
    expect(occurrence.state).toBe('SCHEDULED')
    await expect(
      page.getByRole('region', { name: 'Đã ghi nhận hôm nay' }),
    ).toHaveCount(0)
    unavailable = false
    await page.reload()
    const done = page.getByRole('region', { name: 'Đã ghi nhận hôm nay' })
    await expect(done).toContainText('Viết một suy nghĩ ngắn')
    await expect(done).toContainText('Đã xong')
    expect(checks).toBe(2)
    await page.reload()
    await expect(done).toContainText('Đã xong')
    // Accepted completion is never re-checked or rewritten by later visits.
    expect(checks).toBe(2)
    expect(revisions).toBe(0)
    expect(occurrence.version).toBe(1)
    expect(occurrence.completionEvidence?.factRevision).toBe('1')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.screenshot({
      path: testInfo.outputPath('journal-deleted-source-outage.png'),
      fullPage: true,
      animations: 'disabled',
    })
    expect(runtimeErrors).toEqual([])
  })
})
