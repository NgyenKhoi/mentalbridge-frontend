import { expect } from '@playwright/test'
import type { CommunityFeedPage } from '../../features/community/api/browser-community'
import { test } from './test-fixtures'

test.describe('Community presentation', () => {
  test.setTimeout(180_000)
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'Responsive presentation uses isolated synthetic accounts and media.',
  )

  test('uses a prompt, preserves anonymous authoring, searches and sends a durable inline comment', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    expect(
      (await request.post('http://127.0.0.1:3201/__test/reset')).status(),
    ).toBe(204)
    await page.goto('/login')
    await page.getByLabel('Email').fill('user@example.com')
    await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
    await page.getByRole('button', { name: 'Đăng nhập' }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await page.goto('/community')
    await page
      .getByRole('button', { name: /Một điều nhỏ bé khiến bạn mỉm cười/ })
      .click()
    const quick = page.getByLabel('Nội dung chia sẻ nhanh')
    await expect(quick).toHaveValue(/Một điều nhỏ bé/)
    await quick.fill('Mình muốn chia sẻ một bước nhỏ của hôm nay.')
    await page.getByLabel('Ẩn danh tên', { exact: true }).check()
    await page.getByRole('button', { name: 'Viết tiếp', exact: true }).click()
    await expect(page.getByLabel('Đăng ẩn danh', { exact: true })).toBeChecked()
    await expect(page.getByLabel('Nội dung', { exact: true })).toHaveValue(
      'Mình muốn chia sẻ một bước nhỏ của hôm nay.',
    )
    await page.keyboard.press('Escape')
    await expect(
      page.getByRole('dialog', { name: 'Tạo bài viết' }),
    ).not.toBeVisible()
    await expect(quick).toHaveValue(
      'Mình muốn chia sẻ một bước nhỏ của hôm nay.',
    )
    await quick.fill('')
    await expect(quick).toHaveValue('')
    await page.getByLabel('Tìm câu chuyện trong bảng tin').fill('mười phút')
    await page.getByLabel('Tìm câu chuyện trong bảng tin').press('Enter')
    await expect(page).toHaveURL(/\/community\?q=/)
    await expect(page.getByText(/kết quả cho “mười phút”/)).toBeVisible()
    await page.getByRole('link', { name: 'Xóa tìm kiếm' }).click()
    await page
      .getByLabel('Gửi lời nhắn cho bài viết của Minh An', { exact: true })
      .fill('Cảm ơn bạn đã chia sẻ. Mình đang lắng nghe.')
    await page
      .getByRole('button', { name: 'Gửi bình luận cho Minh An' })
      .click()
    await expect(
      page.getByText('Đã gửi lời nhắn.', { exact: false }),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Xem bình luận', exact: true }).click()
    await expect(
      page.getByText('Cảm ơn bạn đã chia sẻ. Mình đang lắng nghe.', {
        exact: true,
      }),
    ).toBeVisible()
  })

  for (const width of [375, 768, 1280, 1920]) {
    test(`keeps media, identity and unavailable chat readable at ${width}px`, async ({
      page,
      request,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 900 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      expect(
        (await request.post('http://127.0.0.1:3201/__test/reset')).status(),
      ).toBe(204)
      await page.goto('/login')
      await page.getByLabel('Email').fill('user@example.com')
      await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
      await page.getByRole('button', { name: 'Đăng nhập' }).click()
      await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 })

      let attachmentCount = 1
      await page.route('**/api/community/feed?*', async (route) => {
        const response = await route.fetch()
        const data: CommunityFeedPage = await response.json()
        const first = data.items[0]
        if (first) {
          first.media = Array.from({ length: attachmentCount }, (_, index) => ({
            mediaId: `30000000-0000-4000-8000-${String(index + 91).padStart(12, '0')}`,
            type: 'IMAGE' as const,
            url: new URL('/images/resource-mindfulness.webp', page.url()).href,
            width: 600,
            height: 1200,
            durationSeconds: null,
            altText:
              index === 0
                ? 'Ảnh dọc dùng kiểm tra bố cục'
                : `Ảnh kiểm tra ${index + 1}`,
          }))
        }
        await route.fulfill({ response, json: data })
      })
      await page.goto('/community')
      const image = page.getByAltText('Ảnh dọc dùng kiểm tra bố cục')
      await expect(image).toBeVisible()
      await expect(image).toHaveCSS(
        'max-height',
        width <= 760 ? '340px' : '500px',
      )
      const mediaBox = await image.boundingBox()
      expect(mediaBox!.height).toBeLessThanOrEqual(width <= 760 ? 340 : 500)
      expect(mediaBox!.height).toBeGreaterThan(100)
      await expect(image).toHaveCSS('object-fit', 'cover')
      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', width)
      await page.screenshot({
        path: testInfo.outputPath('feed.png'),
        fullPage: true,
      })

      await page.getByRole('button', { name: /Mở nội dung đính kèm/ }).click()
      await expect(page.getByRole('dialog')).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
      if (width === 1280) {
        for (const count of [2, 3, 6]) {
          attachmentCount = count
          await page.reload()
          const attachments = page.getByRole('button', {
            name: /Mở nội dung đính kèm/,
          })
          await expect(attachments).toHaveCount(Math.min(count, 4))
          const gallery = page.locator('.community-media')
          expect((await gallery.boundingBox())!.height).toBeLessThanOrEqual(500)
          if (count === 6)
            await expect(gallery.getByText('+2', { exact: true })).toBeVisible()
          await page.screenshot({
            path: testInfo.outputPath(`gallery-${count}.png`),
            fullPage: true,
          })
        }
      }
      await page.getByRole('button', { name: 'Viết bài', exact: true }).click()
      const composer = page.getByRole('dialog')
      await expect(composer).toBeVisible()
      await expect(
        composer.getByRole('button', { name: 'Đăng câu chuyện' }),
      ).toBeVisible()
      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', width)
      await page.screenshot({ path: testInfo.outputPath('composer.png') })
      await page.setViewportSize({ width, height: 480 })
      await expect(
        composer.getByRole('button', { name: 'Đăng câu chuyện' }),
      ).toBeVisible()
      await page.screenshot({ path: testInfo.outputPath('composer-short.png') })
      await page.keyboard.press('Escape')
      await page.setViewportSize({ width, height: 900 })

      await page.goto('/community/saved')
      await expect(
        page.getByRole('heading', { name: 'Bạn chưa lưu bài viết nào' }),
      ).toBeVisible({ timeout: 30_000 })
      await page.screenshot({ path: testInfo.outputPath('saved.png') })

      await page.goto('/community/profile')
      await expect(page.getByLabel('Tên hiển thị hoặc biệt danh')).toBeVisible()
      await expect(page.locator('.community-avatar-options input')).toHaveCount(
        7,
      )
      const presets = page.locator(
        '.community-avatar-options > label:not(.community-avatar-initial)',
      )
      const boxes = await presets.evaluateAll((labels) =>
        labels.map((label) => {
          const box = label.getBoundingClientRect()
          return { x: box.x, y: box.y, width: box.width }
        }),
      )
      expect(boxes[0].y).toBe(boxes[2].y)
      expect(boxes[3].y).toBe(boxes[5].y)
      expect(boxes[0].x).toBe(boxes[3].x)
      expect(Math.abs(boxes[0].width - boxes[5].width)).toBeLessThan(1)
      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', width)
      await page.screenshot({
        path: testInfo.outputPath('profile.png'),
        fullPage: true,
      })

      await page.route('**/api/community/chat/**', (route) =>
        route.fulfill({
          status: 503,
          contentType: 'application/problem+json',
          json: {
            type: 'https://mentalbridge.local/problems/unavailable',
            title: 'Unavailable',
            status: 503,
            code: 'DEPENDENCY_UNAVAILABLE',
            correlationId: 'community-presentation-fixture',
          },
        }),
      )
      await page.goto('/community/messages')
      await expect(page.getByText('Tin nhắn hiện chưa khả dụng')).toBeVisible()
      await expect(
        page.getByRole('button', { name: 'Thử lại', exact: true }),
      ).toHaveCount(0)
      await expect(
        page.getByRole('button', { name: /Tạo nhóm riêng/ }),
      ).toBeDisabled()
      await expect(page.locator('html')).toHaveJSProperty('scrollWidth', width)
      const title = page.getByRole('heading', { name: 'Tin nhắn', exact: true })
      expect(await title.textContent()).toBe('Tin nhắn'.normalize('NFC'))
      expect(
        await title.evaluate((element) => getComputedStyle(element).fontFamily),
      ).toMatch(/Be[_ ]Vietnam/)
      await page.screenshot({ path: testInfo.outputPath('messages.png') })
    })
  }
})
