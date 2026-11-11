import { expect } from '@playwright/test'
import { test } from './test-fixtures'

const conversationId = '11111111-1111-4111-8111-111111111111'
const journalId = '22222222-2222-4222-8222-222222222222'
const now = '2026-09-22T08:00:00Z'

test('MB-512 completes a quota-governed companion conversation on mobile', async ({
  context,
  page,
}, testInfo) => {
  await context.addCookies([
    {
      name: 'mentalbridge_access',
      value: 'synthetic-resource-e2e-access',
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  await page.setViewportSize({ width: 375, height: 844 })

  const messages: Array<Record<string, unknown>> = []
  let deleted = false
  let sentBody: Record<string, unknown> | null = null
  let savedContextBody: Record<string, unknown> | null = null
  let idempotencyKey = ''
  let contextSources = {
    plan: true,
    diary: false,
    screening: false,
    resourceIds: [] as string[],
  }
  const conversation = () => ({
    conversationId,
    title: 'Cuộc trò chuyện mới',
    context: {
      sources: contextSources,
      updatedAt: now,
    },
    messages,
    createdAt: now,
    updatedAt: messages.length === 0 ? now : '2026-09-22T08:01:00Z',
    expiresAt: '2026-12-21T08:00:00Z',
  })
  const conversationSummary = () => ({
    conversationId,
    title: 'Cuộc trò chuyện mới',
    createdAt: now,
    updatedAt: messages.length === 0 ? now : '2026-09-22T08:01:00Z',
    expiresAt: '2026-12-21T08:00:00Z',
  })

  await page.route('**/api/journals', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [
          {
            id: journalId,
            ownerAccountId: '33333333-3333-4333-8333-333333333333',
            currentRevision: 1,
            occurredAt: '2026-09-22T07:00:00Z',
            createdAt: '2026-09-22T07:00:00Z',
            updatedAt: '2026-09-22T07:00:00Z',
            deleted: false,
            tags: [],
            mood: 'GOOD',
            encryption: {
              algorithm: 'AES-256-GCM',
              keyId: 'single-key',
              encryptedAt: '2026-09-22T07:00:00Z',
            },
            analysisState: 'not_requested',
            content: { preview: 'Một ngày bình tĩnh hơn', byteLength: 24 },
          },
        ],
        page: { limit: 20, hasMore: false },
      }),
    })
  })

  await page.route('**/api/ai-companion/conversations**', async (route) => {
    const request = route.request()
    const pathname = new URL(request.url()).pathname
    if (pathname.endsWith('/messages') && request.method() === 'POST') {
      sentBody = request.postDataJSON() as Record<string, unknown>
      idempotencyKey = request.headers()['idempotency-key'] ?? ''
      messages.push(
        {
          messageId: '44444444-4444-4444-8444-444444444444',
          role: 'USER',
          content: 'Mình nên bắt đầu từ đâu?',
          createdAt: '2026-09-22T08:01:00Z',
          contextKinds: [],
        },
        {
          messageId: '55555555-5555-4555-8555-555555555555',
          role: 'ASSISTANT',
          content: 'Hãy chọn một bước nhỏ và vừa sức.',
          createdAt: '2026-09-22T08:01:00Z',
          contextKinds: ['JOURNAL', 'SUPPORT_PLAN'],
        },
      )
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversationId,
          userMessageId: messages[0]!.messageId,
          assistantMessageId: messages[1]!.messageId,
          assistant: messages[1]!.content,
          createdAt: messages[1]!.createdAt,
          contextKinds: ['JOURNAL', 'SUPPORT_PLAN'],
          quota: {
            plan: 'FREE',
            policyVersion: 'companion-quota-v1',
            remaining: 4,
            resetAt: '2026-09-22T17:00:00Z',
            limitDisplayed: true,
          },
        }),
      })
      return
    }
    if (pathname.endsWith('/context') && request.method() === 'PUT') {
      savedContextBody = request.postDataJSON() as Record<string, unknown>
      contextSources = (
        savedContextBody as {
          sources: typeof contextSources
        }
      ).sources
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(conversation()),
      })
      return
    }
    if (pathname.endsWith(`/${conversationId}`)) {
      if (request.method() === 'DELETE') {
        deleted = true
        await route.fulfill({ status: 204 })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(conversation()),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: deleted ? [] : [conversationSummary()] }),
    })
  })

  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'Mở menu', exact: true }).click()
  await page
    .getByRole('navigation', { name: 'Điều hướng chính' })
    .getByRole('link', { name: 'AI Companion' })
    .click()
  await expect(page).toHaveURL(/\/ai-companion$/)
  await expect(page.getByRole('heading', { name: 'Hội thoại' })).toBeVisible()
  await page
    .getByRole('button', { name: /Cuộc trò chuyện mới.*Tiếp tục/ })
    .click()
  await expect(
    page.getByRole('link', { name: 'Cần trợ giúp ngay' }),
  ).toBeVisible()

  await page.getByRole('button', { name: /Mở nguồn ngữ cảnh/ }).click()
  const contextDialog = page.getByRole('dialog', {
    name: 'Nguồn thông tin cho cuộc trò chuyện này',
  })
  await contextDialog.getByRole('checkbox', { name: 'Bật Nhật ký' }).check()
  await contextDialog.getByRole('button', { name: 'Lưu' }).click()
  await page
    .getByRole('textbox', { name: 'Tin nhắn' })
    .fill('Mình nên bắt đầu từ đâu?')
  await page.getByRole('button', { name: 'Gửi' }).click()

  await expect(
    page
      .getByRole('region', { name: 'AI Companion' })
      .getByText('Hãy chọn một bước nhỏ và vừa sức.'),
  ).toBeVisible()
  await expect(page.getByText(/Còn 4 lượt/)).toBeVisible()
  await page.getByText('Đã dùng 2 nguồn').click()
  await expect(page.getByText('Nhật ký gần đây')).toBeVisible()
  await expect(page.getByText('Kế hoạch hỗ trợ hiện tại')).toBeVisible()
  await page.getByText('Đã dùng 2 nguồn').click()
  await expect(
    page
      .getByRole('region', { name: 'AI Companion' })
      .getByText('Mình nên bắt đầu từ đâu?', { exact: true }),
  ).toHaveCSS('color', 'rgb(255, 255, 255)')
  expect(idempotencyKey.length).toBeGreaterThanOrEqual(16)
  expect(savedContextBody).toEqual({
    sources: {
      plan: true,
      diary: true,
      screening: false,
      resourceIds: [],
    },
  })
  expect(sentBody).toEqual({ message: 'Mình nên bắt đầu từ đâu?' })

  for (const width of [1440, 1280, 768, 375]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(
      page.getByRole('region', { name: 'AI Companion' }),
    ).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true)
    await testInfo.attach(`ai-companion-${width}`, {
      body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
      contentType: 'image/png',
    })
  }

  await page.getByLabel('Tùy chọn hội thoại').click()
  await page.getByRole('button', { name: 'Xóa cuộc trò chuyện' }).click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Xóa cuộc trò chuyện' })
    .click()
  await expect(page.getByText('Chưa có cuộc trò chuyện nào.')).toBeVisible()
  expect(deleted).toBe(true)
  await page.goto('/messages')
  await expect(
    page.getByRole('heading', { name: 'Lịch hẹn chat' }),
  ).toBeVisible()
})

