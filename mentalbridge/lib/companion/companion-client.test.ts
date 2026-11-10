import { delay, http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockServer } from '@/tests/mocks/server'
import { companionClient } from './companion-client'

const baseUrl = 'http://journal.test'
const conversationId = '11111111-1111-4111-8111-111111111111'
const timestamp = '2026-09-20T08:00:00Z'

const message = (index: number) => ({
  messageId: `${String(index).padStart(8, '0')}-1111-4111-8111-111111111111`,
  role: index % 2 === 0 ? ('USER' as const) : ('ASSISTANT' as const),
  content: '\u0001'.repeat(2_000),
  createdAt: timestamp,
  contextKinds: [],
})

describe('AI Companion server-only client', () => {
  afterEach(() => vi.unstubAllEnvs())

  function configure(timeout = '5000') {
    vi.stubEnv('JOURNAL_AI_SERVICE_URL', baseUrl)
    vi.stubEnv('JOURNAL_AI_SERVICE_TIMEOUT_MS', timeout)
  }

  it('accepts a 400-message detail response near the contract bound', async () => {
    configure()
    const conversation = {
      conversationId,
      title: 'Bounded history',
      context: {
        sources: {
          plan: true,
          diary: false,
          screening: false,
          resourceIds: [],
        },
        updatedAt: timestamp,
      },
      messages: Array.from({ length: 400 }, (_, index) => message(index)),
      createdAt: timestamp,
      updatedAt: timestamp,
      expiresAt: '2026-12-19T08:00:00Z',
    }
    expect(
      new TextEncoder().encode(JSON.stringify(conversation)).byteLength,
    ).toBeGreaterThan(4 * 1024 * 1024)
    mockServer.use(
      http.get(
        `${baseUrl}/api/v1/ai-companion/conversations/${conversationId}`,
        () => HttpResponse.json(conversation),
      ),
    )

    await expect(
      companionClient.get('access-token', conversationId, 'correlation-id'),
    ).resolves.toMatchObject({ conversationId, messages: { length: 400 } })
  })

  it('classifies a timed-out send as an ambiguous outcome', async () => {
    configure('100')
    mockServer.use(
      http.post(
        `${baseUrl}/api/v1/ai-companion/conversations/${conversationId}/messages`,
        async () => {
          await delay(250)
          return HttpResponse.json({})
        },
      ),
    )

    await expect(
      companionClient.send(
        'access-token',
        conversationId,
        { message: 'Xin hỗ trợ' },
        'companion-command-0001',
        'correlation-id',
      ),
    ).rejects.toMatchObject({
      code: 'COMPANION_OUTCOME_UNKNOWN',
      status: 503,
    })
  })

  it('passes the optional MB-810 title fields through send', async () => {
    configure()
    const result = {
      conversationId,
      title: 'Áp lực công việc',
      titleVersion: 'B'.repeat(43),
      userMessageId: '22222222-2222-4222-8222-222222222222',
      assistantMessageId: '33333333-3333-4333-8333-333333333333',
      assistant: 'Mình nghe nè.',
      createdAt: timestamp,
      contextKinds: [],
      quota: {
        plan: 'FREE',
        policyVersion: 'companion-quota-v2',
        remaining: 4,
        resetAt: '2026-09-20T17:00:00Z',
        limitDisplayed: true,
      },
    }
    mockServer.use(
      http.post(
        `${baseUrl}/api/v1/ai-companion/conversations/${conversationId}/messages`,
        () => HttpResponse.json(result, { status: 201 }),
      ),
    )

    await expect(
      companionClient.send(
        'access-token',
        conversationId,
        { message: 'Kể chuyện công việc' },
        'companion-command-0003',
        'correlation-id',
      ),
    ).resolves.toEqual(result)
  })

  it('passes a server-resolved suggestion and quota v2 through send', async () => {
    configure()
    const result = {
      conversationId,
      userMessageId: '22222222-2222-4222-8222-222222222222',
      assistantMessageId: '33333333-3333-4333-8333-333333333333',
      assistant: 'Okela, bạn mở bài ở nút bên dưới nha.',
      createdAt: timestamp,
      contextKinds: [],
      quota: {
        plan: 'FREE',
        policyVersion: 'companion-quota-v2',
        remaining: 4,
        resetAt: '2026-09-20T17:00:00Z',
        limitDisplayed: true,
      },
      suggestion: {
        destination: 'RESOURCE',
        resourceId: '44444444-4444-4444-8444-444444444444',
        resourceTitle: 'Thở 4-7-8',
      },
    }
    mockServer.use(
      http.post(
        `${baseUrl}/api/v1/ai-companion/conversations/${conversationId}/messages`,
        () => HttpResponse.json(result, { status: 201 }),
      ),
    )

    await expect(
      companionClient.send(
        'access-token',
        conversationId,
        { message: 'Ừ, thử bài thở đó coi' },
        'companion-command-0002',
        'correlation-id',
      ),
    ).resolves.toEqual(result)
  })
})
