import { browserApiClient } from '@/lib/api/browser-client'
import type {
  Friendship,
  FriendshipPage,
  MemberPage,
  MemberProfile,
} from './community-social'

const root = '/community/social'

export async function getFriends(view = 'accepted', cursor?: string) {
  return (
    await browserApiClient.get<FriendshipPage>(`${root}/friends`, {
      params: { view, limit: 30, ...(cursor ? { cursor } : {}) },
    })
  ).data
}

export async function requestFriend(profileId: string) {
  return (
    await browserApiClient.put<Friendship>(
      `${root}/friends/${encodeURIComponent(profileId)}`,
      {},
    )
  ).data
}

export async function acceptFriend(friendshipId: string) {
  return (
    await browserApiClient.post<Friendship>(
      `${root}/friendships/${encodeURIComponent(friendshipId)}/accept`,
      {},
    )
  ).data
}

export async function removeFriend(friendshipId: string) {
  await browserApiClient.delete(
    `${root}/friendships/${encodeURIComponent(friendshipId)}`,
  )
}

export async function searchMembers(q: string, cursor?: string) {
  return (
    await browserApiClient.get<MemberPage>(`${root}/members`, {
      params: { q, limit: 20, ...(cursor ? { cursor } : {}) },
    })
  ).data
}

export async function getMember(profileId: string, cursor?: string) {
  return (
    await browserApiClient.get<MemberProfile>(
      `${root}/members/${encodeURIComponent(profileId)}`,
      { params: { limit: 12, ...(cursor ? { cursor } : {}) } },
    )
  ).data
}
