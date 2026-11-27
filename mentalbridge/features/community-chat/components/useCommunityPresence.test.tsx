import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  conversations: vi.fn(),
  profile: vi.fn(),
  ticket: vi.fn(),
  factory: vi.fn(),
}))
vi.mock('../api/browser-community-chat', () => ({
  getChatConversations: mocks.conversations,
}))
vi.mock('@/features/community/api/browser-community', () => ({
  getCommunityProfile: mocks.profile,
}))
vi.mock('@/lib/api/browser-client', () => ({
  browserApiClient: { post: mocks.ticket },
}))
vi.mock('socket.io-client', () => ({ io: mocks.factory }))
import { useCommunityPresence } from './useCommunityPresence'

const selfId = '10000000-0000-4000-8000-000000000001'
const peerId = '10000000-0000-4000-8000-000000000002'
const strangerId = '10000000-0000-4000-8000-000000000003'
const conversationId = '20000000-0000-4000-8000-000000000001'
const listeners = new Map<string, (value?: unknown) => void>()
let socket: {
  connected: boolean
  on: ReturnType<typeof vi.fn>
  emit: ReturnType<typeof vi.fn>
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}
const frame = (profileId: string, state: string) => ({
  schemaVersion: 1,
  eventId: crypto.randomUUID(),
  correlationId: crypto.randomUUID(),
  occurredAt: new Date().toISOString(),
  eventType: 'community.presence.changed',
  payload: { communityProfileId: profileId, state },
})

describe('useCommunityPresence consent boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listeners.clear()
    socket = {
      connected: false,
      on: vi.fn((name, callback) => listeners.set(name, callback)),
      emit: vi.fn(),
      connect: vi.fn(() => {
        socket.connected = true
        listeners.get('connect')?.()
      }),
      disconnect: vi.fn(() => {
        socket.connected = false
      }),
    }
    mocks.factory.mockReturnValue(socket)
    mocks.profile.mockResolvedValue({ data: { communityProfileId: selfId } })
    mocks.conversations.mockResolvedValue({
      items: [
        {
          conversationId,
          kind: 'DIRECT',
          state: 'ACTIVE',
          peers: [
            {
              state: 'AVAILABLE',
              communityProfileId: selfId,
              displayName: 'Tôi',
            },
            {
              state: 'AVAILABLE',
              communityProfileId: peerId,
              displayName: 'Lá Nhỏ',
            },
          ],
        },
      ],
      nextCursor: null,
    })
    mocks.ticket.mockResolvedValue({
      data: {
        schemaVersion: 1,
        namespace: '/community',
        credential: 'x'.repeat(48),
        expiresAt: new Date(Date.now() + 30_000).toISOString(),
        endpoint: 'https://chat.example.test/',
      },
    })
  })
  it('subscribes to existing direct conversations and displays only owner-projected contacts', async () => {
    const { result, unmount } = renderHook(() => useCommunityPresence())
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    expect(socket.emit).toHaveBeenCalledWith(
      'community.command',
      expect.objectContaining({
        commandType: 'community.conversation.subscribe',
        payload: { conversationId },
      }),
      expect.any(Function),
    )
    expect(mocks.factory.mock.calls[0][1].auth).not.toHaveProperty(
      'accessToken',
    )
    act(() => listeners.get('community.event')?.(frame(strangerId, 'ONLINE')))
    expect(result.current.states).toEqual({})
    act(() => listeners.get('community.event')?.(frame(peerId, 'ONLINE')))
    expect(result.current.states[peerId]).toBe('ONLINE')
    act(() => listeners.get('community.event')?.(frame(peerId, 'UNKNOWN')))
    expect(result.current.states[peerId]).toBe('UNKNOWN')
    unmount()
    expect(socket.disconnect).toHaveBeenCalled()
  })
  it('discards every badge on disconnect and uses a fresh credential on explicit reconnect', async () => {
    const { result } = renderHook(() => useCommunityPresence())
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    act(() => listeners.get('community.event')?.(frame(peerId, 'ONLINE')))
    act(() => {
      socket.connected = false
      listeners.get('disconnect')?.()
    })
    expect(result.current.states).toEqual({})
    act(() => result.current.reconnect())
    await waitFor(() => expect(mocks.ticket).toHaveBeenCalledTimes(2))
  })
  it('removes status immediately when the conversation authorization is invalidated', async () => {
    const { result } = renderHook(() => useCommunityPresence())
    await waitFor(() => expect(result.current.phase).toBe('ready'))
    act(() => listeners.get('community.event')?.(frame(peerId, 'ONLINE')))
    act(() =>
      listeners.get('community.event')?.({
        ...frame(peerId, 'ONLINE'),
        eventType: 'community.conversation.invalidated',
        payload: { conversationId },
      }),
    )
    expect(result.current.phase).toBe('unavailable')
    expect(result.current.states).toEqual({})
    expect(socket.disconnect).toHaveBeenCalled()
  })
  it('keeps the feature unavailable without opening a socket when chat is disabled', async () => {
    mocks.conversations.mockRejectedValue(new Error('disabled'))
    const { result } = renderHook(() => useCommunityPresence())
    await waitFor(() => expect(result.current.phase).toBe('unavailable'))
    expect(mocks.ticket).not.toHaveBeenCalled()
    expect(mocks.factory).not.toHaveBeenCalled()
  })
})
