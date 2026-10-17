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
  server: { host: '127.0.0.1', port: 5188, strictPort: true },
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
  console.log('[screenshot] Capturing Desktop Journal Editor popup...')
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 850 },
    deviceScaleFactor: 1.5,
  })
  const desktopPage = await desktopContext.newPage()
  desktopPage.on('console', (msg) => console.log('BROWSER LOG:', msg.text()))
  desktopPage.on('pageerror', (err) => console.error('BROWSER ERROR:', err))

  await desktopPage.goto(`${baseUrl}/tests/journal-harness/`, {
    waitUntil: 'load',
  })

  await desktopPage.waitForSelector('.journal-dialog-editor')
  await desktopPage.waitForTimeout(300)
  await desktopPage.screenshot({
    path: resolve(artifactsDir, 'desktop_journal_editor_popup.png'),
    fullPage: false,
  })
  console.log('[screenshot] Saved desktop_journal_editor_popup.png')

  // 2. MOBILE VIEWPORT (390 x 844)
  console.log('[screenshot] Capturing Mobile Journal Editor popup...')
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
  })
  const mobilePage = await mobileContext.newPage()
  await mobilePage.goto(`${baseUrl}/tests/journal-harness/`, {
    waitUntil: 'load',
  })

  await mobilePage.waitForSelector('.journal-dialog-editor')
  await mobilePage.waitForTimeout(300)
  await mobilePage.screenshot({
    path: resolve(artifactsDir, 'mobile_journal_editor_popup.png'),
    fullPage: false,
  })
  console.log('[screenshot] Saved mobile_journal_editor_popup.png')
} finally {
  await browser.close()
  await server.close()
}
