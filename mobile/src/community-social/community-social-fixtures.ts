import { fixtureDate, fixtureSummary } from '@/community/community-fixtures'

import type {
  Circle,
  CircleDetail,
  CircleEntry,
  Friendship,
  MemberIdentity,
  MemberProfile,
} from './community-social-contract'

export const peerId = '33333333-3333-4333-8333-333333333333'
export const secondPeerId = '44444444-4444-4444-8444-444444444444'
export const friendshipId = '55555555-5555-4555-8555-555555555555'
export const secondFriendshipId = '66666666-6666-4666-8666-666666666666'
export const circleId = '77777777-7777-4777-8777-777777777777'
export const entryId = '88888888-8888-4888-8888-888888888888'
export const ownProfileId = '22222222-2222-4222-8222-222222222222'

export const peer: MemberIdentity = {
  communityProfileId: peerId,
  displayName: 'Minh An',
  avatarPreset: 'SPROUT',
  state: 'ACTIVE',
}
export const secondPeer: MemberIdentity = {
  communityProfileId: secondPeerId,
  displayName: 'Lan Chi',
  avatarPreset: 'WAVE',
  state: 'ACTIVE',
}
export const friendship = (
  state: Friendship['state'],
  who: MemberIdentity = peer,
  id = friendshipId,
): Friendship => ({
  friendshipId: id,
  peer: who,
  state,
  createdAt: fixtureDate,
})
export const memberProfile = (
  state: MemberProfile['friendship']['state'],
  withId = state === 'NONE' || state === 'SELF' ? null : friendshipId,
): MemberProfile => ({
  member: peer,
  friendship: { state, friendshipId: withId },
  posts: {
    items: [{ ...fixtureSummary, author: peer }],
    nextCursor: null,
    hasMore: false,
  },
})

export const circle = (overrides: Partial<Circle> = {}): Circle => ({
  id: circleId,
  name: 'Buổi sáng dịu nhẹ',
  description: 'Nơi chia sẻ những điều nhỏ.',
  membership: 'ACTIVE',
  role: 'MEMBER',
  memberCount: 3,
  createdAt: fixtureDate,
  ...overrides,
})
export const circleDetail = (
  role: Circle['role'] = 'MEMBER',
): CircleDetail => ({
  group: circle({ role }),
  members: [
    { profile: peer, role: 'OWNER', joinedAt: fixtureDate },
    {
      profile: {
        communityProfileId: ownProfileId,
        displayName: 'Bạn cùng cộng đồng',
        avatarPreset: 'LEAF',
        state: 'ACTIVE',
      },
      role: 'MEMBER',
      joinedAt: fixtureDate,
    },
  ],
})
export const entry = (overrides: Partial<CircleEntry> = {}): CircleEntry => ({
  id: entryId,
  author: peer,
  text: 'Hôm nay mình đi dạo một vòng.',
  createdAt: fixtureDate,
  canDelete: false,
  ...overrides,
})
