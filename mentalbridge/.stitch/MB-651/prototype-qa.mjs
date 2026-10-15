import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('.', import.meta.url))
const port = 4181
const server = createServer(async (_request, response) => {
  try {
    const body = await readFile(join(root, 'desktop.html'))
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    response.end(body)
  } catch {
    response.writeHead(404)
    response.end('Not found')
  }
})

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve))
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })

try {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`http://127.0.0.1:${port}`, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  const result = await page.evaluate(() => {
    const panel = document.querySelector('#companion-dock')
    const buttons = panel
      ? [...panel.querySelectorAll('button')].filter(
          (element) =>
            element instanceof HTMLElement && element.offsetParent !== null,
        )
      : []
    return {
      panelVisible: panel instanceof HTMLElement && panel.offsetParent !== null,
      beVietnamLoaded: document.fonts.check('16px "Be Vietnam Pro"'),
      fontSource: [...document.querySelectorAll('link[rel="stylesheet"]')]
        .map((link) => link.getAttribute('href') ?? '')
        .find((href) => href.includes('Be+Vietnam+Pro')),
      replacementGlyph: document.body.textContent?.includes('\uFFFD') ?? false,
      hasFreeTextInput: Boolean(
        panel?.querySelector('input, textarea, [contenteditable="true"]'),
      ),
      controlsDeclareTouchTarget: buttons.every((button) =>
        /(?:min-h-\[44px\]|h-11|min-w-\[44px\]|w-11)/.test(
          button.getAttribute('class') ?? '',
        ),
      ),
      horizontalOverflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
      approvedStarters: [
        'Vì sao hoạt động này có trong kế hoạch?',
        'Tôi nên bắt đầu từ đâu?',
        'Chỉ tôi nơi có thể điều chỉnh',
      ].every((copy) => panel?.textContent?.includes(copy)),
    }
  })
  if (
    !result.panelVisible ||
    !result.beVietnamLoaded ||
    result.replacementGlyph ||
    result.hasFreeTextInput ||
    !result.fontSource ||
    !result.controlsDeclareTouchTarget ||
    result.horizontalOverflow ||
    !result.approvedStarters
  )
    throw new Error(JSON.stringify(result))
  console.log(JSON.stringify(result, null, 2))
} finally {
  await page.close()
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
}
