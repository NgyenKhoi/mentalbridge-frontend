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
  server: { host: '127.0.0.1', port: 5195, strictPort: true },
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
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
    deviceScaleFactor: 1.5,
  })
  const page = await desktopContext.newPage()
  page.on('console', (msg) => console.log('BROWSER LOG:', msg.text()))
  page.on('pageerror', (err) => console.error('BROWSER ERROR:', err))

  await page.goto(`${baseUrl}/tests/dashboard-harness/`, {
    waitUntil: 'load',
  })

  await page.waitForSelector('.ref-panel')
  await page.waitForTimeout(400)
  await page.screenshot({
    path: resolve(artifactsDir, 'dashboard_3_columns_with_gad7.png'),
    fullPage: false,
  })
  console.log('[screenshot] Saved dashboard_3_columns_with_gad7.png')
} finally {
  await browser.close()
  await server.close()
}
