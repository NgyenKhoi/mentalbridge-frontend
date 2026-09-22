import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const companionMocks = vi.hoisted(() => ({ send: vi.fn() }))
const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/companion/companion-client', () => ({
  companionClient: companionMocks,
}))
vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { POST } from './route'

const conversationId = '11111111-1111-4111-8111-111111111111'
const account = {
  accountId: '22222222-2222-4222-8222-222222222222',
  status: 'ACTIVE',
  roles: ['USER'],
  emailVerified: true,
}

const sendRequest = (body: unknown, key = 'companion-command-0001') =>
  new NextRequest(
    `http://localhost/api/ai-companion/conversations/${conversationId}/messages`,
    {
      method: 'POST',
      headers: {
        cookie: `${ACCESS_COOKIE_NAME}=server-access-token`,
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify(body),
    },
  )

const routeContext = {
  params: Promise.resolve({ conversationId }),
}

describe('POST /api/ai-companion/conversations/:id/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.resolveSession.mockResolvedValue({ account })
  })

  it('forwards only validated context with the server-held bearer', async () => {
    companionMocks.send.mockResolvedValue({
      conversationId,
      userMessageId: '33333333-3333-4333-8333-333333333333',
      assistantMessageId: '44444444-4444-4444-8444-444444444444',
      assistant: 'Synthetic answer',
      createdAt: '2026-09-20T08:00:00Z',
      quota: {
        plan: 'FREE',
        policyVersion: 'companion-quota-v1',
        remaining: 4,
        resetAt: '2026-09-20T17:00:00Z',
        limitDisplayed: true,
      },
    })
    const body = {
      message: 'Synthetic question',
      context: {
        journalIds: ['55555555-5555-4555-8555-555555555555'],
        includeCurrentSupportPlan: true,
        includeReminderContext: false,
      },
    }

    const response = await POST(sendRequest(body), routeContext)

    expect(response.status).toBe(201)
    expect(companionMocks.send).toHaveBeenCalledWith(
      'server-access-token',
      conversationId,
      body,
      'companion-command-0001',
      expect.any(String),
    )
    expect(JSON.stringify(await response.json())).not.toContain(
      'server-access-token',
    )
  })

  it('rejects unknown context fields before provider access', async () => {
    const response = await POST(
      sendRequest({
        message: 'Synthetic question',
        context: { rawAssessmentScore: 27 },
      }),
      routeContext,
    )
    expect(response.status).toBe(400)
    expect(companionMocks.send).not.toHaveBeenCalled()
  })

  it('returns stable sanitized quota and consent failures', async () => {
    companionMocks.send.mockRejectedValue(
      new ApiError({
        message: 'private upstream detail',
        code: 'CHAT_QUOTA_EXHAUSTED',
        status: 429,
      }),
    )
    const response = await POST(
      sendRequest({ message: 'Synthetic question' }),
      routeContext,
    )
    const value = await response.json()
    expect(response.status).toBe(429)
    expect(value.code).toBe('CHAT_QUOTA_EXHAUSTED')
    expect(JSON.stringify(value)).not.toContain('private upstream detail')
  })
})
