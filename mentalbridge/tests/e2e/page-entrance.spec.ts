import { expect, type Locator, type Page } from '@playwright/test'

import { test } from './test-fixtures'

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

test('USER blocks enter in order while the clinical dashboard stays still', async ({
  page,
}) => {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expectStillDuringEntrance(page.locator('.ref-panel-result'))
  const blocks = await page
    .locator('.ref-today, .ref-quick, .ref-journal-streak')
    .evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element)
        return {
          name: style.animationName,
          delay: Number.parseFloat(style.animationDelay),
        }
      }),
    )
  expect(blocks).toHaveLength(3)
  expect(blocks.map((block) => block.name)).toEqual([
    'mb-unfold',
    'mb-unfold',
    'mb-unfold',
  ])
  expect(blocks.map((block) => block.delay)).toEqual([0.18, 0.24, 0.3])
  await expect(page.locator('main.ref-content')).toHaveAttribute('data-entered')
  await expect(page.locator('.ref-quick')).toHaveCSS('opacity', '1')
  await expect(page.locator('.ref-quick')).toHaveCSS('transform', 'none')
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
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  expect(
    (await entranceNames(page)).some((name) => entranceName.test(name)),
  ).toBe(false)
  await expect(page.locator('.ref-quick')).toHaveCSS('opacity', '1')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.ref-quick')).toHaveCSS(
    'animation-name',
    'mb-unfold',
  )
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('.ref-quick')).toHaveCSS('animation-name', 'none')
  await expect(page.locator('.ref-quick')).toHaveCSS('transform', 'none')
  await page.emulateMedia({ media: 'print', reducedMotion: 'no-preference' })
  expect(
    (await entranceNames(page)).some((name) => entranceName.test(name)),
  ).toBe(false)
  await expect(page.locator('.ref-quick')).toHaveCSS('opacity', '1')
})

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false })

  test('server content reaches its visible resting state without a latch', async ({
    page,
  }) => {
    await page.goto('/dashboard')
    await expect(page.locator('.ref-quick')).toHaveCSS('opacity', '1')
    await expect(page.locator('.ref-quick')).toHaveCSS('transform', 'none')
    await expect(page.locator('.ref-dashboard h1')).toHaveCSS(
      'transform',
      'none',
    )
    await expect(page.locator('main.ref-content')).not.toHaveAttribute(
      'data-entered',
    )
    await expect(
      page.getByRole('link', { name: /Bắt đầu kiểm tra ban đầu/ }),
    ).toBeVisible()
  })
})
