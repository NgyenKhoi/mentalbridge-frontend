import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { expect, type Page } from '@playwright/test'

import { homeWorld, installHomeMocks } from './home-next-step-mocks'
import { test } from './test-fixtures'

// mam-guide design §5 (phase 1): Mầm leads a new mild-pathway user one step at a time.

// The USER accounts the fixtures sign in with (as in seedOnboardingSeen).
const ACCOUNTS = [1, 4, 5, 7].map(
  (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
)
const FRAMES = process.env.MAM_GUIDE_FRAMES

const guide = (page: Page) => page.locator('[data-mam-bubble="guide"]')

async function seedGuide(
  page: Page,
  pending: { after: string; next: string | null },
) {
  await page.addInitScript(
    ({ ids, value }) => {
      for (const id of ids)
        window.localStorage.setItem(`mb:mam-guide:v1:${id}`, value)
    },
    {
      ids: ACCOUNTS,
      value: JSON.stringify({
        version: 1,
        startedAt: '2026-11-26T08:00:00.000Z',
        done:
          pending.after === 'journal'
            ? { journal: '2026-11-26T08:05:00.000Z' }
            : {},
        declined: {},
        pending,
        unwindKind: null,
        plan: 'PLUS',
        graduatedAt: null,
      }),
    },
  )
}

/** Motion frames for the UI gate: 0, 120 and 300 ms after a trigger. */
async function frames(page: Page, name: string, trigger?: () => Promise<void>) {
  // The trigger always runs (it may be the navigation); only the captures need FRAMES.
  if (!FRAMES) return trigger?.()
  mkdirSync(FRAMES, { recursive: true })
  if (trigger) await trigger()
  for (const ms of [0, 120, 300]) {
    if (ms) await page.waitForTimeout(ms === 120 ? 120 : 180)
    await page.screenshot({ path: join(FRAMES, `${name}-${ms}ms.png`) })
  }
}

test.describe('Mầm guide', () => {
  test.use({ timezoneId: 'Asia/Ho_Chi_Minh' })
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'The guide journey uses browser-owned fixtures only.',
  )

  test('after a mild result Mầm tells, then offers one step and leads to the journal', async ({
    page,
  }) => {
    await installHomeMocks(page, homeWorld('do-today'))
    await seedGuide(page, { after: 'result', next: 'journal' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await frames(page, 'result-enter', () =>
      page.goto('/dashboard').then(() => undefined),
    )

    await expect(guide(page)).toContainText('Mầm đọc kết quả của bạn rồi nè.')
    // A story moves on by itself after its reading time (4–9 s).
    await expect(guide(page)).toContainText(
      'Bạn không cần hiểu hết web này đâu.',
      {
        timeout: 12_000,
      },
    )
    await frames(page, 'result-next', () =>
      guide(page).getByRole('button', { name: 'Tiếp' }).click(),
    )
    // One line per press: the third line, then the question.
    await expect(guide(page)).toContainText('Dạo này bạn hơi mệt trong lòng')
    await guide(page)
      .getByRole('button', { name: 'Tiếp, câu 3 trên 4' })
      .click()
    const primary = guide(page).getByRole('link', {
      name: 'Viết nhật ký cùng Mầm',
    })
    await expect(primary).toBeVisible()
    await expect(
      guide(page).getByRole('button', { name: 'Để sau đi' }),
    ).toBeVisible()
    for (const width of [1280, 768, 375]) {
      await page.setViewportSize({ width, height: 900 })
      if (FRAMES)
        await page.screenshot({ path: join(FRAMES, `result-ask-${width}.png`) })
      // The bubble glides to its new anchor after a resize: wait for it to settle inside.
      await expect
        .poll(async () => {
          const box = await guide(page).boundingBox()
          return Boolean(box && box.x >= 0 && box.x + box.width <= width)
        })
        .toBe(true)
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    await primary.click()
    await expect(page).toHaveURL(/\/journal/)
    await expect(guide(page)).toHaveCount(0)
  })

  test('after the first journal Mầm asks both consents in one bubble and records only what was ticked', async ({
    page,
  }) => {
    const posted: unknown[] = []
    await installHomeMocks(page, homeWorld('do-today'))
    await page.route('**/api/care/consents', (route) =>
      route.fulfill({ json: { decisions: [] } }),
    )
    await page.route('**/api/care/ai-processing-disclosure', (route) =>
      route.fulfill({
        json: { title: 'AI trò chuyện', content: 'Thông tin xử lý AI.' },
      }),
    )
    await page.route('**/api/care/ai-context-processing-disclosure', (route) =>
      route.fulfill({
        json: {
          title: 'AI dùng bối cảnh',
          content: 'Thông tin AI dùng bối cảnh.',
        },
      }),
    )
    await page.route('**/api/care/consent-decisions', async (route) => {
      const body = route.request().postDataJSON()
      posted.push(body)
      await route.fulfill({
        status: 201,
        json: {
          decisionId: '30000000-0000-4000-8000-000000000001',
          ...body,
          decidedAt: '2026-11-26T08:06:00Z',
        },
      })
    })
    await seedGuide(page, { after: 'journal', next: 'chat' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/dashboard')

    const agree = guide(page).getByRole('button', { name: 'Đồng ý' })
    await expect(agree).toBeDisabled()
    await expect(guide(page)).toContainText(
      'Bạn cần tick ô đầu tiên để dùng AI nhé.',
    )
    if (FRAMES)
      await page.screenshot({ path: join(FRAMES, 'consent-1440.png') })
    await frames(page, 'consent-tick', () =>
      guide(page)
        .getByLabel('Cho AI xử lý nội dung bạn vừa viết để trả lời')
        .check(),
    )
    await agree.click()
    await expect(guide(page)).toContainText(
      'Mầm thấy bạn vừa viết xong rồi nè.',
    )
    expect(posted).toEqual([
      {
        consentType: 'AI_PROCESSING',
        policyVersion: 'ai-processing-capstone-v2',
        granted: true,
      },
    ])
    await guide(page).getByRole('button', { name: 'Tiếp' }).click()
    await expect(guide(page)).toContainText('Dám viết ra hết như vậy')
    await guide(page)
      .getByRole('button', { name: 'Tiếp, câu 3 trên 4' })
      .click()
    await expect(
      guide(page).getByRole('link', { name: 'Kể tiếp đi' }),
    ).toHaveAttribute('href', '/ai-companion?opening=FROM_JOURNAL')
  })

  test('reduced motion still walks the sequence', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await installHomeMocks(page, homeWorld('do-today'))
    await seedGuide(page, { after: 'result', next: 'journal' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await frames(page, 'result-reduced', () =>
      page.goto('/dashboard').then(() => undefined),
    )
    await expect(guide(page)).toContainText('Mầm đọc kết quả của bạn rồi nè.')
    await expect(guide(page)).toContainText(
      'Bạn không cần hiểu hết web này đâu.',
      {
        timeout: 12_000,
      },
    )
  })
})
