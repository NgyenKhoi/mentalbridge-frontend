import { expect, type Page, type Route } from '@playwright/test'

import { test } from './test-fixtures'

const identityFixtureUrl = 'http://127.0.0.1:3201'
const selfId = '10000000-0000-4000-8000-000000000001'
const peerId = '10000000-0000-4000-8000-000000000002'
const conversationId = '20000000-0000-4000-8000-000000000001'
const requestId = '30000000-0000-4000-8000-000000000001'
const messageId = '40000000-0000-4000-8000-000000000001'
const peer = {
  state: 'AVAILABLE',
  communityProfileId: peerId,
  displayName: 'Mầm Nắng',
}
const conversation = {
  conversationId,
  kind: 'DIRECT',
  state: 'ACTIVE',
  peers: [
    { state: 'AVAILABLE', communityProfileId: selfId, displayName: 'Lá Nhỏ' },
    peer,
  ],
  unreadCount: 2,
  version: '1',
}

async function login(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill('user@example.com')
  await page.getByLabel('Mật khẩu').fill('synthetic-e2e-password')
  await page.getByRole('button', { name: 'Đăng nhập' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

function json(route: Route, body: unknown, status = 200, headers = {}) {
  return route.fulfill({
    status,
    contentType:
      status >= 400 ? 'application/problem+json' : 'application/json',
    headers: { 'Cache-Control': 'no-store', ...headers },
    body: JSON.stringify(body),
  })
}

async function installChatFixture(page: Page) {
  let sendAttempts = 0
  const idempotencyKeys: string[] = []
  await page.route('**/api/community/profile', (route) =>
    json(
      route,
      {
        communityProfileId: selfId,
        displayName: 'Lá Nhỏ',
        avatarPreset: 'SPROUT',
        status: 'ACTIVE',
        version: 1,
        createdAt: '2026-10-20T07:00:00Z',
        updatedAt: '2026-10-20T07:00:00Z',
      },
      200,
      { ETag: '"1"' },
    ),
  )
  await page.route('**/api/community/chat/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    if (path.endsWith('/privacy')) {
      const preferences =
        request.method() === 'PUT'
          ? request.postDataJSON()
          : {
              directMessagePolicy: 'APPROVAL_REQUIRED',
              presenceVisible: false,
              invisible: false,
              typingVisible: false,
              readReceiptsVisible: false,
            }
      return json(route, {
        version: request.method() === 'PUT' ? '2' : '1',
        preferences,
      })
    }
    if (path.endsWith('/requests'))
      return json(route, {
        items: [
          {
            requestId,
            requester: {
              state: 'AVAILABLE',
              communityProfileId: '10000000-0000-4000-8000-000000000003',
              displayName: 'Mây Dịu',
            },
            state: 'PENDING',
            createdAt: '2026-10-20T07:00:00Z',
            expiresAt: '2026-10-27T07:00:00Z',
            version: '1',
          },
        ],
        nextCursor: null,
      })
    if (path.endsWith(`/${requestId}/decision`))
      return request.postDataJSON().decision === 'ACCEPT'
        ? json(route, { state: 'ACTIVE', conversationId })
        : route.fulfill({ status: 204 })
    if (path.endsWith('/conversations'))
      return json(route, { items: [conversation], nextCursor: null })
    if (path.endsWith(`/conversations/${conversationId}`))
      return json(route, conversation)
    if (path.endsWith(`/conversations/${conversationId}/read-cursor`))
      return json(route, { lastReadMessageId: messageId, unreadCount: 0 })
    if (path.endsWith(`/conversations/${conversationId}/messages`)) {
      if (request.method() === 'GET')
        return json(route, {
          items: [
            {
              messageId,
              conversationId,
              clientMessageId: '50000000-0000-4000-8000-000000000001',
              sender: peer,
              content: 'Mình ở đây và sẵn sàng lắng nghe.',
              createdAt: '2026-10-20T08:00:00Z',
            },
          ],
          nextCursor: null,
        })
      const body = request.postDataJSON()
      idempotencyKeys.push(request.headers()['idempotency-key'])
      sendAttempts += 1
      if (sendAttempts === 1)
        return json(
          route,
          {
            type: '/problems/dependency-unavailable',
            title: 'Dependency unavailable',
            status: 503,
            code: 'DEPENDENCY_UNAVAILABLE',
            correlationId: '90000000-0000-4000-8000-000000000001',
          },
          503,
        )
      return json(
        route,
        {
          message: {
            messageId: '40000000-0000-4000-8000-000000000002',
            conversationId,
            clientMessageId: body.clientMessageId,
            sender: {
              state: 'AVAILABLE',
              communityProfileId: selfId,
              displayName: 'Lá Nhỏ',
            },
            content: body.content,
            createdAt: '2026-10-20T08:05:00Z',
          },
          persistence: 'SAVED',
          delivery: 'UNCONFIRMED',
        },
        201,
      )
    }
    return json(route, { code: 'TEST_ROUTE_NOT_FOUND' }, 404)
  })
  return { idempotencyKeys }
}

test.describe('Community direct chat journey', () => {
  test.skip(
    process.env.E2E_RUNTIME === 'live-cross-stack',
    'The deterministic Community chat fixture does not run against live data.',
  )

  test('handles inbox, privacy, requests and same-key retry on desktop', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 })
    expect(
      (await request.post(`${identityFixtureUrl}/__test/reset`)).status(),
    ).toBe(204)
    await login(page)
    const fixture = await installChatFixture(page)
    await page.goto(`/community/messages/${conversationId}`)

    await expect(page.getByRole('heading', { name: 'Tin nhắn' })).toBeVisible()
    await expect(
      page.getByText('Mình ở đây và sẵn sàng lắng nghe.'),
    ).toBeVisible()
    await page.getByText('Quyền riêng tư tin nhắn').click()
    await page.getByLabel('Cho phép nhắn trực tiếp').check()
    await page.getByRole('button', { name: 'Lưu quyền riêng tư' }).click()
    await expect(page.getByText(/Đã lưu quyền riêng tư/)).toBeVisible()

    await page.getByRole('tab', { name: /Lời mời/ }).click()
    await expect(page.getByText(/Lời mời không chứa nội dung/)).toBeVisible()
    await page.getByRole('tab', { name: 'Trò chuyện' }).click()

    await page
      .getByRole('textbox', { name: 'Tin nhắn' })
      .fill('Cảm ơn bạn đã lắng nghe.')
    await page.getByRole('button', { name: 'Gửi', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Gửi lại' })).toBeVisible()
    await page.getByRole('button', { name: 'Gửi lại' }).click()
    await expect(page.getByText('Cảm ơn bạn đã lắng nghe.')).toBeVisible()
    expect(fixture.idempotencyKeys).toHaveLength(2)
    expect(fixture.idempotencyKeys[0]).toBe(fixture.idempotencyKeys[1])

    await page.screenshot({
      path: 'docs/evidence/mb-686-community-chat-desktop.png',
      fullPage: true,
    })
  })

  test('uses list-first navigation and a dedicated thread on mobile', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    expect(
      (await request.post(`${identityFixtureUrl}/__test/reset`)).status(),
    ).toBe(204)
    await login(page)
    await installChatFixture(page)
    await page.goto('/community/messages')

    await expect(page.getByRole('link', { name: /Mầm Nắng/ })).toBeVisible()
    await expect(
      page.getByRole('textbox', { name: 'Tin nhắn' }),
    ).not.toBeVisible()
    await page.getByRole('link', { name: /Mầm Nắng/ }).click()
    await expect(page).toHaveURL(
      new RegExp(`/community/messages/${conversationId}$`),
    )
    await expect(page.getByRole('textbox', { name: 'Tin nhắn' })).toBeVisible()
    await expect(page.getByRole('link', { name: '← Hộp thư' })).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)

    await page.screenshot({
      path: 'docs/evidence/mb-686-community-chat-mobile.png',
      fullPage: false,
    })
  })
})
