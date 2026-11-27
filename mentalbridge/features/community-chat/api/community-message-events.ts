import {
  parseChatMessage,
  UUID_PATTERN,
  type ChatMessage,
} from './community-chat-contract'

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function parseCommunityMessageEvent(
  value: unknown,
):
  | { kind: 'message'; message: ChatMessage }
  | { kind: 'invalidate' | 'resync'; conversationId: string }
  | null {
  if (
    !record(value) ||
    Object.keys(value).length !== 6 ||
    value.schemaVersion !== 1 ||
    typeof value.eventId !== 'string' ||
    !UUID_PATTERN.test(value.eventId) ||
    typeof value.correlationId !== 'string' ||
    !UUID_PATTERN.test(value.correlationId) ||
    typeof value.occurredAt !== 'string' ||
    !Number.isFinite(Date.parse(value.occurredAt)) ||
    !record(value.payload)
  )
    return null
  if (
    (value.eventType === 'community.message.created' ||
      value.eventType === 'community.message.updated') &&
    Object.keys(value.payload).length === 1
  ) {
    const message = parseChatMessage(value.payload.message)
    return message ? { kind: 'message', message } : null
  }
  if (
    (value.eventType === 'community.conversation.invalidated' ||
      value.eventType === 'community.resync.required') &&
    Object.keys(value.payload).length === 1 &&
    typeof value.payload.conversationId === 'string' &&
    UUID_PATTERN.test(value.payload.conversationId)
  )
    return {
      kind:
        value.eventType === 'community.conversation.invalidated'
          ? 'invalidate'
          : 'resync',
      conversationId: value.payload.conversationId,
    }
  return null
}
