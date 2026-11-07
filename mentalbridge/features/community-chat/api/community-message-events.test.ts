import { describe, expect, it } from 'vitest'
import { parseCommunityMessageEvent } from './community-message-events'

const id = '10000000-0000-4000-8000-000000000001'
const message = {
  messageId: id,
  conversationId: id,
  clientMessageId: id,
  sender: {
    state: 'AVAILABLE',
    communityProfileId: id,
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

describe('Community message events', () => {
  it('reads only an owner-projected validated message', () => {
    expect(parseCommunityMessageEvent(frame)).toEqual({
      kind: 'message',
      message,
    })
    expect(
      parseCommunityMessageEvent({
        ...frame,
        payload: {
          message: {
            ...message,
            sender: { state: 'AVAILABLE', accountSubject: id },
          },
        },
      }),
    ).toBeNull()
    expect(parseCommunityMessageEvent({ ...frame, sequence: 20 })).toBeNull()
  })
  it('binds invalidation and resync events to the exact conversation', () => {
    expect(
      parseCommunityMessageEvent({
        ...frame,
        eventType: 'community.conversation.invalidated',
        payload: { conversationId: id },
      }),
    ).toEqual({ kind: 'invalidate', conversationId: id })
    expect(
      parseCommunityMessageEvent({
        ...frame,
        eventType: 'community.resync.required',
        payload: { conversationId: 'wrong' },
      }),
    ).toBeNull()
  })
})
