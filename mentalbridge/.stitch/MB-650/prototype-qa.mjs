import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('.', import.meta.url))
const port = 4180
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, `http://127.0.0.1:${port}`).pathname
  const fileName = pathname.slice(1) || 'support-plan-contextual-desktop.html'
  try {
    const body = await readFile(join(root, fileName))
    response.writeHead(200, {
      'content-type':
        extname(fileName) === '.html' ? 'text/html; charset=utf-8' : 'image/png',
    })
    response.end(body)
  } catch {
    response.writeHead(404)
    response.end('Not found')
  }
})

await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve))
const browser = await chromium.launch({ headless: true })

async function inspect(fileName, viewport) {
  const page = await browser.newPage({ viewportSize: viewport })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`http://127.0.0.1:${port}/${fileName}`, {
    waitUntil: 'networkidle',
  })
  await page.evaluate(() => document.fonts.ready)
  const result = await page.evaluate(() => {
    const visibleButtons = [...document.querySelectorAll('button')].filter(
      (element) => element instanceof HTMLElement && element.offsetParent !== null,
    )
    const companionResponse = document.querySelector(
      '#companion-bubble-resource, #companion-tray',
    )
    return {
      responseVisible:
        companionResponse instanceof HTMLElement &&
        companionResponse.offsetParent !== null,
      horizontalOverflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
      beVietnamLoaded: document.fonts.check('16px "Be Vietnam Pro"'),
      bodyFont: getComputedStyle(document.body).fontFamily,
      replacementGlyph: document.body.textContent?.includes('\uFFFD') ?? false,
      controlsMeetTouchTarget: visibleButtons
        .filter((button) =>
          button.closest('#companion-bubble-resource, #companion-tray'),
        )
        .every((button) => {
          const rect = button.getBoundingClientRect()
          return rect.width >= 44 && rect.height >= 44
        }),
      primaryActionVisible: visibleButtons.some((button) =>
        /Bắt đầu|Ghi nhận|Mở nhật ký|chuyên gia/i.test(
          button.textContent ?? '',
        ),
      ),
      reducedMotionStatic: [...document.querySelectorAll('*')]
        .filter((element) => {
          const name = getComputedStyle(element).animationName
          return name && name !== 'none'
        })
        .every((element) => getComputedStyle(element).animationDuration === '0s'),
    }
  })
  await page.close()
  if (
    !result.responseVisible ||
    result.horizontalOverflow ||
    !result.beVietnamLoaded ||
    result.replacementGlyph ||
    !result.controlsMeetTouchTarget ||
    !result.primaryActionVisible ||
    !result.reducedMotionStatic
  )
    throw new Error(`${fileName}: ${JSON.stringify(result)}`)
  return result
}

try {
  const desktop = await inspect('support-plan-contextual-desktop.html', {
    width: 1280,
    height: 800,
  })
  const mobile = await inspect('support-plan-contextual-mobile.html', {
    width: 375,
    height: 812,
  })
  console.log(JSON.stringify({ desktop, mobile }, null, 2))
} finally {
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
}
