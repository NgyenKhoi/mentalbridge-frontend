import { UUID_PATTERN } from './community-chat-contract'

export type PresenceState = 'ONLINE' | 'OFFLINE' | 'UNKNOWN'
export type CommunityCredential = {
  schemaVersion: 1
  namespace: '/community'
  credential: string
  expiresAt: string
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
export function isCommunityCommandAccepted(
  value: unknown,
  commandId: string,
): boolean {
  return (
    record(value) &&
    value.schemaVersion === 1 &&
    value.eventType === 'community.command.ack' &&
    record(value.payload) &&
    value.payload.commandId === commandId &&
    value.payload.status === 'ACCEPTED'
  )
}
export function parseCommunityCredential(
  value: unknown,
): CommunityCredential | null {
  if (
    !record(value) ||
    Object.keys(value).length !== 4 ||
    value.schemaVersion !== 1 ||
    value.namespace !== '/community' ||
    typeof value.credential !== 'string' ||
    value.credential.length < 32 ||
    value.credential.length > 512 ||
    typeof value.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(value.expiresAt))
  )
    return null
  return {
    schemaVersion: 1,
    namespace: '/community',
    credential: value.credential,
    expiresAt: value.expiresAt,
  }
}
export function parsePresenceEvent(
  value: unknown,
):
  | { kind: 'presence'; profileId: string; state: PresenceState }
  | { kind: 'invalidated'; conversationId: string }
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
  const payload = value.payload
  if (
    value.eventType === 'community.conversation.invalidated' &&
    Object.keys(payload).length === 1 &&
    typeof payload.conversationId === 'string' &&
    UUID_PATTERN.test(payload.conversationId)
  )
    return { kind: 'invalidated', conversationId: payload.conversationId }
  if (
    value.eventType !== 'community.presence.changed' ||
    Object.keys(payload).length !== 2 ||
    typeof payload.communityProfileId !== 'string' ||
    !UUID_PATTERN.test(payload.communityProfileId) ||
    (payload.state !== 'ONLINE' &&
      payload.state !== 'OFFLINE' &&
      payload.state !== 'UNKNOWN')
  )
    return null
  return {
    kind: 'presence',
    profileId: payload.communityProfileId,
    state: payload.state,
  }
}
