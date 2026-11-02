import { describe, expect, it } from 'vitest'
import {
  parseConversation,
  parseConversationList,
  parseSend,
} from './companion-validation'

describe('AI Companion response validation', () => {
  it('accepts the strict normalized contract', () => {
    expect(
      parseConversation({
        conversationId: '11111111-1111-4111-8111-111111111111',
        title: 'Synthetic',
        context: {
          sources: {
            plan: true,
            diary: false,
            screening: false,
            resourceIds: [],
          },
          updatedAt: '2026-09-20T08:00:00Z',
        },
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

  it('accepts metadata-only history and rejects message bodies in list items', () => {
    const summary = {
      conversationId: '11111111-1111-4111-8111-111111111111',
      title: 'Synthetic',
      createdAt: '2026-09-20T08:00:00Z',
      updatedAt: '2026-09-20T08:00:00Z',
      expiresAt: '2026-12-19T08:00:00Z',
    }
    expect(parseConversationList({ items: [summary] })).toEqual({
      items: [summary],
    })
    expect(
      parseConversationList({ items: [{ ...summary, messages: [] }] }),
    ).toBeNull()
  })
})

describe('AI Companion suggestion and quota v2', () => {
  const send = {
    conversationId: '11111111-1111-4111-8111-111111111111',
    userMessageId: '22222222-2222-4222-8222-222222222222',
    assistantMessageId: '33333333-3333-4333-8333-333333333333',
    assistant: 'Okela, bạn mở bài ở nút bên dưới nha.',
    createdAt: '2026-11-03T08:00:00Z',
    contextKinds: [],
    quota: {
      plan: 'FREE',
      policyVersion: 'companion-quota-v2',
      remaining: 4,
      resetAt: '2026-11-03T17:00:00Z',
      limitDisplayed: true,
    },
  }
  const resource = {
    destination: 'RESOURCE',
    resourceId: '44444444-4444-4444-8444-444444444444',
    resourceTitle: 'Thở 4-7-8',
  }
  const conversation = (message: Record<string, unknown>) => ({
    conversationId: '11111111-1111-4111-8111-111111111111',
    title: 'Synthetic',
    context: {
      sources: { plan: true, diary: false, screening: false, resourceIds: [] },
      updatedAt: '2026-11-03T08:00:00Z',
    },
    messages: [
      {
        messageId: '22222222-2222-4222-8222-222222222222',
        role: 'ASSISTANT',
        content: 'Synthetic',
        createdAt: '2026-11-03T08:00:00Z',
        contextKinds: [],
        ...message,
      },
    ],
    createdAt: '2026-11-03T08:00:00Z',
    updatedAt: '2026-11-03T08:00:00Z',
    expiresAt: '2027-02-01T08:00:00Z',
  })

  it('accepts quota v2 and an absent, null or valid suggestion', () => {
    expect(parseSend(send)).not.toBeNull()
    expect(parseSend({ ...send, suggestion: null })).not.toBeNull()
    expect(parseSend({ ...send, suggestion: resource })?.suggestion).toEqual(
      resource,
    )
    expect(
      parseSend({
        ...send,
        suggestion: {
          destination: 'JOURNAL',
          resourceId: null,
          resourceTitle: null,
        },
      }),
    ).not.toBeNull()
    expect(parseConversation(conversation({}))).not.toBeNull()
    expect(
      parseConversation(conversation({ suggestion: resource })),
    ).not.toBeNull()
  })

  it('fails closed for a malformed suggestion', () => {
    for (const suggestion of [
      { ...resource, destination: 'SETTINGS' },
      { ...resource, resourceId: 'not-a-uuid' },
      { ...resource, resourceTitle: 'ệ'.repeat(201) },
      { ...resource, resourceId: null },
      {
        destination: 'JOURNAL',
        resourceId: resource.resourceId,
        resourceTitle: null,
      },
      { ...resource, href: '/resources' },
      'RESOURCE',
    ]) {
      expect(parseSend({ ...send, suggestion })).toBeNull()
      expect(parseConversation(conversation({ suggestion }))).toBeNull()
    }
  })
})
