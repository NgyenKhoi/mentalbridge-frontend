import { expect, type Page } from '@playwright/test'

import { test } from './test-fixtures'
import { homeWorld, installHomeMocks } from './home-next-step-mocks'
import {
  installPlanResourcesMocks,
  resourceWorld,
} from './plan-resources-mocks'

// MB-773: the celebration director plays one appearance from owner read
// snapshots. Here the snapshots are fake `mam:award-read` events; the real reads
// are in mam-reward-reads.spec.ts. Since MB-774 the host also reads on its own,
// so the gallery mock lists the earned achievements the scenario queues: an
// empty read would reconcile them away. The clock is fixed so the 10 s
// coalescing window, the 1.7 s one-shot, the 8 s bubble and the 30 min budget
// are deterministic.

const START = new Date('2026-10-27T03:00:00Z')
const MIN = 60_000
// 10 s coalescing window, the 1.7 s hero one-shot, and some slack.
const SETTLE = 10_000 + 1700 + 300
const bubble = (page: Page) => page.getByRole('group', { name: 'Mầm' })
const dock = (page: Page) =>
  page.getByRole('button', { name: 'Mầm', exact: true })

const achievement = (id: string, title: string, agoMs = MIN) => {
  const at = new Date(START.getTime() - agoMs).toISOString()
  return {
    key: `achievement:${id}:${at}`,
    kind: 'achievement',
    at: Date.parse(at),
    title,
  }
}
// The gallery item the host's own read returns for a fake award.
const earnedItem = (award: ReturnType<typeof achievement>) => ({
  definitionId: award.key.split(':')[1],
  domain: 'JOURNAL',
  kind: 'MILESTONE',
  tier: 'FIRST_STEP',
  title: award.title,
  description: 'Mốc riêng tư dựa trên hoạt động đã lưu.',
  status: 'EARNED',
  evidenceClass: 'OWNER_SOURCE_FACT',
  unlockedAt: new Date(award.at).toISOString(),
  ruleVersion: 'achievement-rules-v1',
  privacy: 'PRIVATE',
  progress: { current: 1, target: 1, unit: 'EVENT' },
})
const bingo = (position: number) => ({
  key: `bingo:2026-10-26:Asia/Ho_Chi_Minh:${position}:r:v1`,
  kind: 'bingo',
  at: START.getTime() - MIN,
})

async function dispatchRead(
  page: Page,
  scope: string,
  awards: object[],
  patch: object = {},
) {
  await page.evaluate(
    ({ scope, awards, patch }) =>
      window.dispatchEvent(
        new CustomEvent('mam:award-read', {
          detail: {
            scope,
            available: true,
            visible: true,
            readAt: Date.now(),
            awards,
            ...patch,
          },
        }),
      ),
    { scope, awards, patch },
  )
}

const JOURNAL = 'achievements:JOURNAL'
const BOARD = 'bingo:2026-10-26:Asia/Ho_Chi_Minh'

/** Scopes the director has reconciled at least once. */
const readScopes = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((name) =>
      name.startsWith('mentalbridge_mam_celebrations:'),
    )
    return key
      ? Object.keys(JSON.parse(localStorage.getItem(key)!).lastReads)
      : []
  })

/** Reservations kept in the per-account record; one per delivered appearance. */
const reservations = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((name) =>
      name.startsWith('mentalbridge_mam_celebrations:'),
    )
    return key ? JSON.parse(localStorage.getItem(key)!).reservations.length : -1
  })

// Clock jumps leave framer's exit fade scheduled in the future of the real
// document timeline (its start comes from the faked clock). Finishing the
// running animations lets the exit complete without waiting that gap out.
async function expectClosed(page: Page) {
  await expect(async () => {
    await page.evaluate(() =>
      document.getAnimations().forEach((animation) => {
        // Looping animations have no end to jump to.
        if (animation.effect?.getComputedTiming().endTime !== Infinity)
          animation.finish()
      }),
    )
    await expect(bubble(page)).toHaveCount(0, { timeout: 500 })
  }).toPass({ timeout: 15_000 })
}

// Where a page action sits under the dock the dock steps aside and nothing
// plays (ADR layering), so the scenarios run where nothing does: the empty
// gallery and the empty catalogue.
async function open(
  page: Page,
  path = '/achievements',
  earned: ReturnType<typeof achievement>[] = [],
) {
  await page.clock.install({ time: START })
  if (path === '/resources') {
    await installPlanResourcesMocks(page, resourceWorld(1))
    await page.route(/\/api\/resources(?:\?.*)?$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], hasMore: false }),
      }),
    )
  } else {
    await installHomeMocks(page, homeWorld('nothing-today'))
    await page.route('**/api/achievements?*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { ETag: '"0"' },
        body: JSON.stringify({
          visibilityState: 'VISIBLE',
          preferenceVersion: '0',
          policyVersion: 'achievement-rules-v1',
          calculatedAt: '2026-10-27T03:00:00.000Z',
          sources: [
            {
              domain: 'JOURNAL',
              availability: 'AVAILABLE',
              asOfLocalDate: '2026-10-27',
            },
          ],
          items: [achievement('old', 'Cũ', 5 * 60 * MIN), ...earned].map(
            earnedItem,
          ),
        }),
      }),
    )
  }
  await page.goto(path)
  await expect(dock(page)).toBeVisible()
  // The host's own gallery read seeds the domain before the fake reads.
  if (path === '/achievements')
    await expect.poll(() => readScopes(page)).toContain(JOURNAL)
  // First read of a domain seeds silently.
  await dispatchRead(page, JOURNAL, [achievement('old', 'Cũ', 5 * 60 * MIN)])
  await page.clock.runFor(2000)
  await expect(bubble(page)).toHaveCount(0)
}

