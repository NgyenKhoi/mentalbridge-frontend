import type { AxiosInstance } from 'axios'
import { createCommunityChatApi } from './community-chat-api'
import { eventSchema, peerSchema, sendSchema } from './community-chat-contract'

const conversationId = '11111111-1111-4111-8111-111111111111',
  profileId = '22222222-2222-4222-8222-222222222222',
  messageId = '33333333-3333-4333-8333-333333333333',
  key = '44444444-4444-4444-8444-444444444444'
const peer = {
  state: 'AVAILABLE' as const,
  communityProfileId: profileId,
  displayName: 'Bạn cùng cộng đồng',
}
const conversation = {
  conversationId,
  kind: 'DIRECT',
  state: 'ACTIVE',
  peers: [peer],
  unreadCount: 1,
  version: '9007199254740993',
}
const message = {
  messageId,
  conversationId,
  clientMessageId: key,
  sender: peer,
  state: 'ACTIVE' as const,
  content: 'Một lời chào',
  createdAt: '2026-10-21T01:00:00Z',
}
function fixture() {
  const methods = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  }
  return {
    ...methods,
    api: createCommunityChatApi(methods as unknown as AxiosInstance),
  }
}
it('reports only an exact visible message reference and never copies chat content into the intake', async () => {
  const { post, api } = fixture()
  post.mockResolvedValue({ data: { caseId: messageId, state: 'RECEIVED' } })
  await api.report(messageId, 'PRIVACY_CONCERN', key)
  expect(post).toHaveBeenCalledWith(
    '/api/v1/community/chat/reports',
    { messageId, reasonCode: 'PRIVACY_CONCERN' },
    { headers: { 'Idempotency-Key': key } },
  )
})
it('clears only the caller conversation view with a caller-preserved command key', async () => {
  const { delete: del, api } = fixture()
  const commandKey = '33333333-3333-4333-8333-333333333333'
  del.mockResolvedValue({ status: 204 })

  await api.clearConversation(conversationId, commandKey)

  expect(del).toHaveBeenCalledWith(
    `/api/v1/community/chat/conversations/${conversationId}`,
    { headers: { 'Idempotency-Key': commandKey } },
  )
})
it('uses authoritative body revisions when GET has no ETag, retaining exact large decimal versions', async () => {
  const { get, api } = fixture()
  get.mockResolvedValue({ data: conversation, headers: {} })
  expect((await api.conversation(conversationId)).etag).toBe(
    '"9007199254740993"',
  )
  get.mockResolvedValue({
    data: {
      version: '0',
      preferences: {
        directMessagePolicy: 'APPROVAL_REQUIRED',
        presenceVisible: false,
        invisible: false,
        typingVisible: false,
        readReceiptsVisible: false,
      },
    },
    headers: {},
  })
  expect((await api.privacy()).etag).toBe('"0"')
  get.mockResolvedValue({ data: conversation, headers: { etag: '"0"' } })
  await expect(api.conversation(conversationId)).rejects.toMatchObject({
    code: 'COMMUNITY_CHAT_CONTRACT_MISMATCH',
  })
})
it('issues native credentials without a BFF route or actor selector', async () => {
  const { api, post } = fixture()
  post.mockResolvedValue({
    data: {
      schemaVersion: 1,
      namespace: '/community',
      credential: 'x'.repeat(43),
      expiresAt: '2026-10-21T10:00:00Z',
    },
  })
  await api.credential()
  expect(post).toHaveBeenCalledWith('/api/v1/community/socket-credentials')
})
it('binds sends to exact conversation/content/client message identity and caller-preserved retry keys', async () => {
  const { api, post } = fixture()
  post.mockResolvedValue({
    data: { message, persistence: 'SAVED', delivery: 'UNCONFIRMED' },
  })
  await api.send(conversationId, key, message.content, key)
  await api.send(conversationId, key, message.content, key)
  expect(post.mock.calls[0]).toEqual(post.mock.calls[1])
  expect(post.mock.calls[0]?.[2]).toEqual({
    headers: { 'Idempotency-Key': key },
  })
  post.mockResolvedValue({
    data: {
      message: { ...message, conversationId: profileId },
      persistence: 'SAVED',
      delivery: 'UNCONFIRMED',
    },
  })
  await expect(
    api.send(conversationId, key, message.content, key),
  ).rejects.toMatchObject({ code: 'COMMUNITY_CHAT_CONTRACT_MISMATCH' })
})
it('retracts an exact own message and accepts only the matching content-free tombstone', async () => {
  const { api, delete: remove } = fixture()
  const tombstone = {
    messageId,
    conversationId,
    clientMessageId: key,
    sender: peer,
    state: 'RETRACTED',
    createdAt: message.createdAt,
    retractedAt: '2026-10-21T01:01:00Z',
  }
  remove.mockResolvedValue({ data: tombstone })

  await expect(api.retract(conversationId, messageId)).resolves.toEqual(
    tombstone,
  )
  expect(remove).toHaveBeenCalledWith(
    `/api/v1/community/chat/conversations/${conversationId}/messages/${messageId}`,
  )
  remove.mockResolvedValue({ data: { ...tombstone, content: 'leak' } })
  await expect(api.retract(conversationId, messageId)).rejects.toThrow()
})
it('rejects cross-conversation history and repeated cursor before displaying a projection', async () => {
  const { api, get } = fixture()
  get.mockResolvedValue({
    data: {
      items: [{ ...message, conversationId: profileId }],
      nextCursor: null,
    },
  })
  await expect(api.messages(conversationId)).rejects.toMatchObject({
    code: 'COMMUNITY_CHAT_CONTRACT_MISMATCH',
  })
  get.mockResolvedValue({ data: { items: [], nextCursor: 'opaque' } })
  await expect(api.messages(conversationId, 'opaque')).rejects.toMatchObject({
    code: 'COMMUNITY_CHAT_CONTRACT_MISMATCH',
  })
})
it('keeps empty terminal decisions separate from accepted membership and never fabricates an ETag', async () => {
  const { api, post, delete: remove } = fixture()
  post.mockResolvedValue({ status: 204, data: undefined, headers: {} })
  expect(await api.decideRequest(messageId, 'DECLINE', '"1"')).toBeNull()
  expect(
    await api.decideInvitation(messageId, conversationId, 'DECLINE', '"1"'),
  ).toBeNull()
  expect(post.mock.calls[0]?.[2]).toEqual({ headers: { 'If-Match': '"1"' } })
  remove.mockResolvedValue({ status: 204 })
  await api.archive(conversationId, '"9007199254740993"')
  expect(remove).toHaveBeenCalledWith(
    `/api/v1/community/chat/groups/${conversationId}`,
    { headers: { 'If-Match': '"9007199254740993"' } },
  )
  post.mockResolvedValue({
    status: 200,
    data: { ...conversation, kind: 'GROUP', name: 'Nhóm', memberLimit: 30 },
    headers: {},
  })
  await expect(
    api.decideInvitation(messageId, conversationId, 'ACCEPT', '"1"'),
  ).rejects.toThrow()
})
it('preserves unavailable peers without identity and validates Unicode code points rather than UTF-16 length', () => {
  expect(
    peerSchema.safeParse({
      state: 'UNAVAILABLE',
      communityProfileId: profileId,
    }).success,
  ).toBe(false)
  expect(
    sendSchema.safeParse({ clientMessageId: key, content: '🌿'.repeat(4000) })
      .success,
  ).toBe(true)
  expect(
    sendSchema.safeParse({ clientMessageId: key, content: '🌿'.repeat(4001) })
      .success,
  ).toBe(false)
  expect(
    sendSchema.safeParse({ clientMessageId: key, content: ' \n ' }).success,
  ).toBe(false)
})
it('consumes the current closed error event including retryability without accepting hidden counters', () => {
  const event = {
    schemaVersion: 1,
    eventId: key,
    correlationId: key,
    occurredAt: '2026-10-21T01:00:00Z',
    eventType: 'community.command.error',
    payload: {
      commandId: key,
      code: 'DEPENDENCY_UNAVAILABLE',
      retryable: true,
    },
  }
  expect(eventSchema.safeParse(event).success).toBe(true)
  expect(
    eventSchema.safeParse({
      ...event,
      payload: { ...event.payload, sequence: '99' },
    }).success,
  ).toBe(false)
})
