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
  server: { host: '127.0.0.1', port: 5190, strictPort: true },
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
  // 1. DESKTOP VIEWPORT (1440 x 950)
  console.log('[screenshot] Capturing 1440px Journal Timeline...')
  const ctx1440 = await browser.newContext({
    viewport: { width: 1440, height: 950 },
    deviceScaleFactor: 1.5,
  })
  const page1440 = await ctx1440.newPage()
  await page1440.goto(`${baseUrl}/tests/journal-timeline-harness/`, {
    waitUntil: 'networkidle',
  })
  await page1440.waitForTimeout(500)
  await page1440.screenshot({
    path: resolve(artifactsDir, 'journal_seamless_1440.png'),
    fullPage: false,
  })
  console.log('[screenshot] Saved journal_seamless_1440.png')

  // 2. TABLET / SMALL DESKTOP VIEWPORT (1024 x 850)
  console.log('[screenshot] Capturing 1024px Journal Timeline...')
  const ctx1024 = await browser.newContext({
    viewport: { width: 1024, height: 850 },
    deviceScaleFactor: 1.5,
  })
  const page1024 = await ctx1024.newPage()
  await page1024.goto(`${baseUrl}/tests/journal-timeline-harness/`, {
    waitUntil: 'networkidle',
  })
  await page1024.waitForTimeout(500)
  await page1024.screenshot({
    path: resolve(artifactsDir, 'journal_seamless_1024.png'),
    fullPage: false,
  })
  console.log('[screenshot] Saved journal_seamless_1024.png')

  // 3. MOBILE VIEWPORT (390 x 844)
  console.log('[screenshot] Capturing 390px Mobile Journal Timeline...')
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  })
  const mobilePage = await mobileContext.newPage()
  await mobilePage.goto(`${baseUrl}/tests/journal-timeline-harness/`, {
    waitUntil: 'networkidle',
  })
  await mobilePage.waitForTimeout(500)
  await mobilePage.screenshot({
    path: resolve(artifactsDir, 'journal_seamless_390.png'),
    fullPage: false,
  })
  console.log('[screenshot] Saved journal_seamless_390.png')
} finally {
  await browser.close()
  await server.close()
}
