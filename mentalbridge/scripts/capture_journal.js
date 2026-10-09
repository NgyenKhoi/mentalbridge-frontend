;(async () => {
  const { chromium } = await import('playwright')
  const browser = await chromium.launch({ headless: true })

  // Desktop
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  })
  const desktopPage = await desktopContext.newPage()
  await desktopPage.goto('http://localhost:3000/journal', {
    waitUntil: 'networkidle',
  })
  await desktopPage.waitForTimeout(1000)
  await desktopPage.screenshot({
    path: 'C:/Users/Admin/.gemini/antigravity/brain/3f72caff-c408-4194-9194-f7cc5ef13063/journal_redesign_desktop.png',
    fullPage: false,
  })
  await desktopContext.close()

  // Mobile
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
    path: 'C:/Users/Admin/.gemini/antigravity/brain/3f72caff-c408-4194-9194-f7cc5ef13063/journal_redesign_mobile.png',
    fullPage: false,
  })
  await mobileContext.close()

  await browser.close()
  console.log('Screenshots saved successfully')
})()
