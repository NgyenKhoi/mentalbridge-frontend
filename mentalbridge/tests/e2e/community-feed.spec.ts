import { expect, type Page } from '@playwright/test'

import { test } from './test-fixtures'

const identityFixtureUrl = 'http://127.0.0.1:3201'

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('user@example.com')
  await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
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
    await expect(page.getByText(/không dùng nhật ký, cảm xúc/)).toBeVisible()
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
    ).toBeVisible()
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
      .getByLabel('Nội dung')
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
    await page.getByLabel('Nội dung').fill('Câu chuyện đã được mình cập nhật.')
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

    await page.locator('.community-composer-collapsed button').click()
    await page
      .locator('#community-post-content')
      .fill('Tài nguyên này đã giúp mình dừng lại và thở chậm hơn.')
    await page.locator('.community-topic-choices label').last().click()
    await page
      .locator('#community-resource-select')
      .selectOption('30000000-0000-4000-8000-000000000001')
    await page.locator('.community-form-actions button').last().click()

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
    await page.reload()
    await expect(reactionButtons.nth(3)).toHaveAttribute('aria-pressed', 'true')
    await reactionButtons.nth(3).click()
    await expect(reactionButtons.nth(3)).toHaveAttribute(
      'aria-pressed',
      'false',
    )
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