test('MB-512 retries an unchanged draft with a fresh key after provider failure', async ({
  context,
  page,
}) => {
  await context.addCookies([
    {
      name: 'mentalbridge_access',
      value: 'synthetic-resource-e2e-access',
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/journals', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], page: { limit: 20, hasMore: false } }),
    }),
  )
  let attempts = 0
  let successes = 0
  const keys: string[] = []
  const messages: Array<Record<string, unknown>> = []
  await page.route('**/api/ai-companion/conversations**', async (route) => {
    const request = route.request()
    if (new URL(request.url()).pathname.endsWith('/messages')) {
      attempts += 1
      keys.push(request.headers()['idempotency-key'] ?? '')
      if (attempts === 1) {
        await route.fulfill({
          status: 503,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            type: 'https://mentalbridge.dev/problems/chat-provider-unavailable',
            title: 'Provider unavailable',
            status: 503,
            code: 'CHAT_PROVIDER_UNAVAILABLE',
            correlationId: 'companion-e2e-provider-failure',
          }),
        })
        return
      }
      successes += 1
      messages.push(
        {
          messageId: '44444444-4444-4444-8444-444444444444',
          role: 'USER',
          content: 'Xin giữ lại nội dung này',
          createdAt: '2026-09-22T08:01:00Z',
          contextKinds: [],
        },
        {
          messageId: '55555555-5555-4555-8555-555555555555',
          role: 'ASSISTANT',
          content: 'Mình đang lắng nghe.',
          createdAt: '2026-09-22T08:01:00Z',
          contextKinds: ['SUPPORT_PLAN'],
        },
      )
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          conversationId,
          userMessageId: messages[0]!.messageId,
          assistantMessageId: messages[1]!.messageId,
          assistant: messages[1]!.content,
          createdAt: messages[1]!.createdAt,
          contextKinds: ['SUPPORT_PLAN'],
          quota: {
            plan: 'FREE',
            policyVersion: 'companion-quota-v1',
            remaining: 4,
            resetAt: '2026-09-22T17:00:00Z',
            limitDisplayed: true,
          },
        }),
      })
      return
    }
    const value = { ...conversationFixture(), messages }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        new URL(request.url()).pathname.endsWith(`/${conversationId}`)
          ? value
          : { items: [conversationSummaryFixture()] },
      ),
    })
  })

  await page.goto('/ai-companion')
  await expect(
    page.getByRole('button', { name: 'Gọi AI', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: /Cuộc trò chuyện mới.*Tiếp tục/ })
    .click()
  const composer = page.getByRole('textbox', { name: 'Tin nhắn' })
  await composer.fill('Xin giữ lại nội dung này')
  await page.getByRole('button', { name: 'Gửi' }).click()
  await expect(
    page.getByRole('region', { name: 'AI Companion' }).getByRole('alert'),
  ).toContainText('AI Companion đang gián đoạn')
  await expect(composer).toHaveValue('Xin giữ lại nội dung này')
  await expect(
    page.getByRole('link', { name: 'Cần trợ giúp ngay' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Gửi', exact: true }).click()
  await expect(
    page
      .getByRole('region', { name: 'AI Companion' })
      .getByText('Mình đang lắng nghe.'),
  ).toBeVisible()
  await expect(composer).toHaveValue('')
  expect(attempts).toBe(2)
  expect(successes).toBe(1)
  expect(keys[0]).not.toBe(keys[1])
})

test('MB-791 shows a server-resolved suggestion after the reply and keeps it on reload', async ({
  context,
  page,
}) => {
  await context.addCookies([
    {
      name: 'mentalbridge_access',
      value: 'synthetic-resource-e2e-access',
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  await page.setViewportSize({ width: 375, height: 844 })
  await page.route('**/api/journals', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], page: { limit: 20, hasMore: false } }),
    }),
  )
  const resourceId = '66666666-6666-4666-8666-666666666666'
  const suggestion = {
    destination: 'RESOURCE',
    resourceId,
    resourceTitle: 'Thở 4-7-8',
  }
  const messages: Array<Record<string, unknown>> = []
  await page.route('**/api/ai-companion/conversations**', async (route) => {
    const request = route.request()
    if (new URL(request.url()).pathname.endsWith('/messages')) {
      messages.push(
        {
          messageId: '44444444-4444-4444-8444-444444444444',
          role: 'USER',
          content: 'Ừ, thử bài thở đó coi',
          createdAt: '2026-11-03T08:01:00Z',
          contextKinds: [],
          suggestion: null,
        },
        {
          messageId: '55555555-5555-4555-8555-555555555555',
          role: 'ASSISTANT',
          content: 'Okela, bạn mở bài ở nút bên dưới nha. Thở chậm thôi.',
          createdAt: '2026-11-03T08:01:00Z',
          contextKinds: [],
          suggestion,
        },
      )
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          conversationId,
          userMessageId: messages[0]!.messageId,
          assistantMessageId: messages[1]!.messageId,
          assistant: messages[1]!.content,
          createdAt: messages[1]!.createdAt,
          contextKinds: [],
          quota: {
            plan: 'FREE',
            policyVersion: 'companion-quota-v2',
            remaining: 4,
            resetAt: '2026-11-03T17:00:00Z',
            limitDisplayed: true,
          },
          suggestion,
        }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        new URL(request.url()).pathname.endsWith(`/${conversationId}`)
          ? { ...conversationFixture(), messages }
          : { items: [conversationSummaryFixture()] },
      ),
    })
  })

  await page.goto('/ai-companion')
  await page
    .getByRole('button', { name: /Cuộc trò chuyện mới.*Tiếp tục/ })
    .click()
  await page
    .getByRole('textbox', { name: 'Tin nhắn' })
    .fill('Ừ, thử bài thở đó coi')
  await page.getByRole('button', { name: 'Gửi' }).click()
  const chat = page.getByRole('region', { name: 'AI Companion' })
  const link = chat.getByRole('link', { name: 'Mở bài: Thở 4-7-8' })
  await expect(link).toBeVisible()
  await expect(chat.getByText('Thở chậm thôi.', { exact: false })).toBeVisible()
  await expect(link).toHaveAttribute(
    'href',
    `/resources/${resourceId}?from=ai-companion`,
  )
  const box = await link.boundingBox()
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(40)
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375)

  await page.reload()
  await page
    .getByRole('button', {
      name: /Cuộc trò chuyện mới.*(?:Tiếp tục|Thở chậm thôi)/,
    })
    .click()
  await expect(
    page
      .getByRole('region', { name: 'AI Companion' })
      .getByRole('link', { name: 'Mở bài: Thở 4-7-8' }),
  ).toBeVisible()
})

