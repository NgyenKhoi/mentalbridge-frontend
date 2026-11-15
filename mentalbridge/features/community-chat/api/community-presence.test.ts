import { describe, expect, it } from 'vitest'
import {
  parseCommunityCredential,
  parsePresenceEvent,
} from './community-presence'

const profileId = '10000000-0000-4000-8000-000000000002'
const frame = {
  schemaVersion: 1,
  eventId: '10000000-0000-4000-8000-000000000003',
  correlationId: '10000000-0000-4000-8000-000000000004',
  occurredAt: '2026-11-03T10:00:00Z',
  eventType: 'community.presence.changed',
  payload: { communityProfileId: profileId, state: 'ONLINE' },
}

describe('Community presence boundary', () => {
  it('accepts only the isolated Community credential, never the Identity bearer shape', () => {
    const credential = {
      schemaVersion: 1,
      namespace: '/community',
      credential: 'x'.repeat(48),
      expiresAt: '2099-11-03T10:00:00Z',
    }
    expect(parseCommunityCredential(credential)).toEqual(credential)
    expect(
      parseCommunityCredential({ ...credential, namespace: '/realtime' }),
    ).toBeNull()
    expect(
      parseCommunityCredential({ ...credential, accessToken: 'private' }),
    ).toBeNull()
    expect(
      parseCommunityCredential({ ...credential, credential: 'short' }),
    ).toBeNull()
  })
  it('reads an authoritative state but rejects routing IDs, extra fields and made-up statuses', () => {
    expect(parsePresenceEvent(frame)).toEqual({
      kind: 'presence',
      profileId,
      state: 'ONLINE',
    })
    expect(
      parsePresenceEvent({
        ...frame,
        payload: { ...frame.payload, subjectRoutingReference: profileId },
      }),
    ).toBeNull()
    expect(
      parsePresenceEvent({
        ...frame,
        payload: { ...frame.payload, state: 'ACTIVE' },
      }),
    ).toBeNull()
    expect(parsePresenceEvent({ ...frame, accountId: profileId })).toBeNull()
    expect(parsePresenceEvent({ ...frame, eventId: 'invalid' })).toBeNull()
  })
})
