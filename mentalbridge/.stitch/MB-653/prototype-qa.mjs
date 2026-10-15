import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('.', import.meta.url))
const port = 4183
const server = createServer(async (request, response) => {
  const file = request.url === '/mobile' ? 'mobile.html' : 'desktop.html'
  try {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    response.end(await readFile(join(root, file)))
  } catch {
    response.writeHead(404)
    response.end('Not found')
  }
})

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve))
const browser = await chromium.launch({ headless: true })

try {
  for (const profile of [
    { name: 'desktop', path: '/', width: 1280, height: 800 },
    { name: 'mobile', path: '/mobile', width: 375, height: 812 },
  ]) {
    const page = await browser.newPage({
      viewport: { width: profile.width, height: profile.height },
    })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`http://127.0.0.1:${port}${profile.path}`, {
      waitUntil: 'networkidle',
    })
    await page.evaluate(() => document.fonts.ready)
    const result = await page.evaluate(() => {
      const companionButton = document.querySelector(
        '[aria-label="Mở rộng bạn đồng hành"], #companion-expand-btn',
      )
      const save = [...document.querySelectorAll('button')].find(
        (element) =>
          element.offsetParent && element.textContent?.includes('Lưu thay đổi'),
      )
      const cancel = [...document.querySelectorAll('button')].find(
        (element) =>
          element.offsetParent && element.textContent?.trim() === 'Hủy',
      )
      const companion = document.querySelector(
        '#companion-dock, #companion-tray',
      )
      const overlaps = (left, right) => {
        if (!left || !right) return true
        const a = left.getBoundingClientRect()
        const b = right.getBoundingClientRect()
        return !(
          a.right <= b.left ||
          a.left >= b.right ||
          a.bottom <= b.top ||
          a.top >= b.bottom
        )
      }
      const target = companionButton?.getBoundingClientRect()
      const bodyFont = getComputedStyle(document.body).fontFamily
      const heading = document.querySelector('h1')
      const headingFont = heading ? getComputedStyle(heading).fontFamily : ''

      return {
        beVietnamLoaded: document.fonts.check('16px "Be Vietnam Pro"'),
        bodyFont,
        headingFont,
        fontDeclared: [...document.querySelectorAll('link[rel="stylesheet"]')]
          .map((link) => link.getAttribute('href') ?? '')
          .some((href) => href.includes('Be+Vietnam+Pro')),
        replacementGlyph:
          document.body.textContent?.includes('\uFFFD') ?? false,
        companionTarget:
          (target?.width ?? 0) >= 44 && (target?.height ?? 0) >= 44,
        saveVisible: Boolean(save && save.offsetParent),
        cancelVisible: Boolean(cancel && cancel.offsetParent),
        companionOverlapsActions:
          overlaps(companion, save) || overlaps(companion, cancel),
        hasChatInput: Boolean(
          companion?.querySelector(
            'textarea, input[type="text"], [contenteditable="true"]',
          ),
        ),
        unsolicitedAlert: Boolean(companion?.querySelector('[role="alert"]')),
        brokenSvg: [...document.querySelectorAll('svg')].some(
          (svg) => !svg.getAttribute('viewBox'),
        ),
        horizontalOverflow:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth + 1,
      }
    })

    if (
      !result.beVietnamLoaded ||
      !result.bodyFont.includes('Be Vietnam Pro') ||
      !/(Fraunces|Newsreader)/.test(result.headingFont) ||
      !result.fontDeclared ||
      result.replacementGlyph ||
      !result.companionTarget ||
      !result.saveVisible ||
      !result.cancelVisible ||
      result.companionOverlapsActions ||
      result.hasChatInput ||
      result.unsolicitedAlert ||
      result.brokenSvg ||
      result.horizontalOverflow
    ) {
      throw new Error(`${profile.name}: ${JSON.stringify(result)}`)
    }
    console.log(profile.name, JSON.stringify(result))
    await page.close()
  }
} finally {
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
}