test('MB-829 restores an unsent draft after reload in the same tab', async ({
  context,
  page,
}) => {
  await context.addCookies([
    {
      name: 'mentalbridge_access',
      value: 'synthetic-resource-e2e-access',
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/journals', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], page: { limit: 20, hasMore: false } }),
    }),
  )
  await page.route('**/api/ai-companion/conversations**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        new URL(route.request().url()).pathname.endsWith(`/${conversationId}`)
          ? conversationFixture()
          : { items: [conversationSummaryFixture()] },
      ),
    }),
  )

  await page.goto('/ai-companion')
  await page
    .getByRole('button', { name: /Cuộc trò chuyện mới.*Tiếp tục/ })
    .click()
  await page
    .getByRole('textbox', { name: 'Tin nhắn' })
    .fill('Mình chưa gửi dòng này')

  await page.reload()
  await page
    .getByRole('button', { name: /Cuộc trò chuyện mới.*Tiếp tục/ })
    .click()
  await expect(page.getByRole('textbox', { name: 'Tin nhắn' })).toHaveValue(
    'Mình chưa gửi dòng này',
  )
  const keys = await page.evaluate(() =>
    Object.keys(window.sessionStorage).filter((key) =>
      key.startsWith('mb.companion.draft.'),
    ),
  )
  expect(keys).toHaveLength(1)
  expect(
    await page.evaluate(() =>
      Object.entries(window.localStorage).filter(
        ([key, value]) =>
          key.startsWith('mb.companion.draft.') ||
          value.includes('Mình chưa gửi dòng này'),
      ),
    ),
  ).toEqual([])
})

