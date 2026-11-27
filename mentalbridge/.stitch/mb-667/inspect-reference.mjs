import { chromium } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const output = resolve('test-results/mb-667-reference')
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  for (const [name, file, width, height] of [
    ['meaning-desktop', '03-result-meaning-desktop.html', 1440, 900],
    ['meaning-mobile', '04-result-meaning-mobile.html', 375, 812],
    ['history-desktop', '01-history-desktop.html', 1440, 900],
    ['history-mobile', '02-history-mobile.html', 375, 812],
    ['guide-desktop', '05-historical-guide-desktop.html', 1440, 900],
    ['guide-mobile', '06-historical-guide-mobile.html', 375, 812],
  ]) {
    const page = await browser.newPage({
      viewport: { width, height },
      reducedMotion: 'reduce',
    })
    page.on('pageerror', (error) => console.log(`${name}: ${error.message}`))
    await page.goto(pathToFileURL(resolve('.stitch/mb-667', file)).href)
    await page.evaluate(() => document.fonts.ready)
    // Stitch entrance styles can leave a screenshot blank before IntersectionObserver runs.
    await page.addStyleTag({
      content:
        'html,body,.fade-slide-up { opacity: 1 !important; transform: none !important; }',
    })
    await page.screenshot({
      path: resolve(output, `${name}.png`),
      fullPage: true,
    })
    if (name.startsWith('meaning')) {
      const controller = await page
        .locator(
          'script[data-purpose="context-mode-controller"],script[data-purpose="result-and-mode-interactions"]',
        )
        .textContent()
      if (controller && name === 'meaning-desktop')
        await page.addScriptTag({
          content: `(() => { ${controller}; window.mbReference = { switchContextMode, toggleLoadingSkeleton }; })()`,
        })
      if (name === 'meaning-mobile') {
        await page.close()
        continue
      }
      for (const state of ['historical', 'missing', 'safety']) {
        await page.evaluate(
          (mode) => window.mbReference.switchContextMode(mode),
          state,
        )
        await page.screenshot({
          path: resolve(output, `${name}-${state}.png`),
          fullPage: true,
        })
      }
      await page.evaluate(() => window.mbReference.toggleLoadingSkeleton())
      await page.screenshot({
        path: resolve(output, `${name}-loading.png`),
        fullPage: true,
      })
    }
    console.log(`${name}: captured`)
    await page.close()
  }
} finally {
  await browser.close()
}
