import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('.', import.meta.url))
const port = 4182
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

    const button = page.getByRole('button', {
      name: 'Xem chi tiết tại mục Điều chỉnh',
    })
    const buttonClasses = await button.getAttribute('class')
    if (!buttonClasses?.includes('min-h-[44px]')) {
      throw new Error(`${profile.name}: review navigation has no 44px contract`)
    }

    const initial = await page.evaluate(() => ({
      replacementGlyph: document.body.textContent?.includes('\uFFFD') ?? false,
      horizontalOverflow:
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
      hasRawJournalInput: Boolean(
        document.querySelector(
          '#companion-dock textarea, #companion-dock input[type="text"], #companion-guided-sheet textarea, #companion-guided-sheet input[type="text"]',
        ),
      ),
      hasContradiction: document.body.textContent?.includes(
        'Các tín hiệu chưa hoàn toàn cùng chiều',
      ),
      keepsIndependentScreening:
        document.body.textContent?.includes('PHQ-9') &&
        document.body.textContent?.includes('GAD-7'),
      hasConfirmationBoundary: document.body.textContent?.includes(
        'Kế hoạch chỉ thay đổi khi bạn xác nhận trong mục Điều chỉnh.',
      ),
    }))

    if (
      initial.replacementGlyph ||
      initial.horizontalOverflow ||
      initial.hasRawJournalInput ||
      !initial.hasContradiction ||
      !initial.keepsIndependentScreening ||
      !initial.hasConfirmationBoundary
    ) {
      throw new Error(`${profile.name}: ${JSON.stringify(initial)}`)
    }

    await button.click()
    const navigation =
      profile.name === 'desktop'
        ? await page.locator('#tab-settings').getAttribute('aria-selected')
        : await page.locator('#tab-adjust').getAttribute('aria-selected')
    const sheetClosed =
      profile.name === 'desktop'
        ? true
        : await page
            .locator('#companion-guided-sheet-backdrop')
            .evaluate((element) => getComputedStyle(element).display === 'none')

    if (navigation !== 'true' || !sheetClosed) {
      throw new Error(
        `${profile.name}: review navigation did not preserve the authoritative Adjust flow`,
      )
    }

    console.log(profile.name, JSON.stringify({ ...initial, navigation }))
    await page.close()
  }
} finally {
  await browser.close()
  await new Promise((resolve) => server.close(resolve))
}
