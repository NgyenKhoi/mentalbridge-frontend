import { resolve } from 'node:path'
import { createServer } from 'vite'
import { chromium } from '@playwright/test'

const root = resolve(import.meta.dirname, '..')
const artifactsDir =
  'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\3f72caff-c408-4194-9194-f7cc5ef13063'

const server = await createServer({
  root,
  logLevel: 'error',
  resolve: {
    alias: { '@': root },
  },
  server: { host: '127.0.0.1', port: 0, strictPort: true },
})

await server.listen()
const address = server.httpServer?.address()
if (!address || typeof address === 'string') {
  throw new Error('Vite server did not expose a port.')
}

const baseUrl = `http://127.0.0.1:${address.port}`
console.log(`[screenshot] Vite harness server running at: ${baseUrl}`)

const browser = await chromium.launch({ headless: true })

try {
  // 1. DESKTOP VIEWPORT (1280 x 850)
  console.log('[screenshot] Capturing Desktop screenshots...')
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 850 },
    deviceScaleFactor: 1.5,
  })
  const desktopPage = await desktopContext.newPage()
  await desktopPage.goto(`${baseUrl}/tests/assessment-harness/`, {
    waitUntil: 'networkidle',
  })

  // Screenshot 1: Desktop History List (Closed Modal)
  await desktopPage.waitForSelector('.history-rows-list')
  await desktopPage.screenshot({
    path: resolve(artifactsDir, 'desktop_1_history_list_closed.png'),
    fullPage: false,
  })
  console.log('[screenshot] Saved desktop_1_history_list_closed.png')

  // Screenshot 2: Desktop Compare Modal
  await desktopPage.getByRole('button', { name: 'So sánh' }).first().click()
  await desktopPage.waitForSelector('.assessment-modal-compare')
  await desktopPage.waitForTimeout(300) // wait for animation
  await desktopPage.screenshot({
    path: resolve(artifactsDir, 'desktop_2_compare_modal.png'),
    fullPage: false,
  })
  console.log('[screenshot] Saved desktop_2_compare_modal.png')

  // Close Compare Modal
  await desktopPage.getByRole('button', { name: 'Đóng so sánh' }).click()
  await desktopPage.waitForSelector('.assessment-modal-compare', {
    state: 'detached',
  })

  // Screenshot 3: Desktop Review Modal
  await desktopPage.getByRole('button', { name: 'Xem lại' }).first().click()
  await desktopPage.waitForSelector('.assessment-modal-detail')
  await desktopPage.waitForTimeout(300) // wait for animation
  await desktopPage.screenshot({
    path: resolve(artifactsDir, 'desktop_3_review_modal.png'),
    fullPage: false,
  })
  console.log('[screenshot] Saved desktop_3_review_modal.png')

  await desktopContext.close()

  // 2. MOBILE VIEWPORT (375 x 720)
  console.log('[screenshot] Capturing Mobile screenshots...')
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 720 },
    deviceScaleFactor: 2,
    isMobile: true,
  })
  const mobilePage = await mobileContext.newPage()
  await mobilePage.goto(`${baseUrl}/tests/assessment-harness/`, {
    waitUntil: 'networkidle',
  })

  // Screenshot 4: Mobile History List (Closed Modal)
  await mobilePage.waitForSelector('.history-rows-list')
  await mobilePage.screenshot({
    path: resolve(artifactsDir, 'mobile_1_history_list_closed.png'),
    fullPage: false,
  })
  console.log('[screenshot] Saved mobile_1_history_list_closed.png')

  // Screenshot 5: Mobile Compare Bottom Sheet
  await mobilePage.getByRole('button', { name: 'So sánh' }).first().click()
  await mobilePage.waitForSelector('.assessment-modal-compare')
  await mobilePage.waitForTimeout(300)
  await mobilePage.screenshot({
    path: resolve(artifactsDir, 'mobile_2_compare_bottom_sheet.png'),
    fullPage: false,
  })
  console.log('[screenshot] Saved mobile_2_compare_bottom_sheet.png')

  // Close Compare Modal
  await mobilePage.getByRole('button', { name: 'Đóng so sánh' }).click()
  await mobilePage.waitForSelector('.assessment-modal-compare', {
    state: 'detached',
  })

  // Screenshot 6: Mobile Review Bottom Sheet
  await mobilePage.getByRole('button', { name: 'Xem lại' }).first().click()
  await mobilePage.waitForSelector('.assessment-modal-detail')
  await mobilePage.waitForTimeout(300)
  await mobilePage.screenshot({
    path: resolve(artifactsDir, 'mobile_3_review_bottom_sheet.png'),
    fullPage: false,
  })
  console.log('[screenshot] Saved mobile_3_review_bottom_sheet.png')

  await mobileContext.close()
  console.log('[screenshot] All 6 screenshots successfully captured!')
} finally {
  await browser.close()
  await server.close()
}