test('MB-829 resends after an unknown outcome and stores one reply', async ({
  context,
  page,
}) => {
  await context.addCookies([
    {
      name: 'mentalbridge_access',
      value: 'synthetic-resource-e2e-access',
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/journals', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], page: { limit: 20, hasMore: false } }),
    }),
  )
  const keys: string[] = []
  const stored = new Map<string, Record<string, unknown>[]>()
  const messages: Array<Record<string, unknown>> = []
  await page.route('**/api/ai-companion/conversations**', async (route) => {
    const request = route.request()
    if (new URL(request.url()).pathname.endsWith('/messages')) {
      const key = request.headers()['idempotency-key'] ?? ''
      keys.push(key)
      // The first attempt commits on the server, but the browser never sees the answer.
      if (!stored.has(key)) {
        stored.set(key, [
          {
            messageId: '44444444-4444-4444-8444-444444444444',
            role: 'USER',
            content: 'Gửi một lần thôi',
            createdAt: '2026-09-22T08:01:00Z',
            contextKinds: [],
          },
          {
            messageId: '55555555-5555-4555-8555-555555555555',
            role: 'ASSISTANT',
            content: 'Mình đang lắng nghe.',
            createdAt: '2026-09-22T08:01:00Z',
            contextKinds: [],
          },
        ])
        messages.push(...stored.get(key)!)
        await route.fulfill({
          status: 503,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            type: 'https://mentalbridge.dev/problems/companion-outcome-unknown',
            title: 'Outcome unknown',
            status: 503,
            code: 'COMPANION_OUTCOME_UNKNOWN',
            correlationId: 'companion-e2e-outcome-unknown',
          }),
        })
        return
      }
      const replay = stored.get(key)!
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          conversationId,
          userMessageId: replay[0]!.messageId,
          assistantMessageId: replay[1]!.messageId,
          assistant: replay[1]!.content,
          createdAt: replay[1]!.createdAt,
          contextKinds: [],
          quota: {
            plan: 'FREE',
            policyVersion: 'companion-quota-v2',
            remaining: 4,
            resetAt: '2026-09-22T17:00:00Z',
            limitDisplayed: true,
          },
        }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        new URL(request.url()).pathname.endsWith(`/${conversationId}`)
          ? { ...conversationFixture(), messages }
          : { items: [conversationSummaryFixture()] },
      ),
    })
  })

  await page.goto('/ai-companion')
  await page
    .getByRole('button', { name: /Cuộc trò chuyện mới.*Tiếp tục/ })
    .click()
  await page.getByRole('textbox', { name: 'Tin nhắn' }).fill('Gửi một lần thôi')
  await page.getByRole('button', { name: 'Gửi', exact: true }).click()
  const chat = page.getByRole('region', { name: 'AI Companion' })
  await expect(chat.getByRole('alert')).toContainText('Chưa thể xác nhận')
  await chat.getByRole('button', { name: 'Gửi lại' }).click()
  await expect(chat.getByText('Mình đang lắng nghe.')).toHaveCount(1)
  await expect(chat.getByText('Gửi một lần thôi')).toHaveCount(1)
  expect(keys).toHaveLength(2)
  expect(keys[1]).toBe(keys[0])
  expect(messages).toHaveLength(2)
})

