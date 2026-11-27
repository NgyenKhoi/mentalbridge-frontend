import { expect, type Page } from '@playwright/test'

import { narrativeCopy } from '../../features/look-back/look-back-copy'
import { harder, improving, sparse } from '../fixtures/look-back'
import { test } from './test-fixtures'

const accessCookie = 'mentalbridge_access'
const widths = [1440, 1280, 768, 375]

async function expectNoHorizontalOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true)
}

// Screenshots go to the story's capture folder when LOOKBACK_SHOTS_DIR is set, else to the test output.
async function shot(
  page: Page,
  testInfo: { outputPath: (name: string) => string },
  name: string,
) {
  const dir = process.env.LOOKBACK_SHOTS_DIR
  await page.screenshot({
    path: dir
      ? `${dir}/${name}-viewport.png`
      : testInfo.outputPath(`${name}-viewport.png`),
    fullPage: false,
  })
  return page.screenshot({
    path: dir
      ? `${dir}/${name}-full.png`
      : testInfo.outputPath(`${name}-full.png`),
    fullPage: true,
  })
}

const scenarios = [
  {
    name: 'IMPROVING',
    view: improving,
    copy: narrativeCopy.IMPROVING,
    next: ['Tiếp tục kế hoạch hôm nay', '/support-plan'],
  },
  {
    name: 'HARDER (moderate band)',
    view: harder,
    copy: narrativeCopy.HARDER,
    next: ['Xem hướng hỗ trợ', '/support-guides'],
  },
  {
    name: 'SPARSE',
    view: sparse,
    copy: narrativeCopy.SPARSE,
    next: ['Ghi cảm xúc hôm nay', '/dashboard'],
  },
] as const

test.describe('look-back', () => {
  test.use({ timezoneId: 'Asia/Ho_Chi_Minh' })

  test.beforeEach(async ({ context, page }) => {
    await context.addCookies([
      {
        name: accessCookie,
        value: 'synthetic-mb273-e2e-access',
        url: 'http://127.0.0.1:3100',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ])
    await page.emulateMedia({ reducedMotion: 'reduce' })
  })

  for (const scenario of scenarios)
    for (const width of widths)
      test(`${scenario.name} at ${width}`, async ({ page }, testInfo) => {
        await page.route('**/api/look-back**', (route) =>
          route.fulfill({ status: 200, json: scenario.view() }),
        )
        await page.setViewportSize({ width, height: 900 })
        await page.goto('/nhin-lai')

        await expect(page.getByText(scenario.copy)).toBeVisible()
        const next = page.getByRole('region', { name: 'Bước tiếp theo' })
        await expect(next.getByRole('link')).toHaveText(scenario.next[0])
        await expect(next.getByRole('link')).toHaveAttribute(
          'href',
          scenario.next[1],
        )

        const heading = (name: string) =>
          page.getByRole('heading', { level: 2, name })
        if (scenario.name === 'SPARSE') {
          await expect(
            page.getByRole('heading', { name: /Bản đồ hành trình cảm xúc/ }),
          ).toHaveCount(0)
          await expect(page.getByRole('img')).toHaveCount(0)
        } else {
          await expect(heading('Bản đồ hành trình cảm xúc')).toBeVisible()
          await expect(page.getByText('Ngày viết nhật ký')).toBeVisible()
          await expect(heading('Kết quả tự đánh giá')).toBeVisible()
          await expect(
            page.getByRole('img', { name: /Biểu đồ cảm xúc/ }),
          ).toBeVisible()
        }
        if (scenario.name === 'IMPROVING')
          await expect(heading('Bạn đã trò chuyện với Mầm về')).toBeVisible()
        await expectNoHorizontalOverflow(page)
        await shot(
          page,
          testInfo,
          `look-back-${scenario.name.split(' ')[0]}-${width}`,
        )
        if (scenario.name === 'IMPROVING') {
          await page.getByRole('button', { name: /Tuần 1 \(/ }).click()
          await expect(
            page.getByRole('button', { name: /Ngày 1,/ }),
          ).toBeVisible()
          await page.getByRole('button', { name: /Ngày 1,/ }).click()
          await expect(page.getByLabel('Chi tiết ngày 1')).toContainText(
            /nhật ký/i,
          )
        }
        if (scenario.name.startsWith('HARDER'))
          await expect(
            page.getByRole('link', { name: 'Tìm chuyên gia' }),
          ).toBeVisible()
        else await expect(page.getByText('Tìm chuyên gia')).toHaveCount(0)
      })

  test('error offers a retry that loads the page', async ({ page }) => {
    let calls = 0
    await page.route('**/api/look-back**', (route) =>
      ++calls === 1
        ? route.fulfill({ status: 502, json: { code: 'CARE_UNAVAILABLE' } })
        : route.fulfill({ status: 200, json: improving() }),
    )
    await page.goto('/nhin-lai')
    await expect(page.getByText('Bạn thử lại sau một chút nhé.')).toBeVisible()
    await page.getByRole('button', { name: 'Thử lại' }).click()
    await expect(page.getByText(narrativeCopy.IMPROVING)).toBeVisible()
  })
})
