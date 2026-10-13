import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { chromium } from 'playwright'

const root = new URL('.', import.meta.url).pathname.slice(1)
const port = 4178

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, `http://127.0.0.1:${port}`).pathname
  const fileName =
    pathname === '/' ? 'support-plan-companion-desktop.html' : pathname.slice(1)
  const filePath = join(root, fileName)
  try {
    const body = await readFile(filePath)
    response.writeHead(200, {
      'content-type':
        extname(filePath) === '.html'
          ? 'text/html; charset=utf-8'
          : 'image/png',
    })
    response.end(body)
  } catch {
    response.writeHead(404)
    response.end('Not found')
  }
})

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve))
const browser = await chromium.launch({ headless: true })

async function inspect(fileName, viewport, outputName) {
  const page = await browser.newPage({ viewportSize: viewport })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`http://127.0.0.1:${port}/${fileName}`, {
    waitUntil: 'networkidle',
  })
  await page.evaluate(() => document.fonts.ready)

  const result = await page.evaluate(() => {
    const rootElement = document.documentElement
    const companion = document.querySelector('[id^="companion-"]')
    const controls = [
      ...document.querySelectorAll('[aria-controls^="companion-"]'),
    ]
    const labeledControls = [
      ...document.querySelectorAll('button[aria-label]'),
    ].filter((element) => element.closest('[id^="companion-"]'))
    const animated = document.querySelector(
      '.animate-gentle, .animate-halo, .companion-breath-pulse',
    )
    const animatedStyle = animated ? getComputedStyle(animated) : null
    return {
      companionVisible:
        companion instanceof HTMLElement && companion.offsetParent !== null,
      horizontalOverflow: rootElement.scrollWidth > rootElement.clientWidth + 1,
      beVietnamLoaded: document.fonts.check('16px "Be Vietnam Pro"'),
      bodyFont: getComputedStyle(document.body).fontFamily,
      controlSizes: labeledControls.map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          label: element.getAttribute('aria-label'),
          width: rect.width,
          height: rect.height,
          visible:
            element instanceof HTMLElement && element.offsetParent !== null,
        }
      }),
      controlsMeetTouchTarget: labeledControls.every((element) => {
        const rect = element.getBoundingClientRect()
        return (
          (element instanceof HTMLElement && element.offsetParent === null) ||
          (rect.width >= 44 && rect.height >= 44)
        )
      }),
      hasExpandedControl: controls.some(
        (element) => element.getAttribute('aria-expanded') === 'true',
      ),
      reducedMotionStatic:
        animatedStyle === null ||
        animatedStyle.animationName === 'none' ||
        animatedStyle.animationDuration === '0s',
      replacementGlyph: document.body.textContent?.includes('\uFFFD') ?? false,
    }
  })

  if (
    !result.companionVisible ||
    result.horizontalOverflow ||
    !result.beVietnamLoaded ||
    !result.controlsMeetTouchTarget ||
    !result.hasExpandedControl ||
    !result.reducedMotionStatic ||
    result.replacementGlyph
  ) {
    throw new Error(`${fileName}: ${JSON.stringify(result)}`)
  }

  await page.locator('[aria-expanded="true"]').first().click()
  const collapsedControl = page
    .locator('[aria-expanded="false"]:visible')
    .first()
  await collapsedControl.waitFor()
  await page.screenshot({ path: join(root, outputName), fullPage: true })
  await page.close()
  return result
}

try {
  const desktop = await inspect(
    'support-plan-companion-desktop.html',
    { width: 1280, height: 800 },
    'prototype-desktop-collapsed.png',
  )
  const mobile = await inspect(
    'support-plan-companion-mobile.html',
    { width: 375, height: 812 },
    'prototype-mobile-collapsed.png',
  )
  console.log(JSON.stringify({ desktop, mobile }, null, 2))
} finally {
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
}
