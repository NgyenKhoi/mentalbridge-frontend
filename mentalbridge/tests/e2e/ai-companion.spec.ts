import { expect } from '@playwright/test'
import { test } from './test-fixtures'

const conversationId = '11111111-1111-4111-8111-111111111111'
const journalId = '22222222-2222-4222-8222-222222222222'
const now = '2026-09-22T08:00:00Z'

test('MB-512 completes a quota-governed companion conversation on mobile', async ({
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

  const messages: Array<Record<string, unknown>> = []
  let deleted = false
  let sentBody: Record<string, unknown> | null = null
  let idempotencyKey = ''
  const conversation = () => ({
    conversationId,
    title: 'Cuộc trò chuyện mới',
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

  await page.goto('/messages')
  await expect(page.getByRole('heading', { name: 'Trò chuyện' })).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Cần trợ giúp ngay' }),
  ).toBeVisible()

  await page.getByText('Chọn thông tin để AI hiểu bạn hơn').click()
  await page.getByRole('checkbox', { name: 'Một ngày bình tĩnh hơn' }).check()
  await page
    .getByRole('textbox', { name: 'Tin nhắn' })
    .fill('Mình nên bắt đầu từ đâu?')
  await page.getByRole('button', { name: 'Gửi' }).click()

  await expect(
    page.getByText('Hãy chọn một bước nhỏ và vừa sức.'),
  ).toBeVisible()
  await expect(page.getByText(/Còn 4 lượt/)).toBeVisible()
  await expect(
    page.getByText('Nhật ký bạn đã chọn · Kế hoạch hỗ trợ hiện tại'),
  ).toBeVisible()
  expect(idempotencyKey.length).toBeGreaterThanOrEqual(16)
  expect(sentBody).toEqual({
    message: 'Mình nên bắt đầu từ đâu?',
    context: {
      journalIds: [journalId],
      includeCurrentSupportPlan: true,
      includeReminderContext: false,
    },
  })

  page.once('dialog', (dialog) => void dialog.accept())
  await page.getByRole('button', { name: 'Xóa cuộc trò chuyện' }).click()
  await expect(
    page.getByRole('heading', { name: 'Bắt đầu khi bạn sẵn sàng' }),
  ).toBeVisible()
  expect(deleted).toBe(true)
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

  await page.goto('/messages')
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
  await page.getByRole('button', { name: 'Gửi' }).click()
  await expect(page.getByText('Mình đang lắng nghe.')).toBeVisible()
  await expect(composer).toHaveValue('')
  expect(attempts).toBe(2)
  expect(successes).toBe(1)
  expect(keys[0]).not.toBe(keys[1])
})

function conversationFixture() {
  return {
    conversationId,
    title: 'Cuộc trò chuyện mới',
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