test.describe('MB-773 Mầm celebration director', () => {
  test.use({ timezoneId: 'Asia/Ho_Chi_Minh' })
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'The celebration journey uses browser-owned fixtures only.',
  )

  for (const width of [1440, 375]) {
    test(`plays a hero with its bubble once, then closes after 8 s at ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 })
      await open(page, '/resources')
      const old = achievement('old', 'Cũ', 5 * 60 * MIN)
      const fresh = achievement('new', 'Bước đầu tiên')
      await dispatchRead(page, JOURNAL, [old, fresh])
      await page.clock.runFor(SETTLE)
      await expect(bubble(page)).toContainText(
        'Bạn vừa ghi nhận “Bước đầu tiên”.',
      )
      await expect(
        bubble(page).getByRole('link', { name: 'Xem bộ sưu tập' }),
      ).toHaveAttribute('href', '/achievements')
      // Focus never moves to the bubble.
      await expect(bubble(page).locator(':focus')).toHaveCount(0)

      // Hover pauses the timer; leaving restarts the full 8 s.
      await bubble(page).hover()
      await page.clock.runFor(9000)
      await expect(bubble(page)).toBeVisible()
      await page.mouse.move(0, 0)
      // Let the pointer-leave commit start the fresh 8 s before time moves.
      await page.waitForTimeout(200)
      await page.clock.runFor(7000)
      await expect(bubble(page)).toBeVisible()
      await expectClosed(page)
      expect(await reservations(page)).toBe(1)

      // A reload and an identical read replay nothing.
      await page.reload()
      await dispatchRead(page, JOURNAL, [old, fresh])
      await page.clock.runFor(SETTLE)
      await expect(bubble(page)).toHaveCount(0)
    })
  }

  test('coalesces a burst into one appearance with a count', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page)
    await dispatchRead(page, JOURNAL, [
      achievement('a', 'Một'),
      achievement('b', 'Hai'),
      achievement('c', 'Ba'),
    ])
    await page.clock.runFor(SETTLE)
    await expect(bubble(page)).toContainText('“Một” và 2 thành tựu khác.')
    expect(await reservations(page)).toBe(1)
  })

  test('waits 30 minutes between appearances', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page)
    await dispatchRead(page, JOURNAL, [achievement('a', 'Một')])
    await page.clock.runFor(SETTLE)
    await expect(bubble(page)).toBeVisible()
    await page.getByRole('button', { name: 'Đóng', exact: true }).click()
    await expectClosed(page)

    await page.clock.fastForward(10 * MIN)
    await dispatchRead(page, JOURNAL, [
      achievement('a', 'Một'),
      achievement('b', 'Hai', 0),
    ])
    await page.clock.runFor(SETTLE)
    await expect(bubble(page)).toHaveCount(0)

    await page.clock.fastForward(21 * MIN)
    await dispatchRead(page, JOURNAL, [
      achievement('a', 'Một'),
      achievement('b', 'Hai', 0),
    ])
    await page.clock.runFor(SETTLE)
    await expect(bubble(page)).toContainText('“Hai”')
    expect(await reservations(page)).toBe(2)
  })

  test('steps aside from a page action under the bubble', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page)
    await dispatchRead(page, JOURNAL, [achievement('a', 'Một')])
    await page.clock.runFor(SETTLE)
    await expect(bubble(page)).toBeVisible()
    const box = (await bubble(page).boundingBox())!
    await page.evaluate((rect) => {
      const probe = document.createElement('button')
      probe.textContent = 'probe'
      probe.style.cssText = `position:fixed;left:${rect.x + 8}px;top:${rect.y + 8}px;width:60px;height:30px`
      document.querySelector('.ref-content')?.appendChild(probe)
    }, box)
    await expectClosed(page)
    await page.getByRole('button', { name: 'probe' }).click()
  })

  test('a verified Bingo item gives light_success and no bubble', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page)
    await dispatchRead(page, BOARD, [])
    await dispatchRead(page, BOARD, [bingo(1)])
    await page.clock.runFor(SETTLE)
    await expect.poll(() => reservations(page)).toBe(1)
    await page.clock.runFor(SETTLE)
    await expect(bubble(page)).toHaveCount(0)
  })

  test('waits through a dialog and on /journal, then plays', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page)
    await page.getByRole('button', { name: 'Mở hỗ trợ khẩn cấp' }).click()
    await expect(page.locator('[aria-modal="true"]')).toBeVisible()
    await dispatchRead(page, JOURNAL, [achievement('a', 'Một')])
    await page.clock.runFor(SETTLE)
    await expect(bubble(page)).toHaveCount(0)
    await page.keyboard.press('Escape')
    await page.clock.runFor(SETTLE)
    await expect(bubble(page)).toContainText('“Một”')
  })

  test('/journal never plays; the next automatic route plays', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page, '/journal', [achievement('a', 'Một')])
    await dispatchRead(page, JOURNAL, [achievement('a', 'Một')])
    await page.clock.runFor(SETTLE)
    await expect(bubble(page)).toHaveCount(0)
    await page.goto('/achievements')
    await page.clock.runFor(SETTLE)
    await expect(bubble(page)).toContainText('“Một”')
  })

  test('reduced motion plays nothing and shows the note on the dock menu', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 900 })
    await open(page)
    await dispatchRead(page, JOURNAL, [achievement('a', 'Một')])
    await page.clock.runFor(SETTLE)
    await expect(bubble(page)).toHaveCount(0)
    expect(await reservations(page)).toBe(0)
    await dock(page).click()
    await expect(page.getByRole('group', { name: 'Mầm' })).toContainText(
      'Bạn vừa ghi nhận “Một”.',
    )
  })
})
