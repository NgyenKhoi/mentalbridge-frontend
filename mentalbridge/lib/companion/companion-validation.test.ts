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

describe('AI Companion encrypted title fields (MB-810)', () => {
  const titleVersion = 'B'.repeat(43)
  const base = '2026-11-06T08:00:00Z'
  const conversation = {
    conversationId: '11111111-1111-4111-8111-111111111111',
    title: 'Áp lực công việc',
    titleVersion,
    context: {
      sources: { plan: false, diary: false, screening: false, resourceIds: [] },
      updatedAt: base,
    },
    messages: [],
    createdAt: base,
    updatedAt: base,
    expiresAt: '2027-02-04T08:00:00Z',
  }
  const summary = {
    conversationId: conversation.conversationId,
    title: conversation.title,
    titleVersion,
    createdAt: base,
    updatedAt: base,
    expiresAt: conversation.expiresAt,
  }
  const send = {
    conversationId: conversation.conversationId,
    title: conversation.title,
    titleVersion,
    userMessageId: '22222222-2222-4222-8222-222222222222',
    assistantMessageId: '33333333-3333-4333-8333-333333333333',
    assistant: 'Synthetic',
    createdAt: base,
    contextKinds: [],
    quota: {
      plan: 'FREE',
      policyVersion: 'companion-quota-v2',
      remaining: 4,
      resetAt: '2026-11-06T17:00:00Z',
      limitDisplayed: true,
    },
  }
  const omit = (value: object, ...keys: string[]) =>
    Object.fromEntries(Object.entries(value).filter(([k]) => !keys.includes(k)))
  const conversationWithoutVersion = omit(conversation, 'titleVersion')
  const sendWithoutTitle = omit(send, 'title', 'titleVersion')

  it('passes backend-shaped detail, list and send through unchanged', () => {
    expect(parseConversation(conversation)).toEqual(conversation)
    expect(parseConversationList({ items: [summary] })).toEqual({
      items: [summary],
    })
    expect(parseSend(send)).toEqual(send)
  })

  it('still accepts the pre-title shape and a send with only a version', () => {
    expect(parseConversation(conversationWithoutVersion)).not.toBeNull()
    expect(parseSend(sendWithoutTitle)).not.toBeNull()
    expect(parseSend({ ...sendWithoutTitle, titleVersion })).not.toBeNull()
  })

  it.each(['', 'short', 'B'.repeat(44), 'B'.repeat(42) + '=', 7, null])(
    'rejects an invalid titleVersion %j',
    (bad) => {
      expect(
        parseConversation({ ...conversation, titleVersion: bad }),
      ).toBeNull()
      expect(
        parseConversationList({ items: [{ ...summary, titleVersion: bad }] }),
      ).toBeNull()
      expect(parseSend({ ...send, titleVersion: bad })).toBeNull()
    },
  )

  it.each(['', 'x'.repeat(81), 7, null])(
    'rejects an invalid send title %j',
    (bad) => {
      expect(parseSend({ ...send, title: bad })).toBeNull()
    },
  )

  it('keeps rejecting unknown fields', () => {
    expect(parseConversation({ ...conversation, rename: true })).toBeNull()
    expect(parseSend({ ...send, encryptedTitle: 'x' })).toBeNull()
  })
})
