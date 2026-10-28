import { expect, type Page } from '@playwright/test'

import { test } from './test-fixtures'
import { homeWorld, installHomeMocks } from './home-next-step-mocks'
import {
  installPlanResourcesMocks,
  resourceWorld,
} from './plan-resources-mocks'

// MB-774: Achievements and Bingo reads reach the celebration director. Nothing
// here fakes a `mam:award-read`: the gallery, the Resources plan sync and the
// host's own cadence reader read through route mocks and the real clients. The
// events are only recorded, to show which reads reached the director. The clock
// is fixed so the 5 min spacing, the 10 s coalescing window and the 1.7 s
// one-shot are deterministic.

const START = new Date('2026-10-27T03:00:00Z')
const MIN = 60_000
// 10 s coalescing window, the 1.7 s hero one-shot, and some slack.
const SETTLE = 10_000 + 1700 + 300
const bubble = (page: Page) => page.getByRole('group', { name: 'Mầm' })
const dock = (page: Page) =>
  page.getByRole('button', { name: 'Mầm', exact: true })

const earned = (id: string, title: string, unlockedAt: Date) => ({
  definitionId: id,
  domain: 'JOURNAL',
  kind: 'MILESTONE',
  tier: 'FIRST_STEP',
  title,
  description: 'Mốc riêng tư dựa trên hoạt động đã lưu.',
  status: 'EARNED',
  evidenceClass: 'OWNER_SOURCE_FACT',
  unlockedAt: unlockedAt.toISOString(),
  ruleVersion: 'achievement-rules-v1',
  privacy: 'PRIVATE',
  progress: { current: 1, target: 1, unit: 'EVENT' },
})
const TWO_DAYS_AGO = new Date(START.getTime() - 48 * 60 * MIN)
const baseline = () =>
  ['journal.a', 'journal.b', 'journal.c', 'journal.d'].map((id) =>
    earned(id, `Cũ ${id}`, TWO_DAYS_AGO),
  )

/** The director's reconciled domains and boards, its queue and reservations. */
const record = (page: Page) =>
  page.evaluate(() => {
    const key = Object.keys(localStorage).find((name) =>
      name.startsWith('mentalbridge_mam_celebrations:'),
    )
    const value = key ? JSON.parse(localStorage.getItem(key)!) : null
    return {
      scopes: value ? Object.keys(value.lastReads) : [],
      queued: value ? value.queue.length : 0,
      reservations: value ? value.reservations.length : 0,
    }
  })

/** Every `mam:award-read` the page dispatched, in order. */
type Seen = { scope: string; awards: number }
const seen = (page: Page) =>
  page.evaluate(() => (window as unknown as { __reads: Seen[] }).__reads)
async function recordReads(page: Page) {
  await page.addInitScript(() => {
    const reads: Seen[] = []
    ;(window as unknown as { __reads: Seen[] }).__reads = reads
    window.addEventListener('mam:award-read', (event) => {
      const detail = (event as CustomEvent).detail
      reads.push({ scope: detail.scope, awards: detail.awards.length })
    })
  })
}

const focus = (page: Page) =>
  page.evaluate(() => window.dispatchEvent(new Event('focus')))

// Clock jumps leave framer's exit fade scheduled in the future of the real
// document timeline; finishing the running animations lets the exit complete.
async function expectClosed(page: Page) {
  await expect(async () => {
    await page.evaluate(() =>
      document.getAnimations().forEach((animation) => {
        if (animation.effect?.getComputedTiming().endTime !== Infinity)
          animation.finish()
      }),
    )
    await expect(bubble(page)).toHaveCount(0, { timeout: 500 })
  }).toPass({ timeout: 15_000 })
}

/** Achievements and Bingo mocks the scenarios change between reads. */
async function openGallery(page: Page) {
  const state = {
    items: baseline() as object[],
    status: 200,
    achievements: 0,
    bingo: 0,
  }
  await recordReads(page)
  await page.clock.install({ time: START })
  await installHomeMocks(page, homeWorld('nothing-today'))
  await page.route('**/api/achievements?*', (route) => {
    state.achievements += 1
    if (state.status !== 200)
      return route.fulfill({
        status: state.status,
        contentType: 'application/json',
        body: JSON.stringify({
          status: state.status,
          code: 'DEPENDENCY_UNAVAILABLE',
          title: 'Controlled fixture response',
        }),
      })
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { ETag: '"0"' },
      body: JSON.stringify({
        visibilityState: 'VISIBLE',
        preferenceVersion: '0',
        policyVersion: 'achievement-rules-v1',
        calculatedAt: START.toISOString(),
        sources: [
          {
            domain: 'JOURNAL',
            availability: 'AVAILABLE',
            asOfLocalDate: '2026-10-27',
          },
        ],
        items: state.items,
      }),
    })
  })
  await page.route('**/api/resources/bingo/**', (route) => {
    state.bingo += 1
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { ETag: '"0"' },
      body: JSON.stringify({
        weekStart: '2026-10-26',
        timeZone: 'Asia/Ho_Chi_Minh',
        version: '0',
        updatedAt: START.toISOString(),
        items: [],
      }),
    })
  })
  return state
}

