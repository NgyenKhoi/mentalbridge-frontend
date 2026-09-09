import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createMessageCommand,
  createSubscribeCommand,
} from '@/lib/realtime/commands'
import { createProductionRealtimeBoundary } from '@/lib/realtime/production'
import type { RealtimeSocket, SocketListener } from '@/lib/realtime/socket'
import {
  RealtimeTransport,
  type ConnectionState,
  type TransportIssue,
} from '@/lib/realtime/transport'

const accountId = '11111111-1111-4111-8111-111111111111'
const conversationId = '22222222-2222-4222-8222-222222222222'
const senderId = '33333333-3333-4333-8333-333333333333'

class FakeSocket implements RealtimeSocket {
  readonly listeners = new Map<string, Set<SocketListener>>()
  readonly sent: unknown[] = []
  disconnectCalls = 0
  acknowledgement?: (payload: unknown) => void

  connect(): void {}
  disconnect(): void {
    this.disconnectCalls += 1
  }
  on(event: string, listener: SocketListener): void {
    const listeners = this.listeners.get(event) ?? new Set()
    listeners.add(listener)
    this.listeners.set(event, listeners)
  }
  off(event: string, listener: SocketListener): void {
    this.listeners.get(event)?.delete(listener)
  }
  emit(
    _event: 'realtime.command',
    payload: unknown,
    acknowledgement: (payload: unknown) => void,
  ): void {
    this.sent.push(payload)
    this.acknowledgement = acknowledgement
  }
  trigger(event: string, payload?: unknown): void {
    for (const listener of [...(this.listeners.get(event) ?? [])])
      listener(payload)
  }
  listenerCount(): number {
    return [...this.listeners.values()].reduce(
      (total, listeners) => total + listeners.size,
      0,
    )
  }
}

function readyEvent(presence: 'connected' | 'degraded' = 'connected') {
  return {
    schemaVersion: 1,
    eventId: crypto.randomUUID(),
    eventType: 'connection.ready',
    correlationId: 'synthetic-test',
    occurredAt: new Date().toISOString(),
    payload: { accountId, role: 'USER', presence },
  }
}

function messageEvent(eventId = crypto.randomUUID()) {
  return {
    schemaVersion: 1,
    eventId,
    eventType: 'message.created',
    correlationId: 'synthetic-test',
    occurredAt: new Date().toISOString(),
    payload: {
      messageId: accountId,
      conversationId,
      senderId,
      clientMessageId: conversationId,
      type: 'TEXT',
      content: 'Synthetic event',
      sentAt: new Date().toISOString(),
      schemaVersion: 1,
    },
  }
}

