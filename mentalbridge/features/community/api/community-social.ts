import type { components } from '@/contracts/community.generated'
import {
  parseAuthor,
  parseCommunityFeedPage,
  type CommunityFeedPage,
} from '@/lib/community/community-validation'

export type Friendship = components['schemas']['CommunityFriendship']
export type MemberIdentity = components['schemas']['CommunityMemberIdentity']
export type FriendshipState = components['schemas']['CommunityFriendshipState']
export type FriendshipPage = components['schemas']['CommunityFriendshipPage']
export type MemberPage = components['schemas']['CommunityMemberPage']
export type MemberProfile = Omit<
  components['schemas']['CommunityMemberProfile'],
  'posts'
> & { posts: CommunityFeedPage }
export const socialUuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function uuid(value: unknown): value is string {
  return typeof value === 'string' && socialUuid.test(value)
}

function parseMemberIdentity(value: unknown): MemberIdentity | null {
  const author = parseAuthor(value)
  if (!author || author.state !== 'ACTIVE' || !author.communityProfileId)
    return null
  return {
    ...author,
    state: 'ACTIVE',
    communityProfileId: author.communityProfileId,
  }
}

export function parseFriendship(value: unknown): Friendship | null {
  if (!record(value)) return null
  const peer = parseMemberIdentity(value.peer)
  if (
    !uuid(value.friendshipId) ||
    !peer ||
    peer.state !== 'ACTIVE' ||
    !peer.communityProfileId ||
    (value.state !== 'OUTGOING' &&
      value.state !== 'INCOMING' &&
      value.state !== 'FRIENDS') ||
    typeof value.createdAt !== 'string' ||
    !Number.isFinite(Date.parse(value.createdAt))
  )
    return null
  return {
    friendshipId: value.friendshipId,
    peer,
    state: value.state,
    createdAt: value.createdAt,
  }
}

export function parseFriendshipState(value: unknown): FriendshipState | null {
  if (!record(value)) return null
  if (
    (value.state === 'SELF' || value.state === 'NONE') &&
    value.friendshipId === null
  )
    return { state: value.state, friendshipId: null }
  if (
    (value.state === 'INCOMING' ||
      value.state === 'OUTGOING' ||
      value.state === 'FRIENDS') &&
    uuid(value.friendshipId)
  )
    return { state: value.state, friendshipId: value.friendshipId }
  return null
}

export function parseFriendshipPage(value: unknown): FriendshipPage | null {
  if (
    !record(value) ||
    !Array.isArray(value.items) ||
    value.items.length > 50 ||
    (value.nextCursor !== null && !uuid(value.nextCursor))
  )
    return null
  const items = value.items.map(parseFriendship)
  if (items.some((item) => item === null)) return null
  return {
    items: items.filter((item): item is Friendship => item !== null),
    nextCursor: value.nextCursor,
  }
}

export function parseMemberPage(value: unknown): MemberPage | null {
  if (
    !record(value) ||
    !Array.isArray(value.items) ||
    value.items.length > 50 ||
    (value.nextCursor !== null && !uuid(value.nextCursor))
  )
    return null
  const items = value.items.map(parseMemberIdentity)
  if (
    items.some(
      (item) => !item || item.state !== 'ACTIVE' || !item.communityProfileId,
    )
  )
    return null
  return {
    items: items.filter(
      (item): item is NonNullable<typeof item> => item !== null,
    ),
    nextCursor: value.nextCursor,
  }
}

export function parseMemberProfile(value: unknown): MemberProfile | null {
  if (!record(value)) return null
  const member = parseMemberIdentity(value.member)
  const friendship = parseFriendshipState(value.friendship)
  const posts = parseCommunityFeedPage(value.posts)
  if (
    !member ||
    member.state !== 'ACTIVE' ||
    !member.communityProfileId ||
    !friendship ||
    !posts
  )
    return null
  if (
    posts.items.some(
      (post) =>
        post.author.communityProfileId !== member.communityProfileId ||
        post.author.state !== 'ACTIVE',
    )
  )
    return null
  return { member, friendship, posts }
}
