import { expect, type Locator, type Page } from '@playwright/test'

import { test } from './test-fixtures'
import { homeWorld, installHomeMocks } from './home-next-step-mocks'

const entranceName = /^mb-(unfold|title-rise|focus-in|pop|slide-in)$/

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    {
      name: 'mentalbridge_access',
      value: 'synthetic-mb273-e2e-access',
      url: 'http://127.0.0.1:3100',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
})

// Assert while entrance selectors still match, rather than after the latch has
// removed every animation and could hide a missing opt-out.
async function expectStillDuringEntrance(surface: Locator) {
  const state = await surface.evaluate((element) => {
    const content = element.closest('.ref-content')
    const animations = []
    for (let node: Element | null = element; node; node = node.parentElement) {
      animations.push(getComputedStyle(node).animationName)
      if (node === content) break
    }
    return { entered: content?.hasAttribute('data-entered'), animations }
  })
  expect(state.entered).toBe(false)
  expect(state.animations.some((name) => entranceName.test(name))).toBe(false)
}

async function entranceNames(page: Page) {
  return page
    .locator('.ref-content')
    .evaluate((content) =>
      [...content.querySelectorAll('*')].map(
        (element) => getComputedStyle(element).animationName,
      ),
    )
}

test('Home content enters in order while its decision uses its own motion', async ({
  page,
}) => {
  await installHomeMocks(page, homeWorld('first-use'))
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(
    page.getByRole('region', { name: 'Bước tiếp theo', exact: true }),
  ).toBeVisible()
  const blocks = await page.locator('.home-data-rise').evaluateAll((elements) =>
    elements.map((element) => {
      const style = getComputedStyle(element)
      return {
        name: style.animationName,
        delay: Number.parseFloat(style.animationDelay),
      }
    }),
  )
  expect(blocks.length).toBeGreaterThanOrEqual(4)
  expect(blocks.every((block) => block.name !== 'none')).toBe(true)
  expect(blocks.every((block) => block.delay >= 0 && block.delay <= 0.7)).toBe(
    true,
  )
  await expect(page.locator('main.ref-content')).toHaveAttribute('data-entered')
  await expect(page.locator('.home-explore')).toHaveCSS('opacity', '1')
  await expect(page.locator('.home-explore')).toHaveCSS('transform', 'none')
})

test('clinical history is still before its asynchronous results arrive', async ({
  page,
}) => {
  let releaseHistory!: () => void
  const historyReleased = new Promise<void>((resolve) => {
    releaseHistory = resolve
  })
  await page.route(
    '**/api/care/screening-episodes/history**',
    async (route) => {
      await historyReleased
      await route.fulfill({ json: { items: [], hasMore: false } })
    },
  )
  try {
    await page.goto('/assessments', { waitUntil: 'domcontentloaded' })
    await expectStillDuringEntrance(page.locator('#panel-history'))
    // A visible heading is animated concurrently, proving the history assertion
    // did not pass because all entrance motion had already been disabled.
    await expect(page.locator('.assessment-page h1')).toHaveCSS(
      'animation-name',
      'mb-title-rise',
    )
  } finally {
    releaseHistory()
  }
})

test('chat and SupportPlan keep their owning surfaces still', async ({
  page,
}) => {
  for (const route of ['/messages', '/ai-companion', '/support-plan']) {
    await page.goto(route, { waitUntil: 'domcontentloaded' })
    await expectStillDuringEntrance(
      page.locator('main.ref-content > [data-page-motion="off"]'),
    )
    if (route !== '/support-plan') {
      await expect(page.locator('.ref-still > *')).toHaveCSS(
        'animation-name',
        'none',
      )
    }
  }
})

test('navigation preserves the shell and later dialogs do not replay entrances', async ({
  page,
}) => {
  await installHomeMocks(page, homeWorld('first-use'))
  await page.goto('/dashboard')
  const content = page.locator('main.ref-content')
  await expect(content).toHaveAttribute('data-entered')
  await content.evaluate((element) => {
    element.setAttribute('data-mb744-shell', 'preserved')
  })
  await page.getByRole('link', { name: 'Nhật ký', exact: true }).first().click()
  await page.waitForURL(/\/journal$/)
  await expect(content).toHaveAttribute('data-mb744-shell', 'preserved')
  await expect(page.locator('.journal-live h1')).toHaveCSS(
    'animation-name',
    'mb-title-rise',
  )
  await expect(content).toHaveAttribute('data-entered')
  await page
    .getByRole('button', { name: /Viết nhật ký/ })
    .first()
    .click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(
    (await entranceNames(page)).some((name) => entranceName.test(name)),
  ).toBe(false)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(
    (await entranceNames(page)).some((name) => entranceName.test(name)),
  ).toBe(false)
})

test('reduced motion, a preference change and printing show final content', async ({
  page,
}) => {
  await installHomeMocks(page, homeWorld('first-use'))
  const enteringTile = page.locator('.home-explore .home-data-rise').first()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  expect(
    (await entranceNames(page)).some((name) => entranceName.test(name)),
  ).toBe(false)
  await expect(page.locator('.home-explore')).toHaveCSS('opacity', '1')
  await expect(page.locator('.home-explore')).toHaveCSS(
    'animation-name',
    'none',
  )
  await expect(enteringTile).toHaveCSS('animation-name', 'home-fade')
  await expect(enteringTile).toHaveCSS('transform', 'none')
  await expect(enteringTile).toHaveCSS('opacity', '1')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(
    page.getByRole('region', { name: 'Bước tiếp theo', exact: true }),
  ).toBeVisible()
  await expect(enteringTile).toHaveCSS('animation-name', 'home-rise')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.home-explore')).toHaveCSS(
    'animation-name',
    'none',
  )
  await expect(page.locator('.home-explore')).toHaveCSS('transform', 'none')
  await expect(enteringTile).toHaveCSS('animation-name', 'home-fade')
  await expect(enteringTile).toHaveCSS('transform', 'none')
  await expect(enteringTile).toHaveCSS('opacity', '1')
  await page.emulateMedia({ media: 'print', reducedMotion: 'no-preference' })
  expect(
    (await entranceNames(page)).some((name) => entranceName.test(name)),
  ).toBe(false)
  await expect(page.locator('.home-explore')).toHaveCSS('opacity', '1')
  await expect(enteringTile).toHaveCSS('animation-name', 'none')
  await expect(enteringTile).toHaveCSS('transform', 'none')
  await expect(enteringTile).toHaveCSS('opacity', '1')
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('server content reaches its visible resting state without a latch', async ({
    page,
  }) => {
    await page.goto('/dashboard')
    await expect(page.locator('.home-explore')).toHaveCSS('opacity', '1')
    await expect(page.locator('.home-explore')).toHaveCSS('transform', 'none')
    await expect(page.locator('.home-hub h1')).toHaveCSS('transform', 'none')
    await expect(page.locator('main.ref-content')).not.toHaveAttribute(
      'data-entered',
    )
    const resourcesLink = page
      .locator('.home-explore')
      .getByRole('link', { name: /^Tài nguyên/ })
    await expect(resourcesLink).toBeVisible()
    await expect(resourcesLink).toHaveAttribute('href', '/resources')
    await expect(resourcesLink).toHaveCSS('opacity', '1')
    await expect(resourcesLink).toHaveCSS('transform', 'none')
  })
})
