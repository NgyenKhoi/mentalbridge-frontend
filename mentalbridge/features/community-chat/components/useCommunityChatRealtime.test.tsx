import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ post: vi.fn(), io: vi.fn() }))
vi.mock('@/lib/api/browser-client', () => ({
  browserApiClient: { post: api.post },
}))
vi.mock('socket.io-client', () => ({ io: api.io }))

import { useCommunityChatRealtime } from './useCommunityChatRealtime'

const id = '10000000-0000-4000-8000-000000000001'
const other = '10000000-0000-4000-8000-000000000002'
const message = {
  messageId: id,
  conversationId: id,
  clientMessageId: id,
  sender: {
    state: 'AVAILABLE',
    communityProfileId: other,
    displayName: 'Người bạn',
  },
  state: 'ACTIVE',
  content: 'Chào bạn',
  createdAt: '2026-11-06T12:00:00Z',
}
const frame = {
  schemaVersion: 1,
  eventId: id,
  correlationId: id,
  occurredAt: '2026-11-06T12:00:00Z',
  eventType: 'community.message.created',
  payload: { message },
}

describe('Community live conversation', () => {
  const handlers = new Map<string, (...args: unknown[]) => void>()
  const onMessage = vi.fn(),
    onResync = vi.fn(),
    onInvalidated = vi.fn()
  const socket = {
    connected: false,
    on: vi.fn((name: string, callback: (...args: unknown[]) => void) => {
      handlers.set(name, callback)
      return socket
    }),
    timeout: vi.fn(() => socket),
    emit: vi.fn(
      (
        _name: string,
        command: { commandId: string },
        callback: (error: null, value: unknown) => void,
      ) => {
        callback(null, {
          schemaVersion: 1,
          eventType: 'community.command.ack',
          payload: { commandId: command.commandId, status: 'ACCEPTED' },
        })
      },
    ),
    connect: vi.fn(() => {
      socket.connected = true
      handlers.get('connect')?.()
      return socket
    }),
    disconnect: vi.fn(() => {
      socket.connected = false
      handlers.get('disconnect')?.()
      return socket
    }),
    removeAllListeners: vi.fn(() => {
      handlers.clear()
      return socket
    }),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    handlers.clear()
    socket.connected = false
    api.post.mockResolvedValue({
      data: {
        schemaVersion: 1,
        namespace: '/community',
        credential: 'synthetic-one-use-credential-long-enough',
        expiresAt: '2030-01-01T00:00:00Z',
        endpoint: 'http://localhost:3004',
      },
    })
    api.io.mockReturnValue(socket)
  })

  it('subscribes only to the selected conversation and rejects foreign or malformed messages', async () => {
    const hook = renderHook(() =>
      useCommunityChatRealtime(id, onMessage, onResync, onInvalidated),
    )
    await waitFor(() => expect(hook.result.current).toBe('ready'))
    expect(onResync).toHaveBeenCalledOnce()
    act(() => handlers.get('community.event')?.(frame))
    expect(onMessage).toHaveBeenCalledWith(message)
    act(() =>
      handlers.get('community.event')?.({
        ...frame,
        payload: { message: { ...message, conversationId: other } },
      }),
    )
    act(() =>
      handlers.get('community.event')?.({
        ...frame,
        payload: { message: { ...message, sender: { accountSubject: other } } },
      }),
    )
    expect(onMessage).toHaveBeenCalledOnce()
    hook.unmount()
    expect(socket.disconnect).toHaveBeenCalled()
  })

  it('discards a revoked conversation before reconnecting and cleans up pending retries', async () => {
    const hook = renderHook(() =>
      useCommunityChatRealtime(id, onMessage, onResync, onInvalidated),
    )
    await waitFor(() => expect(hook.result.current).toBe('ready'))
    act(() =>
      handlers.get('community.event')?.({
        ...frame,
        eventType: 'community.conversation.invalidated',
        payload: { conversationId: id },
      }),
    )
    expect(onInvalidated).toHaveBeenCalledOnce()
    expect(hook.result.current).toBe('unavailable')
    hook.unmount()
    expect(handlers.size).toBe(0)
  })
})
