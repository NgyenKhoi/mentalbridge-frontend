import { expect, type Page } from '@playwright/test'

import { MAM_LINES } from '../../features/mam/mam-lines'
import {
  homeTimeZone,
  homeWorld,
  installHomeMocks,
} from './home-next-step-mocks'
import { dockRoot } from './mam-dock-helpers'
import { test } from './test-fixtures'

// MB-897: Mầm's daily trajectory and verified events, against the built app with the real v0.8 asset. The look-back
// series is the user's own check-ins (mocked per state); automated browsers get no welcome, so nothing but the
// trajectory moment plays here. `/achievements` is a FULL route with no page action under the dock.

const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: homeTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
const shift = (days: number) => {
  const date = new Date(`${today()}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// Levels oldest to newest; the last is today.
// The slim view of GET /api/mam/trajectory: levels and the band status, no text.
function lookBack(
  levels: readonly (number | null)[],
  narrative = 'STEADY',
  extra: { partial?: boolean; moderatePlus?: boolean } = {},
) {
  return {
    asOfLocalDate: today(),
    days: levels.map((emotionLevel, index) => ({
      localDate: shift(index - (levels.length - 1)),
      emotionLevel,
    })),
    narrative,
    band: {
      readable: true,
      moderatePlus: extra.moderatePlus ?? false,
      transition: null,
    },
    partial: extra.partial ?? false,
  }
}

const SERIES = {
  DIP_AFTER_GOOD: { levels: [4, 5, 4, 2], intent: 'COMFORT' },
  PERSISTENT_LOW: { levels: [2, 1, 2], intent: 'COMFORT' },
  IMPROVING: { levels: [2, 2, 2, 3, 3, 3], intent: 'ENCOURAGE' },
  BOUNCE_BACK: { levels: [3, 2, 4], intent: 'CELEBRATE' },
} as const

const bubble = (page: Page) => page.locator('[data-mam-bubble="celebration"]')

async function open(
  page: Page,
  series: {
    levels: readonly number[]
    narrative?: string
    partial?: boolean
    moderatePlus?: boolean
  },
  { path = '/achievements', width = 1440 } = {},
) {
  await installHomeMocks(page, homeWorld('do-today'))
  const reads = { count: 0 }
  await page.route('**/api/mam/trajectory*', (route) => {
    reads.count++
    return route.fulfill({
      status: 200,
      json: lookBack(series.levels, series.narrative, series),
    })
  })
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 })
  await page.goto(path)
  return reads
}

test.describe('MB-897 Mầm trajectory', () => {
  test.use({ timezoneId: homeTimeZone })
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'The trajectory specs use browser-owned fixtures only.',
  )

  for (const [state, { levels, intent }] of Object.entries(SERIES)) {
    for (const width of [1440, 375]) {
      test(`${state} at ${width}: the first FULL visit shows its line and plays ${intent}`, async ({
        page,
      }) => {
        test.setTimeout(60_000)
        const reads = await open(page, { levels }, { width })
        await expect(bubble(page)).toBeVisible({ timeout: 15_000 })
        const lines: readonly string[] = MAM_LINES[state as keyof typeof SERIES]
        await expect
          .poll(async () => {
            const text = (await bubble(page).textContent()) ?? ''
            return lines.some((line) => text.includes(line))
          })
          .toBe(true)
        await expect(dockRoot(page)).toHaveAttribute(
          'data-mam-intent',
          intent,
          {
            timeout: 12_000,
          },
        )
        // No celebration link, no alarm: a trajectory line is not an award.
        await expect(bubble(page).getByRole('link')).toHaveCount(0)
        // It goes by itself (6 s) and is not read again the same day.
        await expect(bubble(page)).toHaveCount(0, { timeout: 12_000 })
        await page.goto('/resources')
        await page.waitForLoadState('networkidle')
        expect(reads.count).toBe(1)
        await expect(bubble(page)).toHaveCount(0)
      })
    }
  }

  test('the bubble closes with Escape and its close button without taking focus from the page', async ({
    page,
  }) => {
    await open(page, { levels: SERIES.DIP_AFTER_GOOD.levels })
    await expect(bubble(page)).toBeVisible({ timeout: 15_000 })
    await page.keyboard.press('Escape')
    await expect(bubble(page)).toHaveCount(0)
  })

  test('partial data or a moderate-or-higher band never cheers either', async ({
    page,
  }) => {
    test.setTimeout(45_000)
    const reads = await open(page, {
      levels: SERIES.BOUNCE_BACK.levels,
      partial: true,
    })
    await expect.poll(() => reads.count).toBe(1)
    await page.waitForTimeout(3_000)
    await expect(bubble(page)).toHaveCount(0)
  })

  test('a harder look-back never cheers: a bounce back stays silent', async ({
    page,
  }) => {
    test.setTimeout(45_000)
    const reads = await open(page, {
      levels: SERIES.BOUNCE_BACK.levels,
      narrative: 'HARDER',
    })
    await expect.poll(() => reads.count).toBe(1)
    await page.waitForTimeout(3_000)
    await expect(bubble(page)).toHaveCount(0)
  })

  test('reduced motion still shows the bubble and starts no look', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await open(page, { levels: SERIES.DIP_AFTER_GOOD.levels })
    await expect(bubble(page)).toBeVisible({ timeout: 15_000 })
    await expect(dockRoot(page)).toHaveAttribute('data-mam-intent', '')
  })

  test('muted: nothing is read and nothing shows', async ({ page }) => {
    await page.addInitScript(() =>
      window.sessionStorage.setItem('mentalbridge_mam_session_muted', 'true'),
    )
    const reads = await open(page, { levels: SERIES.DIP_AFTER_GOOD.levels })
    await expect(dockRoot(page)).toBeVisible()
    await page.waitForTimeout(2_000)
    expect(reads.count).toBe(0)
    await expect(bubble(page)).toHaveCount(0)
  })

  test.describe('after a check-in on Home', () => {
    async function saveCheckIn(
      page: Page,
      status: number,
      before: readonly (number | null)[] = [3, 3, null],
    ) {
      // Before the save today has no record, as on the empty card.
      let series = { levels: before }
      await installHomeMocks(page, homeWorld('do-today'))
      // Registered last, so it answers first: the save and the series after it.
      await page.route('**/api/mam/trajectory*', (route) =>
        route.fulfill({ status: 200, json: lookBack(series.levels) }),
      )
      await page.route('**/api/emotion-check-ins', async (route) => {
        if (route.request().method() !== 'POST') return route.fallback()
        if (status !== 201)
          return route.fulfill({
            status,
            json: {
              type: 'about:blank',
              status,
              code: 'DEPENDENCY_UNAVAILABLE',
            },
          })
        series = { levels: SERIES.DIP_AFTER_GOOD.levels }
        return route.fallback()
      })
      await page.setViewportSize({ width: 1440, height: 1100 })
      await page.goto('/dashboard')
      const card = page.locator('#emotion-check-in')
      await card.getByText('Rất không tốt', { exact: true }).click()
      await card.getByText('3', { exact: true }).click()
      await card.getByRole('button', { name: 'Lưu ghi nhận' }).click()
      return card
    }

    test('a saved check-in is answered from the new trajectory', async ({
      page,
    }) => {
      test.setTimeout(60_000)
      const card = await saveCheckIn(page, 201)
      await expect(card.getByText('Đã lưu ghi nhận hôm nay.')).toBeVisible()
      // The dock steps aside for a page action under it and the line waits; leaving the dock's corner clear lets it speak.
      await page.evaluate(() => {
        window.scrollTo(0, 0)
        for (const element of document.querySelectorAll('*'))
          if (element.scrollTop > 0) element.scrollTop = 0
      })
      await expect(bubble(page)).toBeVisible({ timeout: 15_000 })
      await expect
        .poll(async () => {
          const text = (await bubble(page).textContent()) ?? ''
          return MAM_LINES.DIP_AFTER_GOOD.some((line) => text.includes(line))
        })
        .toBe(true)
    })

    test('a save that fails produces no reaction', async ({ page }) => {
      test.setTimeout(45_000)
      const card = await saveCheckIn(page, 503)
      await expect(card.getByRole('alert')).toContainText('Chưa thể lưu')
      await page.waitForTimeout(3_000)
      await expect(bubble(page)).toHaveCount(0)
      await expect(dockRoot(page)).toHaveAttribute('data-mam-intent', '')
    })
  })

  test('an event stamped with another account produces no reaction', async ({
    page,
  }) => {
    await open(page, { levels: [3, 3] })
    await expect(dockRoot(page)).toBeVisible()
    await page.evaluate((localDate) => {
      for (const type of [
        'mam:checkin-saved',
        'mam:support-done',
        'mam:resource-done',
        'mam:journal-saved',
      ])
        window.dispatchEvent(
          new CustomEvent(type, {
            detail: {
              type: type.slice(4),
              accountId: 'another-account',
              localDate,
              emotion: 'VERY_LOW',
              intensity: 5,
            },
          }),
        )
    }, today())
    await page.waitForTimeout(2_500)
    await expect(bubble(page)).toHaveCount(0)
    await expect(dockRoot(page)).toHaveAttribute('data-mam-intent', '')
  })
})