test('MB-829 resends with the same key after an unknown outcome and a reload', async ({
  context,
  page,
}) => {
  await context.addCookies([
    {
      name: 'mentalbridge_access',
      value: 'synthetic-resource-e2e-access',
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/api/journals', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], page: { limit: 20, hasMore: false } }),
    }),
  )
  const keys: string[] = []
  const stored = new Map<string, Record<string, unknown>[]>()
  const messages: Array<Record<string, unknown>> = []
  await page.route('**/api/ai-companion/conversations**', async (route) => {
    const request = route.request()
    if (new URL(request.url()).pathname.endsWith('/messages')) {
      const key = request.headers()['idempotency-key'] ?? ''
      keys.push(key)
      if (!stored.has(key)) {
        // Committed on the server, but the browser only sees an unknown outcome.
        stored.set(key, [
          {
            messageId: '44444444-4444-4444-8444-444444444444',
            role: 'USER',
            content: 'Gửi qua tải lại',
            createdAt: '2026-09-22T08:01:00Z',
            contextKinds: [],
          },
          {
            messageId: '55555555-5555-4555-8555-555555555555',
            role: 'ASSISTANT',
            content: 'Mình đang lắng nghe.',
            createdAt: '2026-09-22T08:01:00Z',
            contextKinds: [],
          },
        ])
        messages.push(...stored.get(key)!)
        await route.fulfill({
          status: 503,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            type: 'https://mentalbridge.dev/problems/companion-outcome-unknown',
            title: 'Outcome unknown',
            status: 503,
            code: 'COMPANION_OUTCOME_UNKNOWN',
            correlationId: 'companion-e2e-reload-unknown',
          }),
        })
        return
      }
      const replay = stored.get(key)!
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          conversationId,
          userMessageId: replay[0]!.messageId,
          assistantMessageId: replay[1]!.messageId,
          assistant: replay[1]!.content,
          createdAt: replay[1]!.createdAt,
          contextKinds: [],
          quota: {
            plan: 'FREE',
            policyVersion: 'companion-quota-v2',
            remaining: 4,
            resetAt: '2026-09-22T17:00:00Z',
            limitDisplayed: true,
          },
        }),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        new URL(request.url()).pathname.endsWith(`/${conversationId}`)
          ? { ...conversationFixture(), messages: [] }
          : { items: [conversationSummaryFixture()] },
      ),
    })
  })

  await page.goto('/ai-companion')
  await page
    .getByRole('button', { name: /Cuộc trò chuyện mới.*Tiếp tục/ })
    .click()
  await page.getByRole('textbox', { name: 'Tin nhắn' }).fill('Gửi qua tải lại')
  await page.getByRole('button', { name: 'Gửi', exact: true }).click()
  const chat = page.getByRole('region', { name: 'AI Companion' })
  await expect(chat.getByRole('alert')).toContainText('Chưa thể xác nhận')

  await page.reload()
  await page
    .getByRole('button', { name: /Cuộc trò chuyện mới.*Tiếp tục/ })
    .click()
  await expect(page.getByRole('textbox', { name: 'Tin nhắn' })).toHaveValue(
    'Gửi qua tải lại',
  )
  await page.getByRole('button', { name: 'Gửi', exact: true }).click()
  await expect(chat.getByText('Mình đang lắng nghe.')).toHaveCount(1)
  await expect(chat.getByText('Gửi qua tải lại')).toHaveCount(1)
  expect(keys).toHaveLength(2)
  expect(keys[1]).toBe(keys[0])
  expect(stored.size).toBe(1)
})

