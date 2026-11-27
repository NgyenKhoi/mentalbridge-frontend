import { describe, expect, it } from 'vitest'
import {
  parseFriendship,
  parseFriendshipState,
  parseMemberProfile,
  parseMemberPage,
} from './community-social'

const profileId = '10000000-0000-4000-8000-000000000001'
const friendshipId = '20000000-0000-4000-8000-000000000001'
const member = {
  communityProfileId: profileId,
  displayName: 'Một người bạn',
  avatarPreset: 'LEAF',
  state: 'ACTIVE',
}

describe('Community social boundary', () => {
  it('accepts only current named Community identities', () => {
    expect(
      parseMemberPage({ items: [member], nextCursor: null }),
    ).not.toBeNull()
    expect(
      parseMemberPage({
        items: [{ ...member, state: 'ANONYMOUS', communityProfileId: null }],
        nextCursor: null,
      }),
    ).toBeNull()
    expect(
      parseMemberPage({
        items: [{ ...member, accountSubject: profileId }],
        nextCursor: null,
      }),
    ).toBeNull()
  })
  it('requires an exact request identity for pending and accepted relationships', () => {
    expect(
      parseFriendshipState({ state: 'FRIENDS', friendshipId }),
    ).not.toBeNull()
    expect(
      parseFriendshipState({ state: 'SELF', friendshipId: null }),
    ).not.toBeNull()
    expect(
      parseFriendshipState({ state: 'FRIENDS', friendshipId: null }),
    ).toBeNull()
    expect(parseFriendshipState({ state: 'NONE', friendshipId })).toBeNull()
  })
  it('validates friendship data without accepting anonymous peer selectors', () => {
    const value = {
      friendshipId,
      peer: member,
      state: 'INCOMING',
      createdAt: '2026-11-06T12:00:00Z',
    }
    expect(parseFriendship(value)).not.toBeNull()
    expect(
      parseFriendship({
        ...value,
        peer: { ...member, communityProfileId: null },
      }),
    ).toBeNull()
    expect(
      parseFriendship({ ...value, state: 'ACCEPTED_BY_CLIENT' }),
    ).toBeNull()
  })
  it('requires a member page to bind posts to that named author', () => {
    expect(
      parseMemberProfile({
        member,
        friendship: { state: 'NONE', friendshipId: null },
        posts: { items: [], nextCursor: null, hasMore: false },
      }),
    ).not.toBeNull()
    expect(
      parseMemberProfile({
        member: { ...member, state: 'ANONYMOUS', communityProfileId: null },
        friendship: { state: 'NONE', friendshipId: null },
        posts: { items: [], nextCursor: null, hasMore: false },
      }),
    ).toBeNull()
  })
})
