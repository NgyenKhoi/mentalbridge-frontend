import { expect, type Page } from '@playwright/test'

import { test } from './test-fixtures'

const identityFixtureUrl = 'http://127.0.0.1:3201'

async function login(page: Page, email = 'user@example.com') {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(
    email === 'admin-resource-e2e@example.com'
      ? /\/admin\/dashboard$/
      : /\/dashboard$/,
  )
}

test.describe('Community feed journey', () => {
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'The deterministic Community fixture journey does not run against live data.',
  )

  test('browses paged posts, filters by multiple explicit topics and opens full detail', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const reset = await request.post(`${identityFixtureUrl}/__test/reset`)
    expect(reset.status()).toBe(204)
    await login(page)

    await page.goto('/community')
    await expect(
      page.getByRole('heading', { name: 'Cộng đồng MentalBridge' }),
    ).toBeVisible()
    await expect(
      page.getByText(/Ở đây, hỗ trợ không phải là phán xét/),
    ).toHaveCount(0)
    await expect(page.getByText('Minh An')).toBeVisible()
    await expect(page.getByText(/Một số nội dung đa phương tiện/)).toBeVisible()

    await page.getByRole('button', { name: 'Xem thêm câu chuyện' }).click()
    await expect(page.getByText('Thành viên đã rời cộng đồng')).toBeVisible()

    await page.getByRole('button', { name: 'Bước tiến nhỏ' }).click()
    await expect(page.getByText('Minh An')).toBeVisible()
    await expect(page.getByText('Thành viên đã rời cộng đồng')).toHaveCount(0)

    await page.getByRole('button', { name: 'Điều mình nhận ra' }).click()
    await expect(page.getByText('Minh An')).toBeVisible()
    await page.getByRole('button', { name: 'Xem thêm câu chuyện' }).click()
    await expect(page.getByText('Thành viên đã rời cộng đồng')).toBeVisible()
    await expect(page.getByText(/Đang lọc theo 2 chủ đề/)).toBeVisible()
    await page
      .getByRole('link', { name: /Đọc bài viết/ })
      .first()
      .click()
    await expect(page).toHaveURL(
      /\/community\/50000000-0000-4000-8000-000000000002$/,
    )
    await expect(page.getByText(/dành mười phút để đi bộ/)).toBeVisible()
    await expect(
      page.getByText(/không thay thế tư vấn chuyên môn/),
    ).toHaveCount(0)
  })

  test('creates, edits and deletes an owned personal story', async ({
    page,
    request,
  }) => {
    const reset = await request.post(`${identityFixtureUrl}/__test/reset`)
    expect(reset.status()).toBe(204)
    await login(page)
    await page.goto('/community')

    await page.getByRole('button', { name: 'Viết bài' }).click()
    await page
      .getByLabel('Nội dung', { exact: true })
      .fill('Một câu chuyện mới do mình chủ động chia sẻ.')
    await page
      .getByRole('group', { name: 'Chọn 1–3 chủ đề' })
      .getByText('Câu chuyện của tôi')
      .click()
    await page.getByText('Đăng ẩn danh', { exact: true }).click()
    await page.getByRole('button', { name: 'Đăng câu chuyện' }).click()

    await expect(page).toHaveURL(/\/community\/[0-9a-f-]+$/)
    await expect(page.getByText('Thành viên ẩn danh')).toBeVisible()
    await expect(
      page.getByText('Một câu chuyện mới do mình chủ động chia sẻ.'),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Chỉnh sửa' }).click()
    await page.getByText('Dùng danh tính cộng đồng', { exact: true }).click()
    await page
      .getByLabel('Nội dung', { exact: true })
      .fill('Câu chuyện đã được mình cập nhật.')
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
    await expect(
      page.getByText('Câu chuyện đã được mình cập nhật.'),
    ).toBeVisible()

    await page.getByRole('button', { name: 'Xóa' }).click()
    await page.getByRole('button', { name: 'Xóa bài viết' }).click()
    await expect(page).toHaveURL(/\/community$/)
    await expect(
      page.getByText('Câu chuyện đã được mình cập nhật.'),
    ).toHaveCount(0)
  })

  test('persists one reviewed resource attachment across reload and opens Resources', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const reset = await request.post(`${identityFixtureUrl}/__test/reset`)
    expect(reset.status()).toBe(204)
    await login(page)
    await page.goto('/community')

    await page.getByRole('button', { name: 'Viết bài' }).click()
    await page
      .locator('#community-post-content')
      .fill('Tài nguyên này đã giúp mình dừng lại và thở chậm hơn.')
    await page
      .getByRole('group', { name: 'Chọn 1–3 chủ đề' })
      .locator('label')
      .last()
      .click()
    await page
      .getByRole('dialog', { name: 'Tạo bài viết' })
      .getByRole('button', { name: /^Tài nguyên/ })
      .click()
    await page
      .locator('#community-resource-select')
      .selectOption('30000000-0000-4000-8000-000000000001')
    await page.getByRole('button', { name: 'Đăng câu chuyện' }).click()

    await expect(page).toHaveURL(/\/community\/[0-9a-f-]+$/)
    await page.reload()
    const resourceLink = page.locator(
      'a[href="/resources/30000000-0000-4000-8000-000000000001"]',
    )
    await expect(resourceLink).toContainText('Published Resource')
    await page.screenshot({
      path: 'docs/evidence/mb-614-community-resource-attachment.png',
      fullPage: true,
    })
    await resourceLink.click()
    await expect(page).toHaveURL(
      /\/resources\/30000000-0000-4000-8000-000000000001$/,
    )
    await expect(
      page.getByRole('heading', { name: 'Published Resource' }),
    ).toBeVisible()
  })

  test('keeps the overview and composer usable across viewport sizes and preserves a paused draft', async ({
    page,
    request,
  }) => {
    expect(
      (await request.post(`${identityFixtureUrl}/__test/reset`)).status(),
    ).toBe(204)
    await login(page)
    await page.goto('/community')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(page.getByText('Minh An')).toBeVisible()
    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
      { width: 768, height: 1024 },
      { width: 375, height: 812 },
      { width: 640, height: 400 },
    ]) {
      await page.setViewportSize(viewport)
      await expect(page.getByRole('button', { name: 'Viết bài' })).toBeVisible()
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true)
      const main = await page.getByRole('main').boundingBox()
      const feed = await page.locator('.community-feed-content').boundingBox()
      const topics = await page
        .getByRole('complementary', { name: 'Khám phá chủ đề' })
        .boundingBox()
      expect(main).not.toBeNull()
      expect(feed).not.toBeNull()
      expect(topics).not.toBeNull()
      const gutter = viewport.width <= 760 ? 16 : 24
      expect(main!.width).toBe(viewport.width)
      expect(feed!.x).toBe(gutter)
      expect(topics!.x + topics!.width).toBeCloseTo(viewport.width - gutter, 0)
      if (viewport.width > 900) {
        expect(topics!.x - (feed!.x + feed!.width)).toBeCloseTo(32, 0)
        const brand = await page
          .getByRole('link', { name: 'Cộng đồng MentalBridge' })
          .boundingBox()
        expect(brand!.x).toBe(gutter)
      }
      if (
        viewport.width === 1920 ||
        viewport.width === 1440 ||
        viewport.width === 375
      )
        await page.screenshot({
          path: `docs/evidence/community-overview-${viewport.width}.png`,
          fullPage: true,
        })
      await page.getByRole('button', { name: 'Viết bài' }).click()
      const dialog = page.getByRole('dialog', { name: 'Tạo bài viết' })
      await expect(dialog).toBeVisible()
      await expect(page.getByLabel('Nội dung', { exact: true })).toBeFocused()
      const publish = page.getByRole('button', { name: 'Đăng câu chuyện' })
      await expect(publish).toBeInViewport()
      const box = await dialog.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.width).toBeLessThanOrEqual(viewport.width)
      expect(box!.height).toBeLessThanOrEqual(viewport.height)
      if (viewport.width === 1440 || viewport.width === 375)
        await page.screenshot({
          path: `docs/evidence/community-composer-${viewport.width}.png`,
        })
      await page.keyboard.press('Escape')
      await expect(dialog).not.toBeVisible()
      await expect(page.getByRole('button', { name: 'Viết bài' })).toBeFocused()
    }
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page
      .getByRole('button', { name: 'Hỏi cộng đồng', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'Chưa có bài viết trong chủ đề này' }),
    ).toBeVisible()
    const empty = await page.locator('.community-state').boundingBox()
    const emptyTopics = await page
      .getByRole('complementary', { name: 'Khám phá chủ đề' })
      .boundingBox()
    expect(empty).not.toBeNull()
    expect(emptyTopics).not.toBeNull()
    expect(empty!.x).toBe(24)
    expect(emptyTopics!.x - (empty!.x + empty!.width)).toBeCloseTo(32, 0)
    await page.screenshot({
      path: 'docs/evidence/community-overview-empty-1920.png',
      fullPage: true,
    })
    await page.getByRole('button', { name: 'Xóa bộ lọc' }).click()
    await expect(page.getByText('Minh An')).toBeVisible()
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.getByRole('button', { name: 'Viết bài' }).click()
    await page
      .getByLabel('Nội dung', { exact: true })
      .fill('Bài viết đang soạn của mình.')
    await page.getByText('Đăng ẩn danh', { exact: true }).click()
    await page.getByRole('button', { name: 'Để sau' }).click()
    await page.getByRole('button', { name: 'Viết tiếp' }).click()
    await expect(page.getByLabel('Nội dung', { exact: true })).toHaveValue(
      'Bài viết đang soạn của mình.',
    )
    await expect(
      page.getByRole('radio', { name: 'Đăng ẩn danh' }),
    ).toBeChecked()
    await page.getByRole('button', { name: 'Đăng câu chuyện' }).click()
    await expect(
      page.getByRole('dialog', { name: 'Tạo bài viết' }).getByRole('alert'),
    ).toHaveText('Chọn ít nhất một chủ đề cho bài viết.')
    await expect(
      page
        .getByRole('group', { name: 'Chọn 1–3 chủ đề' })
        .getByRole('checkbox')
        .first(),
    ).toBeFocused()
  })

  test('persists an author warning and requires an explicit reveal on detail', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const reset = await request.post(`${identityFixtureUrl}/__test/reset`)
    expect(reset.status()).toBe(204)
    await login(page)
    await page.goto('/community')

    await page.getByRole('button', { name: 'Viết bài' }).click()
    await page
      .locator('#community-post-content')
      .fill('Một câu chuyện có chi tiết nhạy cảm do tác giả chủ động cảnh báo.')
    await page
      .getByRole('group', { name: 'Chọn 1–3 chủ đề' })
      .getByText('Câu chuyện của tôi')
      .click()
    await page
      .getByRole('checkbox', { name: /Thêm cảnh báo nội dung nhạy cảm/ })
      .check()
    await page.getByRole('button', { name: 'Đăng câu chuyện' }).click()

    await expect(page).toHaveURL(/\/community\/[0-9a-f-]+$/)
    await page.reload()
    await expect(page.getByText('Nội dung nhạy cảm')).toBeVisible()
    await expect(
      page.getByText(
        'Một câu chuyện có chi tiết nhạy cảm do tác giả chủ động cảnh báo.',
      ),
    ).toHaveCount(0)
    await expect(
      page.getByRole('link', { name: 'Cần hỗ trợ ngay' }).first(),
    ).toBeVisible()
    await page.screenshot({
      path: 'docs/evidence/mb-615-community-sensitive-warning-concealed.png',
      fullPage: true,
    })

    await page.getByRole('button', { name: 'Xem nội dung' }).click()
    await expect(
      page.getByText(
        'Một câu chuyện có chi tiết nhạy cảm do tác giả chủ động cảnh báo.',
      ),
    ).toBeVisible()
    await page.screenshot({
      path: 'docs/evidence/mb-615-community-sensitive-warning-revealed.png',
      fullPage: true,
    })
  })

  test('creates and updates a private Community display identity', async ({
    page,
    request,
  }) => {
    const reset = await request.post(`${identityFixtureUrl}/__test/reset`)
    expect(reset.status()).toBe(204)
    await login(page)

    await page.goto('/community/profile')
    await expect(
      page.getByRole('heading', { name: 'Bạn muốn xuất hiện như thế nào?' }),
    ).toBeVisible()
    await expect(
      page.getByText(/không hiển thị email hay mã tài khoản/),
    ).toBeVisible()

    await page.getByLabel('Tên hiển thị hoặc biệt danh').fill('Mầm Xanh')
    await page.getByText('Lá xanh').click()
    await page.getByRole('button', { name: 'Tạo danh tính cộng đồng' }).click()
    await expect(
      page.getByRole('button', { name: 'Lưu thay đổi' }),
    ).toBeVisible()

    await page.getByLabel('Tên hiển thị hoặc biệt danh').fill('Lá Nhỏ')
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
    await page.reload()
    await expect(page.getByLabel('Tên hiển thị hoặc biệt danh')).toHaveValue(
      'Lá Nhỏ',
    )
  })

  test('adds, replaces and removes one reaction and persists a private bookmark', async ({
    page,
    request,
  }) => {
    const reset = await request.post(`${identityFixtureUrl}/__test/reset`)
    expect(reset.status()).toBe(204)
    await login(page)
    await page.goto('/community/50000000-0000-4000-8000-000000000002')

    const reactionButtons = page.locator('button[aria-pressed]')
    const support = reactionButtons.nth(0)
    const relate = reactionButtons.nth(1)
    const bookmark = reactionButtons.nth(3)

    await expect(page.getByText(/^12 /)).toBeVisible()
    await support.click()
    await expect(support).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText(/^13 /)).toBeVisible()

    await relate.click()
    await expect(relate).toHaveAttribute('aria-pressed', 'true')
    await expect(support).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByText(/^13 /)).toBeVisible()

    await relate.click()
    await expect(relate).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByText(/^12 /)).toBeVisible()

    await bookmark.click()
    await expect(bookmark).toHaveAttribute('aria-pressed', 'true')

    await page.goto('/community/saved')
    await expect(
      page.getByRole('heading', { name: 'Bài viết đã lưu', exact: true }),
    ).toBeVisible()
    await expect(page.getByText(/dành mười phút để đi bộ/)).toBeVisible()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Đã lưu' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.screenshot({
      path: 'docs/evidence/mb-616-community-saved-posts.png',
      fullPage: true,
    })
    await page.setViewportSize({ width: 375, height: 812 })
    await expect(page.getByText('Đã lưu', { exact: true }).last()).toBeVisible()
    await page.screenshot({
      path: 'docs/evidence/mb-616-community-saved-posts-mobile.png',
      fullPage: true,
    })
    await page.getByRole('button', { name: 'Đã lưu' }).click()
    await expect(page.getByText('Bạn chưa lưu bài viết nào')).toBeVisible()
    await page.reload()
    await expect(page.getByText('Bạn chưa lưu bài viết nào')).toBeVisible()
  })

  test('comments, replies, edits and keeps a tombstone after deletion', async ({
    page,
    request,
  }) => {
    const reset = await request.post(`${identityFixtureUrl}/__test/reset`)
    expect(reset.status()).toBe(204)
    await login(page)
    await page.goto('/community/50000000-0000-4000-8000-000000000002')

    await expect(
      page.getByRole('heading', { name: 'Bình luận hỗ trợ' }),
    ).toBeVisible()
    await page
      .getByLabel('Bạn muốn chia sẻ điều gì?')
      .fill('Mình ở đây và đang lắng nghe bạn.')
    await page.getByRole('button', { name: 'Gửi bình luận' }).click()

    let ownComment = page
      .getByRole('listitem')
      .filter({ hasText: 'Mình ở đây và đang lắng nghe bạn.' })
    await expect(ownComment).toBeVisible()
    await ownComment.getByRole('button', { name: 'Chỉnh sửa' }).click()
    await ownComment
      .getByLabel('Chỉnh sửa bình luận')
      .fill('Mình vẫn ở đây cùng bạn.')
    await page.getByRole('button', { name: 'Lưu thay đổi' }).click()
    await expect(page.getByText('Mình vẫn ở đây cùng bạn.')).toBeVisible()

    ownComment = page
      .getByRole('listitem')
      .filter({ hasText: 'Mình vẫn ở đây cùng bạn.' })
    await ownComment.getByRole('button', { name: 'Phản hồi' }).click()
    await page.getByLabel('Lời phản hồi của bạn').fill('Cảm ơn bạn đã mở lòng.')
    await page.getByRole('button', { name: 'Gửi phản hồi' }).click()
    await expect(page.getByText('Cảm ơn bạn đã mở lòng.')).toBeVisible()

    await ownComment.getByRole('button', { name: 'Xóa' }).click()
    await page.getByRole('button', { name: 'Xóa bình luận' }).click()
    await expect(
      page.getByText('Bình luận đã được người viết xóa.'),
    ).toBeVisible()
    await expect(page.getByText('Cảm ơn bạn đã mở lòng.')).toBeVisible()
  })
})
