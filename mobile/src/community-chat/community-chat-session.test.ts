import { ApiError } from '@/api/api-error'
import type { CommunityChatApi } from './community-chat-api'
import { CommunityChatSession } from './community-chat-session'
import type { CommunitySocket } from './community-chat-socket'

const id = '11111111-1111-4111-8111-111111111111',
  peerId = '22222222-2222-4222-8222-222222222222',
  messageId = '33333333-3333-4333-8333-333333333333'
const date = '2026-10-21T01:00:00Z'
const peer = {
  state: 'AVAILABLE' as const,
  communityProfileId: peerId,
  displayName: 'Bạn',
}
const message = {
  messageId,
  conversationId: id,
  clientMessageId: messageId,
  sender: peer,
  content: 'Lời chào',
  createdAt: date,
}
function event(eventType: string, payload: unknown) {
  return {
    schemaVersion: 1,
    eventId: id,
    correlationId: id,
    occurredAt: date,
    eventType,
    payload,
  }
}
class Socket implements CommunitySocket {
  listeners = new Map<string, ((value?: unknown) => void)[]>()
  disconnect = jest.fn()
  connect = () => this.fire('connect')
  removeAllListeners = () => this.listeners.clear()
  on = (name: string, listener: (value?: unknown) => void) => {
    this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener])
  }
  fire = (name: string, value?: unknown) =>
    this.listeners.get(name)?.forEach((listener) => listener(value))
  emit = jest.fn(
    (_name: string, command: unknown, ack: (value: unknown) => void) => {
      const value = command as { commandId: string }
      ack(
        event('community.command.ack', {
          commandId: value.commandId,
          status: 'ACCEPTED',
        }),
      )
    },
  )
}
const active: CommunityChatSession[] = []
function fixture() {
  const api = {
    credential: jest.fn().mockResolvedValue({
      credential: 'x'.repeat(43),
      namespace: '/community',
      expiresAt: new Date(Date.now() + 30000).toISOString(),
    }),
    conversation: jest.fn().mockResolvedValue({
      value: {
        conversationId: id,
        kind: 'DIRECT',
        state: 'ACTIVE',
        peers: [peer],
        version: '0',
        unreadCount: 4,
      },
      etag: '"0"',
    }),
    messages: jest
      .fn()
      .mockResolvedValue({ items: [message], nextCursor: null }),
    send: jest.fn().mockResolvedValue({
      message,
      persistence: 'SAVED',
      delivery: 'UNCONFIRMED',
    }),
    read: jest
      .fn()
      .mockResolvedValue({ lastReadMessageId: messageId, unreadCount: 0 }),
  }
  const sockets: Socket[] = []
  let uuid = 0
  const session = new CommunityChatSession({
    api: api as unknown as CommunityChatApi,
    conversationId: id,
    uuid: () => `44444444-4444-4444-8444-${String(++uuid).padStart(12, '0')}`,
    factory: () => {
      const socket = new Socket()
      sockets.push(socket)
      return socket
    },
  })
  active.push(session)
  return {
    api,
    session,
    sockets,
    socket: () => {
      const socket = sockets.at(-1)
      if (!socket) throw Error('Missing socket')
      return socket
    },
  }
}
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve()
}
it('discards an in-flight history result when permission invalidation arrives, even before the next owner read finishes', async () => {
  const { api, session, socket } = fixture()
  await session.start()
  let release:
    | ((value: { items: (typeof message)[]; nextCursor: null }) => void)
    | undefined
  api.messages.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        release = resolve
      }),
  )
  const repair = session.repair()
  await flush()
  api.conversation.mockRejectedValueOnce(
    new ApiError({
      code: 'TARGET_UNAVAILABLE',
      status: 404,
      message: 'Unavailable',
    }),
  )
  socket().fire(
    'community.event',
    event('community.conversation.invalidated', { conversationId: id }),
  )
  expect(session.snapshot().messages).toEqual([])
  release?.({ items: [message], nextCursor: null })
  await repair
  await flush()
  expect(session.snapshot().messages).toEqual([])
  expect(session.snapshot().phase).toBe('unavailable')
})
afterEach(() => {
  active.splice(0).forEach((session) => session.clear())
})
it('gets a fresh ticket on foreground/reconnect, clears background content and never writes from socket commands', async () => {
  const { api, session, socket } = fixture()
  await session.start()
  expect(session.snapshot().phase).toBe('ready')
  expect(
    socket().emit.mock.calls.map(
      (call) => (call[1] as { commandType: string }).commandType,
    ),
  ).toEqual([
    'community.conversation.subscribe',
    'community.presence.heartbeat',
  ])
  session.stop()
  expect(session.snapshot().messages).toEqual([])
  expect(session.snapshot().presence).toEqual({})
  await session.start()
  expect(api.credential).toHaveBeenCalledTimes(2)
  expect(api.send).not.toHaveBeenCalled()
})
it('uses socket messages only to repair REST order, dedupes IDs and replaces absolute unread', async () => {
  const { api, session, socket } = fixture()
  await session.start()
  const second = { ...message, messageId: peerId, content: 'Thứ hai' }
  api.messages.mockResolvedValue({
    items: [second, message, message],
    nextCursor: null,
  })
  socket().fire(
    'community.event',
    event('community.message.created', { message: second }),
  )
  await flush()
  expect(session.snapshot().messages.map((value) => value.messageId)).toEqual([
    peerId,
    messageId,
  ])
  socket().fire(
    'community.event',
    event('community.read-state.changed', {
      conversationId: id,
      lastReadMessageId: null,
      unreadCount: 2,
    }),
  )
  socket().fire(
    'community.event',
    event('community.read-state.changed', {
      conversationId: id,
      lastReadMessageId: null,
      unreadCount: 2,
    }),
  )
  expect(session.snapshot().conversation?.value.unreadCount).toBe(2)
})
it('clears badges immediately on disconnect or invalidation and rejects unknown peer presence', async () => {
  const { api, session, socket } = fixture()
  await session.start()
  socket().fire(
    'community.event',
    event('community.presence.changed', {
      communityProfileId: peerId,
      state: 'ONLINE',
    }),
  )
  socket().fire(
    'community.event',
    event('community.presence.changed', {
      communityProfileId: messageId,
      state: 'ONLINE',
    }),
  )
  expect(session.snapshot().presence).toEqual({ [peerId]: 'ONLINE' })
  api.conversation.mockRejectedValue(
    new ApiError({
      code: 'TARGET_UNAVAILABLE',
      status: 404,
      message: 'Unavailable',
    }),
  )
  socket().fire(
    'community.event',
    event('community.conversation.invalidated', { conversationId: id }),
  )
  expect(session.snapshot().messages).toEqual([])
  expect(session.snapshot().presence).toEqual({})
  await flush()
  expect(session.snapshot().phase).toBe('unavailable')
})
it('does not repeat uncertain sends automatically and preserves exact manual retry identity after reconnect', async () => {
  const { api, session } = fixture()
  await session.start()
  api.send.mockRejectedValueOnce(
    new ApiError({ code: 'REQUEST_TIMEOUT', message: 'Timeout' }),
  )
  expect(await session.send('Bản nháp')).toBe(false)
  expect(session.snapshot().unconfirmed).toBe(true)
  session.stop()
  await session.start()
  expect(api.send).toHaveBeenCalledTimes(1)
  expect(await session.send('Bản nháp')).toBe(true)
  expect(api.send.mock.calls[0]).toEqual(api.send.mock.calls[1])
  expect(session.snapshot().unconfirmed).toBe(false)
})
it('drops late history after background/account disposal and prevents offline sends', async () => {
  const { api, session } = fixture()
  let resolve: ((value: unknown) => void) | undefined
  api.messages.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done
      }),
  )
  const pending = session.start()
  await flush()
  session.clear()
  resolve?.({ items: [message], nextCursor: null })
  await pending
  expect(session.snapshot().messages).toEqual([])
  expect(await session.send('Không gửi')).toBe(false)
  expect(api.send).not.toHaveBeenCalled()
})
it('reauthorizes before continuing cursor pages and never turns ACK or malformed events into a grant', async () => {
  const { api, session, socket } = fixture()
  api.messages.mockResolvedValueOnce({ items: [message], nextCursor: 'opaque' })
  await session.start()
  api.messages
    .mockResolvedValueOnce({ items: [message], nextCursor: 'opaque' })
    .mockResolvedValueOnce({
      items: [{ ...message, messageId: peerId }],
      nextCursor: null,
    })
  await session.more()
  expect(session.snapshot().messages).toHaveLength(2)
  expect(api.conversation).toHaveBeenCalledTimes(2)
  socket().fire('community.event', {
    ...event('community.presence.changed', {
      communityProfileId: peerId,
      state: 'ONLINE',
    }),
    privateRoutingId: id,
  })
  expect(session.snapshot().phase).toBe('unavailable')
  expect(session.snapshot().messages).toEqual([])
})
