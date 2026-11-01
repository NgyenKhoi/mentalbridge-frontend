import { expect, type Page, type Route } from '@playwright/test'

import { test } from './test-fixtures'

const identityFixtureUrl = 'http://127.0.0.1:3201'
const selfId = '10000000-0000-4000-8000-000000000001'
const peerId = '10000000-0000-4000-8000-000000000002'
const inviteeId = '10000000-0000-4000-8000-000000000004'
const conversationId = '20000000-0000-4000-8000-000000000001'
const requestId = '30000000-0000-4000-8000-000000000001'
const messageId = '40000000-0000-4000-8000-000000000001'
const groupConversationId = '20000000-0000-4000-8000-000000000099'
const groupInvitationId = '30000000-0000-4000-8000-000000000099'
const peer = {
  state: 'AVAILABLE',
  communityProfileId: peerId,
  displayName: 'Mầm Nắng',
}
const invitee = {
  state: 'AVAILABLE',
  communityProfileId: inviteeId,
  displayName: 'Chồi Xanh',
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
const inviteeConversation = {
  ...conversation,
  conversationId: '20000000-0000-4000-8000-000000000004',
  peers: [conversation.peers[0], invitee],
  unreadCount: 0,
}
const groupConversation = {
  conversationId: groupConversationId,
  kind: 'GROUP',
  state: 'ACTIVE',
  groupName: 'Góc bình yên',
  viewerRole: 'OWNER',
  peers: conversation.peers,
  unreadCount: 1,
  version: '7',
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
  let readCursorCalls = 0
  let cleared = false
  const idempotencyKeys: string[] = []
  const clearKeys: string[] = []
  const reportRequests: Array<{ body: unknown; idempotencyKey: string }> = []
  const groupCommands: Array<{
    method: string
    path: string
    ifMatch?: string
    body?: unknown
  }> = []
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
    if (path.endsWith('/invitations') && request.method() === 'GET')
      return json(route, {
        items: [
          {
            invitationId: groupInvitationId,
            conversationId: groupConversationId,
            groupName: 'Bước chậm lại',
            inviter: peer,
            state: 'PENDING',
            expiresAt: '2026-10-28T07:00:00Z',
            version: '3',
          },
        ],
        nextCursor: null,
      })
    if (path.endsWith(`/invitations/${groupInvitationId}/decision`)) {
      groupCommands.push({
        method: request.method(),
        path,
        ifMatch: request.headers()['if-match'],
        body: request.postDataJSON(),
      })
      return json(route, {
        conversationId: groupConversationId,
        kind: 'GROUP',
        name: 'Bước chậm lại',
        state: 'ACTIVE',
        memberLimit: 30,
        version: '4',
      })
    }
    if (
      path.endsWith(`/groups/${groupConversationId}/invitations`) &&
      request.method() === 'POST'
    ) {
      groupCommands.push({
        method: request.method(),
        path,
        ifMatch: request.headers()['if-match'],
        body: request.postDataJSON(),
      })
      return json(
        route,
        {
          invitationId: '30000000-0000-4000-8000-000000000088',
          conversationId: groupConversationId,
          groupName: groupConversation.groupName,
          inviter: conversation.peers[0],
          state: 'PENDING',
          expiresAt: '2026-10-29T07:00:00Z',
          version: '1',
        },
        201,
        { ETag: '"8"' },
      )
    }
    if (path.endsWith(`/groups/${groupConversationId}/members`))
      return json(route, {
        items: [
          {
            peer: conversation.peers[0],
            role: 'OWNER',
            joinedAt: '2026-10-18T07:00:00Z',
          },
          {
            peer,
            role: 'ADMIN',
            joinedAt: '2026-10-19T07:00:00Z',
          },
        ],
        nextCursor: null,
      })
    if (
      path.endsWith(`/groups/${groupConversationId}/members/${peerId}/role`)
    ) {
      groupCommands.push({
        method: request.method(),
        path,
        ifMatch: request.headers()['if-match'],
        body: request.postDataJSON(),
      })
      return json(
        route,
        {
          peer,
          role: request.postDataJSON().role,
          joinedAt: '2026-10-19T07:00:00Z',
        },
        200,
        { ETag: '"9"' },
      )
    }
    if (
      path.endsWith(`/groups/${groupConversationId}`) &&
      request.method() === 'DELETE'
    ) {
      groupCommands.push({
        method: request.method(),
        path,
        ifMatch: request.headers()['if-match'],
      })
      return route.fulfill({ status: 204 })
    }
    if (path.endsWith('/reports')) {
      reportRequests.push({
        body: request.postDataJSON(),
        idempotencyKey: request.headers()['idempotency-key'],
      })
      return json(
        route,
        {
          caseId: '60000000-0000-4000-8000-000000000001',
          state: 'RECEIVED',
        },
        201,
      )
    }
    if (path.endsWith(`/${requestId}/decision`))
      return request.postDataJSON().decision === 'ACCEPT'
        ? json(route, { state: 'ACTIVE', conversationId })
        : route.fulfill({ status: 204 })
    if (path.endsWith('/conversations'))
      return json(route, {
        items: [
          ...(cleared ? [] : [conversation]),
          inviteeConversation,
          groupConversation,
        ],
        nextCursor: null,
      })
    if (path.endsWith(`/conversations/${groupConversationId}`))
      return json(route, groupConversation)
    if (
      path.endsWith(`/conversations/${conversationId}`) &&
      request.method() === 'DELETE'
    ) {
      clearKeys.push(request.headers()['idempotency-key'])
      cleared = true
      return route.fulfill({ status: 204 })
    }
    if (path.endsWith(`/conversations/${conversationId}`))
      return json(route, conversation)
    if (path.endsWith(`/conversations/${conversationId}/read-cursor`)) {
      readCursorCalls += 1
      return json(route, { lastReadMessageId: messageId, unreadCount: 0 })
    }
    if (path.endsWith(`/conversations/${conversationId}/messages`)) {
      if (request.method() === 'GET')
        return json(route, {
          items: [
            {
              messageId,
              conversationId,
              clientMessageId: '50000000-0000-4000-8000-000000000001',
              sender: peer,
              state: 'ACTIVE',
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
            state: 'ACTIVE',
            content: body.content,
            createdAt: '2026-10-20T08:05:00Z',
          },
          persistence: 'SAVED',
          delivery: 'UNCONFIRMED',
        },
        201,
      )
    }
    if (path.endsWith(`/conversations/${groupConversationId}/read-cursor`))
      return json(route, { lastReadMessageId: messageId, unreadCount: 0 })
    if (path.endsWith(`/conversations/${groupConversationId}/messages`))
      return json(route, {
        items: [
          {
            messageId,
            conversationId: groupConversationId,
            clientMessageId: '50000000-0000-4000-8000-000000000099',
            sender: peer,
            state: 'ACTIVE',
            content: 'Mình vừa hoàn thành bài tập thở 5 phút.',
            createdAt: '2026-10-20T08:00:00Z',
          },
        ],
        nextCursor: null,
      })
    return json(route, { code: 'TEST_ROUTE_NOT_FOUND' }, 404)
  })
  return {
    idempotencyKeys,
    clearKeys,
    reportRequests,
    groupCommands,
    get readCursorCalls() {
      return readCursorCalls
    },
  }
}

