import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { subscribeNotificationCreated } from './realtime-notifications'

const credential = vi.hoisted(() => vi.fn())
vi.mock('@/features/appointments/api/chat-browser-client', () => ({
  socketCredential: credential,
}))

type Listener = (...args: unknown[]) => void
const sockets: FakeSocket[] = []
class FakeSocket {
  listeners = new Map<string, Listener>()
  connect = vi.fn()
  disconnect = vi.fn()
  on(event: string, listener: Listener) {
    this.listeners.set(event, listener)
  }
  off() {}
  emit() {}
  fire(event: string, ...args: unknown[]) {
    this.listeners.get(event)?.(...args)
  }
}
const factory = vi.hoisted(() => vi.fn())
vi.mock('@/lib/realtime/socket', () => ({
  createSocketIoFactory: (endpoint: string) => (handshake: unknown) => {
    factory(endpoint, handshake)
    const socket = new FakeSocket()
    sockets.push(socket)
    return socket
  },
}))

const pointer = {
  schemaVersion: 1,
  eventId: 'e',
  eventType: 'notification.created',
  correlationId: 'c',
  occurredAt: '2099-01-01T00:00:00Z',
  payload: { notificationId: 'n-1' },
}

describe('subscribeNotificationCreated', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    sockets.length = 0
    factory.mockClear()
    credential.mockReset().mockResolvedValue({
      accessToken: 'x'.repeat(40),
      expiresAt: '2099-01-01T00:00:00Z',
      endpoint: 'https://rt.test',
    })
  })
  afterEach(() => vi.useRealTimers())

  it('connects with a one-use credential and reports notification pointers', async () => {
    const onCreated = vi.fn()
    subscribeNotificationCreated(onCreated)
    await vi.advanceTimersByTimeAsync(0)

    expect(factory).toHaveBeenCalledWith('https://rt.test', {
      schemaVersion: 1,
      accessToken: 'x'.repeat(40),
    })
    expect(sockets[0].connect).toHaveBeenCalled()
    sockets[0].fire('notification.created', pointer)
    sockets[0].fire('notification.created', { ...pointer, payload: {} })
    sockets[0].fire('notification.created', undefined)
    expect(onCreated).toHaveBeenCalledTimes(1)
    expect(onCreated).toHaveBeenCalledWith('n-1')
  })

  it('reconnects with a fresh credential after a drop and stops on cleanup', async () => {
    const stop = subscribeNotificationCreated(vi.fn())
    await vi.advanceTimersByTimeAsync(0)
    sockets[0].fire('disconnect')
    expect(sockets[0].disconnect).toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(5_000)
    expect(credential).toHaveBeenCalledTimes(2)
    expect(sockets).toHaveLength(2)

    stop()
    expect(sockets[1].disconnect).toHaveBeenCalled()
    sockets[1].fire('disconnect')
    await vi.advanceTimersByTimeAsync(120_000)
    expect(credential).toHaveBeenCalledTimes(2)
  })

  it('backs off silently when no credential can be issued', async () => {
    credential.mockRejectedValue(new Error('forbidden'))
    const stop = subscribeNotificationCreated(vi.fn())
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(5_000)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(credential).toHaveBeenCalledTimes(3)
    expect(sockets).toHaveLength(0)
    stop()
  })
})
