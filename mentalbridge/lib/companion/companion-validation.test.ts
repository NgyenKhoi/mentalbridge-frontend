import { describe, expect, it } from 'vitest'
import { parseConversation, parseSend } from './companion-validation'

describe('AI Companion response validation', () => {
  it('accepts the strict normalized contract', () => {
    expect(
      parseConversation({
        conversationId: '11111111-1111-4111-8111-111111111111',
        title: 'Synthetic',
        messages: [],
        createdAt: '2026-09-20T08:00:00Z',
        updatedAt: '2026-09-20T08:00:00Z',
        expiresAt: '2026-12-19T08:00:00Z',
      }),
    ).not.toBeNull()
  })

  it('fails closed for malformed Premium quota or unknown context kinds', () => {
    expect(
      parseSend({
        conversationId: '11111111-1111-4111-8111-111111111111',
        userMessageId: '22222222-2222-4222-8222-222222222222',
        assistantMessageId: '33333333-3333-4333-8333-333333333333',
        assistant: 'Synthetic',
        createdAt: '2026-09-20T08:00:00Z',
        quota: {
          plan: 'PREMIUM',
          policyVersion: 'companion-quota-v1',
          remaining: 999,
          resetAt: '2026-09-20T17:00:00Z',
          limitDisplayed: false,
        },
      }),
    ).toBeNull()
    expect(
      parseConversation({
        conversationId: '11111111-1111-4111-8111-111111111111',
        title: 'Synthetic',
        messages: [
          {
            messageId: '22222222-2222-4222-8222-222222222222',
            role: 'ASSISTANT',
            content: 'Synthetic',
            createdAt: '2026-09-20T08:00:00Z',
            contextKinds: ['RAW_ASSESSMENT'],
          },
        ],
        createdAt: '2026-09-20T08:00:00Z',
        updatedAt: '2026-09-20T08:00:00Z',
        expiresAt: '2026-12-19T08:00:00Z',
      }),
    ).toBeNull()
  })
})