test.describe('MB-774 Mầm reward reads', () => {
  test.use({ timezoneId: 'Asia/Ho_Chi_Minh' })
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'The reward reads use browser-owned fixtures only.',
  )

  for (const count of [1, 3]) {
    test(`a focus read 6 minutes later celebrates ${count} new achievement${count > 1 ? 's' : ''} once`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 900 })
      const state = await openGallery(page)
      await page.goto('/achievements')
      await expect(dock(page)).toBeVisible()
      // First visit: the gallery and the host both read, and both baseline silently.
      await expect
        .poll(async () => (await record(page)).scopes)
        .toContain('achievements:JOURNAL')
      await page.clock.runFor(SETTLE)
      await expect(bubble(page)).toHaveCount(0)

      const fresh = new Date(START.getTime() + 5 * MIN)
      state.items = [
        ...baseline(),
        ...['Một', 'Hai', 'Ba']
          .slice(0, count)
          .map((title) => earned(`journal.${title}`, title, fresh)),
      ]
      const before = state.achievements
      await page.clock.fastForward(6 * MIN)
      await focus(page)
      await expect.poll(() => state.achievements).toBe(before + 1)
      await expect.poll(async () => (await record(page)).queued).toBe(count)
      await page.clock.runFor(SETTLE)
      await expect(bubble(page)).toContainText(
        count === 1 ? 'Bạn vừa ghi nhận “Một”.' : '“Một” và 2 thành tựu khác.',
      )
      // Already on the gallery: no link to it.
      await expect(
        bubble(page).getByRole('link', { name: 'Xem bộ sưu tập' }),
      ).toHaveCount(0)
      expect((await record(page)).reservations).toBe(1)

      // A reload reads the same list again and replays nothing.
      await page.getByRole('button', { name: 'Đóng', exact: true }).click()
      await expectClosed(page)
      const reloaded = state.achievements
      await page.reload()
      await expect.poll(() => state.achievements).toBeGreaterThan(reloaded)
      await page.clock.runFor(SETTLE)
      await expect(bubble(page)).toHaveCount(0)
      expect((await record(page)).reservations).toBe(1)
    })
  }

  test('a focus read celebrates on /resources with the link to the gallery', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const world = resourceWorld(1)
    const items = { current: baseline() as object[] }
    await recordReads(page)
    await page.clock.install({ time: START })
    await installPlanResourcesMocks(page, world)
    await page.route(/\/api\/resources(?:\?.*)?$/, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], hasMore: false }),
      }),
    )
    await page.route('**/api/achievements?*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { ETag: '"0"' },
        body: JSON.stringify({
          visibilityState: 'VISIBLE',
          preferenceVersion: '0',
          policyVersion: 'achievement-rules-v1',
          calculatedAt: START.toISOString(),
          sources: [
            {
              domain: 'JOURNAL',
              availability: 'AVAILABLE',
              asOfLocalDate: '2026-10-27',
            },
          ],
          items: items.current,
        }),
      }),
    )
    await page.goto('/resources')
    await expect(dock(page)).toBeVisible()
    await expect
      .poll(async () => (await record(page)).scopes)
      .toContain('achievements:JOURNAL')
    await page.clock.runFor(SETTLE)
    await expect(bubble(page)).toHaveCount(0)

    items.current = [
      ...baseline(),
      earned(
        'journal.new',
        'Bước đầu tiên',
        new Date(START.getTime() + 5 * MIN),
      ),
    ]
    await page.clock.fastForward(6 * MIN)
    await focus(page)
    await expect.poll(async () => (await record(page)).queued).toBe(1)
    await page.clock.runFor(SETTLE)
    await expect(bubble(page)).toContainText(
      'Bạn vừa ghi nhận “Bước đầu tiên”.',
    )
    await expect(
      bubble(page).getByRole('link', { name: 'Xem bộ sưu tập' }),
    ).toHaveAttribute('href', '/achievements')
  })

  test('focus reads keep 5 minutes apart: one achievements read per window', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const state = await openGallery(page)
    await page.goto('/achievements')
    await expect(dock(page)).toBeVisible()
    // The gallery's own read and the host's.
    await expect.poll(() => state.achievements).toBeGreaterThanOrEqual(2)
    await page.clock.runFor(1000)
    const { achievements } = state

    await page.clock.fastForward(MIN)
    await focus(page)
    await focus(page)
    await page.waitForTimeout(500)
    expect(state.achievements).toBe(achievements)

    await page.clock.fastForward(5 * MIN)
    await focus(page)
    await focus(page)
    await expect.poll(() => state.achievements).toBe(achievements + 1)
    await page.waitForTimeout(500)
    // The host never reads Bingo; only the Resources page does.
    expect(state.achievements).toBe(achievements + 1)
    expect(state.bingo).toBe(0)
  })

  test('a hidden Mầm makes no cadence read; the gallery still reads', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.addInitScript(() =>
      window.localStorage.setItem('mentalbridge_mam_hidden', 'true'),
    )
    const state = await openGallery(page)
    await page.goto('/achievements')
    await expect(
      page.getByRole('heading', { name: 'Bộ sưu tập hành trình' }),
    ).toBeVisible()
    await expect.poll(() => state.achievements).toBeGreaterThan(0)
    const { achievements } = state
    await page.clock.fastForward(6 * MIN)
    await focus(page)
    await page.waitForTimeout(500)
    expect(state.achievements).toBe(achievements)
    expect(state.bingo).toBe(0)
  })

  test('a failed read dispatches nothing and plays nothing; the retry is a page read the director sees', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    const state = await openGallery(page)
    state.status = 503
    await page.goto('/achievements')
    const retry = page.getByRole('button', { name: 'Thử lại', exact: true })
    await expect(retry).toBeVisible()
    await page.clock.runFor(SETTLE)
    await expect(bubble(page)).toHaveCount(0)
    expect(
      (await seen(page)).filter((read) =>
        read.scope.startsWith('achievements:'),
      ),
    ).toEqual([])

    state.status = 200
    await retry.click()
    await expect(
      page.getByRole('heading', { name: 'Cũ journal.a' }),
    ).toBeVisible()
    expect(
      (await seen(page)).filter((read) =>
        read.scope.startsWith('achievements:'),
      ),
    ).toEqual([{ scope: 'achievements:JOURNAL', awards: 4 }])
  })

  test.describe('Bingo on /resources', () => {
    // Tall, so no page action sits under the dock and the dock does not step aside.
    async function openResources(page: Page) {
      const world = resourceWorld(1)
      await recordReads(page)
      await page.clock.install({ time: START })
      await installPlanResourcesMocks(page, world)
      await page.goto('/resources')
      await expect(dock(page)).toBeVisible()
      // The plan section syncs the board: that response is the first read.
      await expect(
        page.getByRole('region', { name: 'Trong kế hoạch của tôi' }),
      ).toBeVisible()
      // The plan sync is the only Bingo read.
      await expect.poll(async () => (await bingoReads(page)).length).toBe(1)
      await expect
        .poll(async () => (await record(page)).scopes)
        .toEqual(expect.arrayContaining([expect.stringMatching(/^bingo:/)]))
      return world
    }
    const bingoReads = async (page: Page) =>
      (await seen(page)).filter((read) => read.scope.startsWith('bingo:'))

    test('a verified item found by the plan sync gives light_success and no bubble', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 1400 })
      const world = await openResources(page)
      await page.clock.runFor(SETTLE)
      expect((await record(page)).reservations).toBe(0)

      Object.assign(world.board.items[0], {
        evidence: 'CONTENT_VERIFIED',
        verifiedAt: new Date(START.getTime() + MIN).toISOString(),
        verificationSource: 'RESOURCE_PRACTICE',
      })
      await page.clock.fastForward(2 * MIN)
      await page.reload()
      await expect
        .poll(async () => (await bingoReads(page)).some((r) => r.awards > 0))
        .toBe(true)
      await expect.poll(async () => (await record(page)).queued).toBe(1)
      await page.clock.runFor(SETTLE)
      await expect.poll(async () => (await record(page)).reservations).toBe(1)
      await page.clock.runFor(SETTLE)
      await expect(bubble(page)).toHaveCount(0)
    })

    test('a self-confirmation plays nothing, and a failed save dispatches nothing', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1440, height: 1400 })
      const world = await openResources(page)
      const section = page.getByRole('region', {
        name: 'Trong kế hoạch của tôi',
      })
      const toggle = section.getByRole('button', {
        name: `Tự đánh dấu ${world.board.items[0].label}`,
        exact: true,
      })
      const before = (await bingoReads(page)).length
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-pressed', 'true')
      // The save response is a read the director sees, and it has no award.
      expect(await bingoReads(page)).toHaveLength(before + 1)
      expect((await bingoReads(page)).at(-1)?.awards).toBe(0)
      await page.clock.runFor(SETTLE)
      await expect(bubble(page)).toHaveCount(0)
      expect((await record(page)).reservations).toBe(0)

      world.toggleStatus = 500
      await toggle.click()
      await expect(toggle).toHaveAttribute('aria-pressed', 'true')
      expect(await bingoReads(page)).toHaveLength(before + 1)
      await page.clock.runFor(SETTLE)
      await expect(bubble(page)).toHaveCount(0)
      expect((await record(page)).reservations).toBe(0)
    })
  })
})
