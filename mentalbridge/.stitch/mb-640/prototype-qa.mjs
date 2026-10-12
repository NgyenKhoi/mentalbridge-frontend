import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { chromium } from 'playwright'

const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
})

const cases = [
  {
    name: 'desktop',
    file: 'support-plan-schedule-desktop-prototype.html',
    screenshot: 'support-plan-schedule-desktop-runtime.png',
    viewport: { width: 1440, height: 900 },
  },
  {
    name: 'mobile',
    file: 'support-plan-schedule-mobile-stitch.html',
    screenshot: 'support-plan-schedule-mobile-runtime.png',
    viewport: { width: 375, height: 812 },
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

  await page.goto(
    pathToFileURL(path.resolve(import.meta.dirname, testCase.file)).href,
    { waitUntil: 'networkidle' },
  )
  await page.evaluate(() => document.fonts.ready)

  const render = await page.evaluate(() => {
    const heading = document.querySelector('h1')
    const save = [...document.querySelectorAll('button')].find(
      (button) => button.textContent?.replace(/\s+/g, ' ').trim() === 'Lưu nhịp',
    )
    const saveRect = save?.getBoundingClientRect()
    return {
      bodyFont: getComputedStyle(document.body).fontFamily,
      headingFont: heading ? getComputedStyle(heading).fontFamily : '',
      viewport: window.innerWidth,
      content: document.documentElement.scrollWidth,
      saveWidth: saveRect?.width ?? 0,
      saveHeight: saveRect?.height ?? 0,
      hasSidebar: Boolean(document.querySelector('aside')),
      hasMobileHeader: Boolean(document.querySelector('header')),
    }
  })

  check(
    render.bodyFont.includes('Be Vietnam Pro'),
    `${testCase.name}: body font is ${render.bodyFont}`,
  )
  check(
    /Newsreader|Fraunces/.test(render.headingFont),
    `${testCase.name}: heading font is ${render.headingFont}`,
  )
  check(
    render.content <= render.viewport + 1,
    `${testCase.name}: horizontal overflow ${render.content}/${render.viewport}`,
  )
  check(
    render.saveHeight >= 44,
    `${testCase.name}: save touch target height is ${render.saveHeight}`,
  )
  check(
    testCase.name === 'desktop' ? render.hasSidebar : render.hasMobileHeader,
    `${testCase.name}: locked shell marker is missing`,
  )

  const save = page.getByRole('button', { name: 'Lưu nhịp' })
  await save.click()
  const activate = page.getByRole('button', {
    name: 'Bắt đầu kế hoạch này',
  })
  check(
    await activate.isEnabled(),
    `${testCase.name}: save did not unlock activation`,
  )

  const reload = page.getByRole('button', { name: 'Tải lịch mới nhất' })
  if (await reload.count()) {
    await reload.click()
  }

  const layoutAfter = await page.evaluate(() => ({
    viewport: window.innerWidth,
    content: document.documentElement.scrollWidth,
  }))
  check(
    layoutAfter.content <= layoutAfter.viewport + 1,
    `${testCase.name}: interaction caused horizontal overflow`,
  )
  check(
    runtimeErrors.length === 0,
    `${testCase.name}: runtime errors: ${runtimeErrors.join(' | ')}`,
  )

  await page.screenshot({
    path: path.resolve(import.meta.dirname, testCase.screenshot),
    fullPage: true,
  })
  await page.close()
}

await browser.close()

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('MB640_PROTOTYPE_QA_PASS')