test.describe('Community chat journey', () => {
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

    await page
      .getByRole('button', { name: /Báo cáo tin nhắn:/ })
      .first()
      .click()
    await expect(
      page.getByText(/Chỉ tin nhắn này được gửi để đội ngũ kiểm duyệt/),
    ).toBeVisible()
    await page
      .getByLabel('Chi tiết bổ sung (không bắt buộc)')
      .fill('Nội dung cần được xem xét.')
    await page.getByRole('button', { name: 'Xác nhận gửi báo cáo' }).click()
    await expect(
      page.getByText('Đã gửi báo cáo cho riêng tin nhắn đã chọn.'),
    ).toBeVisible()
    expect(fixture.reportRequests).toHaveLength(1)
    expect(fixture.reportRequests[0]).toMatchObject({
      body: {
        messageId,
        reasonCode: 'HARASSMENT',
        details: 'Nội dung cần được xem xét.',
      },
      idempotencyKey: expect.stringMatching(/^[\da-f-]{36}$/i),
    })

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
    const fixture = await installChatFixture(page)
    await page.goto('/community/messages')

    await expect(page.getByRole('link', { name: /Mầm Nắng/ })).toBeVisible()
    await expect(
      page.getByRole('textbox', { name: 'Tin nhắn' }),
    ).not.toBeVisible()
    expect(fixture.readCursorCalls).toBe(0)
    await page.getByRole('link', { name: /Mầm Nắng/ }).click()
    await expect(page).toHaveURL(
      new RegExp(`/community/messages/${conversationId}$`),
    )
    await expect(page.getByRole('textbox', { name: 'Tin nhắn' })).toBeVisible()
    await expect.poll(() => fixture.readCursorCalls).toBe(1)
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

  test('confirms a personal clear without implying deletion for peers', async ({
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

    await expect(
      page.getByText('Mình ở đây và sẵn sàng lắng nghe.'),
    ).toBeVisible()
    await page.getByLabel('Mở thao tác an toàn').click()
    await page.getByRole('button', { name: 'Xóa phía tôi' }).click()
    const dialog = page.getByRole('dialog', {
      name: 'Xóa cuộc trò chuyện phía bạn?',
    })
    await expect(dialog).toContainText(
      'Những người khác vẫn giữ nguyên lịch sử',
    )
    await dialog.getByRole('button', { name: 'Giữ lại' }).click()
    expect(fixture.clearKeys).toHaveLength(0)

    await expect(dialog).not.toBeVisible()
    await page.getByRole('button', { name: 'Xóa phía tôi' }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Xóa phía tôi' })
      .click()

    await expect(page).toHaveURL(/\/community\/messages$/)
    expect(fixture.clearKeys).toEqual([
      expect.stringMatching(/^[\da-f-]{36}$/i),
    ])
    await expect(
      page.getByText('Mình ở đây và sẵn sàng lắng nghe.'),
    ).toHaveCount(0)
  })

  test('manages an invite-only group with exact management revisions', async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1440, height: 960 })
    expect(
      (await request.post(`${identityFixtureUrl}/__test/reset`)).status(),
    ).toBe(204)
    await login(page)
    const fixture = await installChatFixture(page)
    await page.goto(`/community/messages/${groupConversationId}`)

    await expect(
      page.getByText('Góc bình yên', { exact: true }).last(),
    ).toBeVisible()
    await expect(
      page.getByText('Mình vừa hoàn thành bài tập thở 5 phút.'),
    ).toBeVisible()
    await page.getByRole('button', { name: /Thành viên · Chủ nhóm/ }).click()
    await expect(page.getByText('Quản lý thành viên')).toBeVisible()

    await page
      .getByRole('combobox', { name: 'Chọn người từ trò chuyện riêng' })
      .click()
    await page.getByRole('option', { name: invitee.displayName }).click()
    await page.getByRole('button', { name: 'Mời thành viên' }).click()
    await expect(page.getByText(/Người nhận phải tự chấp thuận/)).toBeVisible()
    expect(fixture.groupCommands.at(-1)).toMatchObject({
      method: 'POST',
      ifMatch: '"7"',
      body: { inviteeCommunityProfileId: inviteeId },
    })
    await expect(page.getByText(inviteeId)).toHaveCount(0)

    await page.getByRole('button', { name: 'Hạ quyền' }).click()
    await expect(
      page.getByText('Đã cập nhật vai trò thành viên.'),
    ).toBeVisible()
    expect(fixture.groupCommands.at(-1)).toMatchObject({
      method: 'PUT',
      ifMatch: '"8"',
      body: { role: 'MEMBER' },
    })

    await page.evaluate(() => {
      window.scrollTo(0, 0)
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur()
    })
    await page.screenshot({
      path: 'docs/evidence/mb-688-community-group-desktop.png',
      fullPage: true,
    })

    await page.getByRole('button', { name: 'Lưu trữ nhóm' }).click()
    await expect(page.getByText(/Nhóm sẽ chuyển sang chỉ đọc/)).toBeVisible()
    await page.getByRole('button', { name: 'Xác nhận' }).click()
    await expect(page).toHaveURL(/\/community\/messages$/)
    expect(fixture.groupCommands.at(-1)).toMatchObject({
      method: 'DELETE',
      ifMatch: '"9"',
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/community/messages')
    await expect(page.getByRole('link', { name: /Góc bình yên/ })).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    await page.getByRole('tab', { name: /Lời mời/ }).click()
    await expect(page.getByText('Bước chậm lại')).toBeVisible()
    await page.screenshot({
      path: 'docs/evidence/mb-688-community-group-mobile.png',
      fullPage: true,
    })
  })
})
