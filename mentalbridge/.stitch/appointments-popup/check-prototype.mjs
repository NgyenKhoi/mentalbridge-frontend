import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const directory = path.dirname(fileURLToPath(import.meta.url))
const browser = await chromium.launch({ headless: true })

for (const [name, width, height] of [
  ['desktop', 1440, 900],
  ['mobile', 375, 812],
]) {
  const page = await browser.newPage({ viewport: { width, height } })
  await page.goto(new URL('./prototype.html', import.meta.url).href)
  await page.getByRole('button', { name: 'Xem chi tiết' }).click()
  if (!(await page.getByRole('dialog').isVisible()))
    throw new Error(`${name}: dialog did not open`)
  await page.locator('dialog').evaluate((element) =>
    Promise.all(element.getAnimations().map((animation) => animation.finished)),
  )
  await page.screenshot({ path: path.join(directory, `prototype-${name}.png`) })
  await page.keyboard.press('Escape')
  if (await page.getByRole('dialog').isVisible())
    throw new Error(`${name}: dialog did not close`)
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    throw new Error(`${name}: horizontal overflow`)
  await page.close()
}

await browser.close()
