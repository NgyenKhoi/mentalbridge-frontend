import { pathToFileURL } from 'node:url'
import path from 'node:path'

import { chromium } from 'playwright'

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
})

const cases = [
  {
    name: 'desktop',
    file: 'support-plan-today-desktop-v2.html',
    screenshot: 'support-plan-today-desktop-approved.png',
    viewport: { width: 1440, height: 1000 },
  },
  {
    name: 'mobile',
    file: 'support-plan-today-mobile-approved.html',
    screenshot: 'support-plan-today-mobile-runtime.png',
    viewport: { width: 390, height: 844 },
  },
]

const failures = []

function check(condition, message) {
  if (!condition) failures.push(message)
}

for (const testCase of cases) {
  const page = await browser.newPage({
    viewport: testCase.viewport,
    reducedMotion: 'reduce',
  })
  const runtimeErrors = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text())
  })

  const filePath = path.resolve(import.meta.dirname, testCase.file)
  await page.goto(pathToFileURL(filePath).href, {
    waitUntil: 'networkidle',
  })
  await page.evaluate(() => document.fonts.ready)

  const fonts = await page.evaluate(() => ({
    body: getComputedStyle(document.body).fontFamily,
    heading: getComputedStyle(document.querySelector('h1')).fontFamily,
  }))
  check(
    fonts.body.includes('Be Vietnam Pro'),
    `${testCase.name}: body font is ${fonts.body}`,
  )
  check(
    fonts.heading.includes('Fraunces'),
    `${testCase.name}: heading font is ${fonts.heading}`,
  )

  const tabs = page.getByRole('tab')
  check((await tabs.count()) === 4, `${testCase.name}: expected four tabs`)

  for (let index = 0; index < 4; index += 1) {
    const tab = tabs.nth(index)
    await tab.click()
    const panelId = await tab.getAttribute('aria-controls')
    check(Boolean(panelId), `${testCase.name}: tab ${index} has no panel`)
    if (panelId) {
      check(
        await page.locator(`#${panelId}`).isVisible(),
        `${testCase.name}: ${panelId} did not become visible`,
      )
    }
    check(
      (await tab.getAttribute('aria-selected')) === 'true',
      `${testCase.name}: tab ${index} was not selected`,
    )
  }

  await tabs.first().focus()
  await page.keyboard.press('End')
  check(
    (await tabs.last().getAttribute('aria-selected')) === 'true',
    `${testCase.name}: End did not select the last tab`,
  )
  await page.keyboard.press('Home')
  check(
    (await tabs.first().getAttribute('aria-selected')) === 'true',
    `${testCase.name}: Home did not select the first tab`,
  )
  await page.keyboard.press('ArrowRight')
  check(
    (await tabs.nth(1).getAttribute('aria-selected')) === 'true',
    `${testCase.name}: ArrowRight did not select the next tab`,
  )
  await tabs.first().click()

  const deferTrigger = page.getByRole('button', {
    name: /Dời sang lúc khác|Dời lịch/,
  }).first()
  check(await deferTrigger.isVisible(), `${testCase.name}: defer action missing`)
  await deferTrigger.evaluate((element) => {
    element.dataset.qaTrigger = 'true'
  })
  await deferTrigger.click()
  await page.waitForTimeout(350)
  const openDialog = page.locator('[role="dialog"]:not(.hidden)').first()
  check(await openDialog.isVisible(), `${testCase.name}: defer dialog did not open`)
  check(
    await page.evaluate(() =>
      document
        .querySelector('[role="dialog"]:not(.hidden)')
        ?.contains(document.activeElement),
    ),
    `${testCase.name}: dialog did not receive focus`,
  )
  await page.keyboard.press('Escape')
  await page.waitForTimeout(350)
  check(!(await openDialog.isVisible()), `${testCase.name}: Escape did not close dialog`)
  check(
    await page.evaluate(() => document.activeElement?.dataset.qaTrigger === 'true'),
    `${testCase.name}: focus did not return to defer action`,
  )

  const layout = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }))
  check(
    layout.content <= layout.viewport + 1,
    `${testCase.name}: horizontal overflow ${layout.content}/${layout.viewport}`,
  )

  await page.screenshot({
    path: path.resolve(import.meta.dirname, testCase.screenshot),
    fullPage: true,
  })

  check(
    runtimeErrors.length === 0,
    `${testCase.name}: runtime errors: ${runtimeErrors.join(' | ')}`,
  )
  console.log(
    `${testCase.name}: tabs, keyboard, dialog, focus, fonts, overflow and render checked`,
  )
  await page.close()
}

await browser.close()

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('PROTOTYPE_QA_PASS')
