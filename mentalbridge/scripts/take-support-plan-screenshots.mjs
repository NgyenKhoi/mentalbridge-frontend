import { resolve } from 'node:path'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium } from '@playwright/test'

const root = resolve(import.meta.dirname, '..')
const artifactsDir =
  'C:\\Users\\Admin\\.gemini\\antigravity\\brain\\3f72caff-c408-4194-9194-f7cc5ef13063'

const server = await createServer({
  root,
  plugins: [react()],
  logLevel: 'error',
  resolve: {
    alias: { '@': root },
  },
  server: { host: '127.0.0.1', port: 5198, strictPort: true },
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
  // 1. Desktop 1440px
  console.log('[screenshot] Capturing Desktop 1440px...')
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 1.5,
  })
  const desktopPage = await desktopContext.newPage()
  desktopPage.on('console', (msg) => console.log('BROWSER LOG:', msg.text()))
  desktopPage.on('pageerror', (err) => console.error('BROWSER ERROR:', err))

  await desktopPage.goto(`${baseUrl}/tests/support-plan-harness/`, {
    waitUntil: 'domcontentloaded',
  })

  await desktopPage.waitForSelector('.support-plan-page')
  await desktopPage.waitForTimeout(400)
  await desktopPage.screenshot({
    path: resolve(artifactsDir, 'support_plan_fixed_desktop_1440.png'),
    fullPage: true,
  })
  console.log('[screenshot] Saved support_plan_fixed_desktop_1440.png')

  // 2. Tablet 1024px
  console.log('[screenshot] Capturing Tablet 1024px...')
  const tabletContext = await browser.newContext({
    viewport: { width: 1024, height: 950 },
    deviceScaleFactor: 1.5,
  })
  const tabletPage = await tabletContext.newPage()
  await tabletPage.goto(`${baseUrl}/tests/support-plan-harness/`, {
    waitUntil: 'domcontentloaded',
  })
  await tabletPage.waitForSelector('.support-plan-page')
  await tabletPage.waitForTimeout(400)
  await tabletPage.screenshot({
    path: resolve(artifactsDir, 'support_plan_fixed_tablet_1024.png'),
    fullPage: true,
  })
  console.log('[screenshot] Saved support_plan_fixed_tablet_1024.png')

  // 3. Tablet 768px
  console.log('[screenshot] Capturing Tablet 768px...')
  const compactTabletContext = await browser.newContext({
    viewport: { width: 768, height: 900 },
    deviceScaleFactor: 1.5,
  })
  const compactTabletPage = await compactTabletContext.newPage()
  await compactTabletPage.goto(`${baseUrl}/tests/support-plan-harness/`, {
    waitUntil: 'domcontentloaded',
  })
  await compactTabletPage.waitForSelector('.support-plan-page')
  await compactTabletPage.waitForTimeout(400)
  await compactTabletPage.screenshot({
    path: resolve(artifactsDir, 'support_plan_fixed_tablet_768.png'),
    fullPage: true,
  })
  console.log('[screenshot] Saved support_plan_fixed_tablet_768.png')

  // 4. Mobile 390px
  console.log('[screenshot] Capturing Mobile 390px...')
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  })
  const mobilePage = await mobileContext.newPage()
  await mobilePage.goto(`${baseUrl}/tests/support-plan-harness/`, {
    waitUntil: 'domcontentloaded',
  })
  await mobilePage.waitForSelector('.support-plan-page')
  await mobilePage.waitForTimeout(400)
  await mobilePage.screenshot({
    path: resolve(artifactsDir, 'support_plan_fixed_mobile_390.png'),
    fullPage: true,
  })
  console.log('[screenshot] Saved support_plan_fixed_mobile_390.png')
} finally {
  await browser.close()
  await server.close()
}
