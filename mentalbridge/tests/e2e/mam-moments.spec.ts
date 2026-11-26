import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { expect, type Page } from '@playwright/test'

import { homeWorld, installHomeMocks } from './home-next-step-mocks'
import { test } from './test-fixtures'

// Owner copy 2026-11-27 (.artifacts/mam-kb2-owner-copy.md): Mầm stays with the user around a booking and
// after a skipped activity. The screens dispatch the moment; here the dashboard dock shows it.
const ACCOUNTS = [1, 4, 5, 7].map(
  (n) => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
)
const FRAMES = process.env.MAM_MOMENT_FRAMES

const bubble = (page: Page) => page.locator('[data-mam-bubble="guide"]')

async function graduateGuide(page: Page) {
  await page.addInitScript((ids) => {
    for (const id of ids)
      window.localStorage.setItem(
        `mb:mam-guide:v1:${id}`,
        JSON.stringify({
          version: 1,
          startedAt: '2026-11-20T08:00:00.000Z',
          done: {},
          declined: {},
          pending: null,
          unwindKind: null,
          plan: 'PLUS',
          graduatedAt: '2026-11-21T08:00:00.000Z',
        }),
      )
  }, ACCOUNTS)
}

async function say(page: Page, detail: Record<string, unknown>) {
  await page.evaluate(
    (value) =>
      window.dispatchEvent(new CustomEvent('mam:moment', { detail: value })),
    detail,
  )
}

/** Motion frames for the UI gate: 0, 120 and 300 ms after a trigger. */
async function frames(page: Page, name: string, trigger: () => Promise<void>) {
  if (!FRAMES) return trigger()
  mkdirSync(FRAMES, { recursive: true })
  await trigger()
  for (const ms of [0, 120, 300]) {
    if (ms) await page.waitForTimeout(ms === 120 ? 120 : 180)
    await page.screenshot({ path: join(FRAMES, `${name}-${ms}ms.png`) })
  }
}

test.describe('Mầm moments', () => {
  test.use({ timezoneId: 'Asia/Ho_Chi_Minh' })
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'Moments are dispatched from browser-owned fixtures only.',
  )

  test('a declined booking gets comfort right away and "mình tìm cùng nhau"', async ({
    page,
  }) => {
    await installHomeMocks(page, homeWorld('do-today'))
    await graduateGuide(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await frames(page, 'declined-enter', () =>
      say(page, { kind: 'booking-declined', key: 'declined:e2e' }),
    )
    await expect(bubble(page)).toContainText('Không phải do bạn đâu')
    await expect(
      bubble(page).getByRole('link', { name: 'Tìm chuyên gia khác' }),
    ).toHaveAttribute('href', '/specialists')
    for (const width of [1280, 768, 375]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(bubble(page)).toBeVisible()
      if (FRAMES)
        await page.screenshot({ path: join(FRAMES, `declined-${width}.png`) })
    }
    await page.setViewportSize({ width: 1440, height: 900 })
    await frames(page, 'declined-stay', () =>
      bubble(page)
        .getByRole('button', { name: 'Để Mầm ở đây với bạn 1 chút' })
        .click(),
    )
    await expect(bubble(page)).toHaveCount(0)
    // Once is enough: the same decline never asks again.
    await say(page, { kind: 'booking-declined', key: 'declined:e2e' })
    await expect(bubble(page)).toHaveCount(0)
  })

  test('a skipped activity gets "không sao" and a reminder for tomorrow, one moment at a time', async ({
    page,
  }) => {
    await installHomeMocks(page, homeWorld('do-today'))
    await graduateGuide(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await say(page, {
      kind: 'plan-skipped',
      key: 'skipped:e2e',
      href: '/support-plan',
    })
    await say(page, { kind: 'booking-confirmed', key: 'confirmed:e2e' })
    await expect(bubble(page)).toContainText('Không sao đâu, không sao hết.')
    await expect(bubble(page)).not.toContainText('bỏ lỡ')
    if (FRAMES)
      await page.screenshot({ path: join(FRAMES, 'skipped-1440.png') })
    await frames(page, 'skipped-remind', () =>
      bubble(page)
        .getByRole('button', { name: 'Mai Mầm nhắc mình nhé' })
        .click(),
    )
    // The next moment waits its turn.
    await expect(bubble(page)).toContainText('Chuyên gia xác nhận rồi nè.')
    await expect(
      bubble(page).getByRole('button', { name: /^Tiếp/ }),
    ).toHaveCount(0)
  })

  test('reduced motion still shows the moment and its buttons', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await installHomeMocks(page, homeWorld('do-today'))
    await graduateGuide(page)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await say(page, {
      kind: 'guide-open',
      key: 'guide-open:first',
      activity: { title: 'Thở chậm trong 5 phút', href: '/resources/r1' },
    })
    await bubble(page).getByRole('button', { name: 'Chỉ Mầm đi' }).click()
    await expect(bubble(page)).toContainText(
      'Mầm thấy cái này nhẹ nhất nè: Thở chậm trong 5 phút.',
    )
    await expect(
      bubble(page).getByRole('link', { name: 'Làm cùng Mầm' }),
    ).toHaveAttribute('href', '/resources/r1')
  })
})