test('MB-829 shows a visible stop glyph on the pending send button at 375', async ({
  context,
  page,
}) => {
  await context.addCookies([
    {
      name: 'mentalbridge_access',
      value: 'synthetic-resource-e2e-access',
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ])
  await page.setViewportSize({ width: 375, height: 812 })
  await page.route('**/api/journals', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [], page: { limit: 20, hasMore: false } }),
    }),
  )
  let releaseSend: () => void = () => undefined
  const held = new Promise<void>((resolve) => {
    releaseSend = resolve
  })
  await page.route('**/api/ai-companion/conversations**', async (route) => {
    const request = route.request()
    if (new URL(request.url()).pathname.endsWith('/messages')) {
      await held
      await route.abort()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        new URL(request.url()).pathname.endsWith(`/${conversationId}`)
          ? conversationFixture()
          : { items: [conversationSummaryFixture()] },
      ),
    })
  })

  await page.goto('/ai-companion')
  await page
    .getByRole('button', { name: /Cuộc trò chuyện mới.*Tiếp tục/ })
    .click()
  await page
    .getByRole('textbox', { name: 'Tin nhắn' })
    .fill('Đang chờ phản hồi')
  await page.getByRole('button', { name: 'Gửi', exact: true }).click()
  const glyph = page
    .getByRole('button', { name: 'Dừng phản hồi' })
    .locator('span[aria-hidden="true"]')
  await expect(glyph).toBeVisible()
  const box = await glyph.boundingBox()
  expect(box?.width ?? 0).toBeGreaterThan(0)
  expect(box?.height ?? 0).toBeGreaterThan(0)
  releaseSend()
})

function conversationFixture() {
  return {
    conversationId,
    title: 'Cuộc trò chuyện mới',
    context: {
      sources: {
        plan: true,
        diary: false,
        screening: false,
        resourceIds: [],
      },
      updatedAt: now,
    },
    messages: [],
    createdAt: now,
    updatedAt: now,
    expiresAt: '2026-12-21T08:00:00Z',
  }
}

function conversationSummaryFixture() {
  return {
    conversationId,
    title: 'Cuộc trò chuyện mới',
    createdAt: now,
    updatedAt: now,
    expiresAt: '2026-12-21T08:00:00Z',
  }
}
