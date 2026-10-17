import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import { chromium } from 'playwright'

const outputDirectory = path.resolve('test-results', 'journal-capture')
await mkdir(outputDirectory, { recursive: true })

const browser = await chromium.launch({ headless: true })

try {
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  })
  const desktopPage = await desktopContext.newPage()
  await desktopPage.goto('http://localhost:3000/journal', {
    waitUntil: 'networkidle',
  })
  await desktopPage.waitForTimeout(1000)
  await desktopPage.screenshot({
    path: path.join(outputDirectory, 'journal-redesign-desktop.png'),
    fullPage: false,
  })
  await desktopContext.close()

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  })
  const mobilePage = await mobileContext.newPage()
  await mobilePage.goto('http://localhost:3000/journal', {
    waitUntil: 'networkidle',
  })
  await mobilePage.waitForTimeout(1000)
  await mobilePage.screenshot({
    path: path.join(outputDirectory, 'journal-redesign-mobile.png'),
    fullPage: false,
  })
  await mobileContext.close()
} finally {
  await browser.close()
}