async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('RealtimeTransport', () => {
  beforeEach(() => vi.useRealTimers())

  it('connects, applies duplicate acknowledgements/events once, and never maps not_applicable to delivered', async () => {
    const socket = new FakeSocket()
    const acknowledgements: string[] = []
    const events: unknown[] = []
    const issues: Array<TransportIssue | { code: string }> = []
    const transport = new RealtimeTransport({
      socketFactory: () => socket,
      credentialProvider: async () => ({
        status: 'available',
        credential: {
          accessToken: 'synthetic',
          expiresAtEpochMs: Date.now() + 1000,
        },
      }),
      eligibility: { check: async () => 'eligible' },
      onAcknowledgement: (_ack, delivery) => acknowledgements.push(delivery),
      onEvent: (event) => events.push(event),
      onError: (issue) => issues.push(issue),
    })
    transport.connect()
    await flush()
    socket.trigger('realtime.event', readyEvent())
    expect(transport.getState().phase).toBe('ready')

    const command = createMessageCommand(conversationId, 'Synthetic')
    expect(await transport.sendMessage(conversationId, command)).toBe('sent')
    const acknowledgement = {
      schemaVersion: 1,
      commandId: command.commandId,
      correlationId: command.correlationId,
      status: 'accepted',
      acknowledgedAt: new Date().toISOString(),
      liveDelivery: 'not_applicable',
    }
    socket.acknowledgement?.(acknowledgement)
    socket.acknowledgement?.({
      ...acknowledgement,
      status: 'duplicate',
      acknowledgedAt: new Date(Date.now() + 1000).toISOString(),
    })
    expect(acknowledgements).toEqual(['unconfirmed'])

    const event = messageEvent()
    socket.trigger('realtime.event', event)
    socket.trigger('realtime.event', event)
    socket.trigger('realtime.event', {
      ...event,
      eventId: crypto.randomUUID(),
    })
    expect(events).toHaveLength(2)
    expect(issues).toHaveLength(0)
  })

  it('surfaces conflicting command and acknowledgement reuse safely', async () => {
    const socket = new FakeSocket()
    const codes: string[] = []
    const transport = new RealtimeTransport({
      socketFactory: () => socket,
      credentialProvider: async () => ({
        status: 'available',
        credential: {
          accessToken: 'synthetic',
          expiresAtEpochMs: Date.now() + 1000,
        },
      }),
      eligibility: { check: async () => 'eligible' },
      onError: (issue) => codes.push(issue.code),
    })
    transport.connect()
    await flush()
    socket.trigger('realtime.event', readyEvent())
    const command = createMessageCommand(conversationId, 'First')
    expect(await transport.sendMessage(conversationId, command)).toBe('sent')
    expect(
      transport.retry({
        ...command,
        sentAt: new Date(Date.now() + 1000).toISOString(),
      }),
    ).toBe('conflict')

    const ack = {
      schemaVersion: 1,
      commandId: command.commandId,
      correlationId: command.correlationId,
      status: 'accepted',
      acknowledgedAt: new Date().toISOString(),
    }
    socket.acknowledgement?.(ack)
    socket.acknowledgement?.({
      ...ack,
      status: 'duplicate',
      messageId: accountId,
    })
    expect(codes).toEqual(['DUPLICATE_CONFLICT', 'DUPLICATE_CONFLICT'])
  })

  it('uses bounded reconnect, resubscribe, explicit history recovery, and cleans up', async () => {
    vi.useFakeTimers()
    const sockets: FakeSocket[] = []
    const states: ConnectionState[] = []
    const recover = vi.fn(
      async (_id: string, boundary: { afterEventId?: string }) => ({
        status: 'recovered' as const,
        boundary,
        count: 1,
      }),
    )
    const transport = new RealtimeTransport({
      socketFactory: () => {
        const socket = new FakeSocket()
        sockets.push(socket)
        return socket
      },
      credentialProvider: async () => ({
        status: 'available',
        credential: {
          accessToken: 'synthetic',
          expiresAtEpochMs: Date.now() + 60_000,
        },
      }),
      eligibility: { check: async () => 'eligible' },
      history: { recover },
      random: () => 0,
      baseReconnectDelayMs: 100,
      maxReconnectDelayMs: 100,
      maxReconnectAttempts: 2,
      onState: (state) => states.push(state),
    })
    transport.connect()
    await flush()
    sockets[0].trigger('realtime.event', readyEvent())
    await transport.subscribe(
      conversationId,
      createSubscribeCommand(conversationId),
    )
    sockets[0].trigger('realtime.event', messageEvent())
    sockets[0].trigger('disconnect')
    expect(transport.getState()).toMatchObject({
      phase: 'reconnecting',
      reconnectAttempt: 1,
    })
    expect(sockets[0].listenerCount()).toBe(0)

    await vi.advanceTimersByTimeAsync(50)
    await flush()
    expect(sockets).toHaveLength(2)
    sockets[1].trigger('realtime.event', readyEvent())
    await flush()
    expect(sockets[1].sent).toHaveLength(1)
    expect(recover).toHaveBeenCalledWith(
      conversationId,
      expect.objectContaining({ afterEventId: expect.any(String) }),
    )
    expect(transport.getState()).toMatchObject({
      phase: 'ready',
      recovery: 'recovered',
    })

    transport.stop()
    expect(sockets[1].listenerCount()).toBe(0)
    expect(sockets[1].disconnectCalls).toBe(1)
    expect(states.at(-1)?.phase).toBe('stopped')
  })

  it('pauses offline, stops on expiry, and exposes rate/dependency failures without reconnect loops', async () => {
    const socket = new FakeSocket()
    const codes: string[] = []
    const transport = new RealtimeTransport({
      socketFactory: () => socket,
      credentialProvider: async () => ({
        status: 'available',
        credential: {
          accessToken: 'synthetic',
          expiresAtEpochMs: Date.now() + 1000,
        },
      }),
      eligibility: { check: async () => 'eligible' },
      onError: (issue) => codes.push(issue.code),
    })
    transport.connect()
    await flush()
    socket.trigger('realtime.event', readyEvent())
    for (const code of ['RATE_LIMITED', 'DEPENDENCY_UNAVAILABLE'] as const) {
      socket.trigger('realtime.error', {
        schemaVersion: 1,
        correlationId: 'synthetic',
        code,
        message: code,
        retryable: true,
      })
      expect(transport.getState().phase).toBe('degraded')
    }
    socket.trigger('realtime.error', {
      schemaVersion: 1,
      correlationId: 'synthetic',
      code: 'AUTHENTICATION_EXPIRED',
      message: 'Expired',
      retryable: false,
    })
    expect(transport.getState().phase).toBe('authentication-expired')
    expect(socket.listenerCount()).toBe(0)
    expect(codes).toEqual([
      'RATE_LIMITED',
      'DEPENDENCY_UNAVAILABLE',
      'AUTHENTICATION_EXPIRED',
    ])

    const offline = new RealtimeTransport({
      socketFactory: () => {
        throw new Error('must not construct while offline')
      },
      credentialProvider: async () => {
        throw new Error('must not request while offline')
      },
      online: () => false,
    })
    offline.connect()
    await flush()
    expect(offline.getState()).toMatchObject({
      phase: 'disconnected',
      issue: { code: 'OFFLINE' },
    })
  })

  it('fails closed when eligibility, history, or production browser authentication is unavailable', async () => {
    const socket = new FakeSocket()
    const transport = new RealtimeTransport({
      socketFactory: () => socket,
      credentialProvider: async () => ({
        status: 'available',
        credential: {
          accessToken: 'synthetic',
          expiresAtEpochMs: Date.now() + 1000,
        },
      }),
    })
    transport.connect()
    await flush()
    socket.trigger('realtime.event', readyEvent())
    expect(
      await transport.sendMessage(
        conversationId,
        createMessageCommand(conversationId, 'Blocked'),
      ),
    ).toBe('unavailable')
    expect(transport.getState().issue?.code).toBe(
      'CHAT_ELIGIBILITY_UNAVAILABLE',
    )

    const boundary = createProductionRealtimeBoundary({
      kind: 'unavailable',
      reason: 'No approved credential strategy.',
    })
    expect(boundary.status).toBe('fail-closed')
    if (boundary.status !== 'fail-closed')
      throw new Error('Expected fail-closed production boundary')
    expect(() => boundary.connect()).toThrow('No approved credential strategy.')
  })

  it('keeps planned history visible as a non-success recovery state', async () => {
    vi.useFakeTimers()
    const sockets: FakeSocket[] = []
    const transport = new RealtimeTransport({
      socketFactory: () => {
        const socket = new FakeSocket()
        sockets.push(socket)
        return socket
      },
      credentialProvider: async () => ({
        status: 'available',
        credential: {
          accessToken: 'synthetic',
          expiresAtEpochMs: Date.now() + 60_000,
        },
      }),
      eligibility: { check: async () => 'eligible' },
      random: () => 0,
      baseReconnectDelayMs: 10,
    })
    transport.connect()
    await flush()
    sockets[0].trigger('realtime.event', readyEvent())
    await transport.subscribe(
      conversationId,
      createSubscribeCommand(conversationId),
    )
    sockets[0].trigger('disconnect')
    await vi.advanceTimersByTimeAsync(5)
    await flush()
    sockets[1].trigger('realtime.event', readyEvent())
    await flush()
    expect(transport.getState()).toMatchObject({
      phase: 'degraded',
      recovery: 'history-unavailable',
      issue: { code: 'DEPENDENCY_UNAVAILABLE' },
    })
    transport.stop()
  })

  it('rejects malformed frames and removes listeners during deliberate cleanup', async () => {
    const socket = new FakeSocket()
    const transport = new RealtimeTransport({
      socketFactory: () => socket,
      credentialProvider: async () => ({
        status: 'available',
        credential: {
          accessToken: 'synthetic',
          expiresAtEpochMs: Date.now() + 1000,
        },
      }),
    })
    transport.connect()
    await flush()
    socket.trigger('realtime.event', '{broken')
    expect(transport.getState()).toMatchObject({
      phase: 'degraded',
      issue: { code: 'MALFORMED_FRAME' },
    })
    transport.stop()
    expect(socket.listenerCount()).toBe(0)
  })
})
