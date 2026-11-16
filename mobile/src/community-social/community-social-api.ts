import type { AxiosInstance } from 'axios'
import { z } from 'zod'

import { ApiError } from '@/api/api-error'

import {
  circleDetailSchema,
  circleEntryPageSchema,
  circleEntrySchema,
  circleKeySchema,
  circlePageSchema,
  circleSchema,
  createCircleSchema,
  decisionSchema,
  friendshipPageSchema,
  friendshipSchema,
  friendViewSchema,
  inviteSchema,
  memberPageSchema,
  memberProfileSchema,
  searchTermSchema,
  writeEntrySchema,
  type Circle,
  type CircleDecision,
  type CircleDetail,
  type CircleEntry,
  type CircleEntryPage,
  type CirclePage,
  type CreateCircle,
  type FriendshipPage,
  type FriendView,
  type Friendship,
  type MemberPage,
  type MemberProfile,
} from './community-social-contract'

export interface CommunitySocialApi {
  friends(view: FriendView, cursor?: string): Promise<FriendshipPage>
  searchMembers(term: string, cursor?: string): Promise<MemberPage>
  member(profileId: string, cursor?: string): Promise<MemberProfile>
  requestFriend(profileId: string): Promise<Friendship>
  acceptFriend(friendshipId: string): Promise<Friendship>
  removeFriend(friendshipId: string): Promise<void>
  circles(cursor?: string): Promise<CirclePage>
  circle(circleId: string): Promise<CircleDetail>
  createCircle(body: CreateCircle, key: string): Promise<Circle>
  archiveCircle(circleId: string): Promise<void>
  invite(circleId: string, profileId: string): Promise<void>
  decide(circleId: string, decision: CircleDecision): Promise<void>
  removeMember(circleId: string, profileId: string): Promise<void>
  entries(circleId: string, cursor?: string): Promise<CircleEntryPage>
  publish(circleId: string, text: string, key: string): Promise<CircleEntry>
  deleteEntry(circleId: string, entryId: string): Promise<void>
  comments(
    circleId: string,
    entryId: string,
    cursor?: string,
  ): Promise<CircleEntryPage>
  comment(
    circleId: string,
    entryId: string,
    text: string,
    key: string,
  ): Promise<CircleEntry>
  deleteComment(circleId: string, commentId: string): Promise<void>
}

const root = '/api/v1/community'
const pathId = (value: string) => encodeURIComponent(z.uuid().parse(value))
const cursorId = z.uuid()
const feedCursor = z.string().min(1).max(256)
// The provider answers with a different object than the one asked for: never show it.
function mismatch(): never {
  throw new ApiError({
    code: 'COMMUNITY_CONTRACT_MISMATCH',
    message: 'Community identity mismatch.',
    status: 502,
  })
}

export function createCommunitySocialApi(
  client: AxiosInstance,
): CommunitySocialApi {
  const command = (key: string) => ({
    headers: { 'Idempotency-Key': circleKeySchema.parse(key) },
  })
  const page = (limit: number, cursor: string | undefined) => ({
    limit,
    ...(cursor ? { cursor: cursorId.parse(cursor) } : {}),
  })
  return {
    async friends(view, cursor) {
      return friendshipPageSchema.parse(
        (
          await client.get(`${root}/chat/friends`, {
            params: { view: friendViewSchema.parse(view), ...page(30, cursor) },
          })
        ).data,
      )
    },
    async searchMembers(term, cursor) {
      return memberPageSchema.parse(
        (
          await client.get(`${root}/members`, {
            params: { q: searchTermSchema.parse(term), ...page(20, cursor) },
          })
        ).data,
      )
    },
    async member(profileId, cursor) {
      const result = memberProfileSchema.parse(
        (
          await client.get(`${root}/members/${pathId(profileId)}`, {
            params: {
              limit: 12,
              ...(cursor ? { cursor: feedCursor.parse(cursor) } : {}),
            },
          })
        ).data,
      )
      if (result.member.communityProfileId !== profileId) mismatch()
      return result
    },
    async requestFriend(profileId) {
      const result = friendshipSchema.parse(
        (await client.put(`${root}/chat/friends/${pathId(profileId)}`, {}))
          .data,
      )
      if (result.peer.communityProfileId !== profileId) mismatch()
      return result
    },
    async acceptFriend(friendshipId) {
      const result = friendshipSchema.parse(
        (
          await client.post(
            `${root}/chat/friendships/${pathId(friendshipId)}/accept`,
            {},
          )
        ).data,
      )
      if (result.friendshipId !== friendshipId) mismatch()
      return result
    },
    async removeFriend(friendshipId) {
      await client.delete(`${root}/chat/friendships/${pathId(friendshipId)}`)
    },
    async circles(cursor) {
      return circlePageSchema.parse(
        (await client.get(`${root}/circles`, { params: page(10, cursor) }))
          .data,
      )
    },
    async circle(circleId) {
      const result = circleDetailSchema.parse(
        (await client.get(`${root}/circles/${pathId(circleId)}`)).data,
      )
      if (result.group.id !== circleId) mismatch()
      return result
    },
    async createCircle(body, key) {
      return circleSchema.parse(
        (
          await client.post(
            `${root}/circles`,
            createCircleSchema.parse(body),
            command(key),
          )
        ).data,
      )
    },
    async archiveCircle(circleId) {
      await client.delete(`${root}/circles/${pathId(circleId)}`)
    },
    async invite(circleId, profileId) {
      await client.post(
        `${root}/circles/${pathId(circleId)}/invitations`,
        inviteSchema.parse({ profileId }),
      )
    },
    async decide(circleId, decision) {
      await client.post(
        `${root}/circles/${pathId(circleId)}/decision`,
        decisionSchema.parse({ decision }),
      )
    },
    async removeMember(circleId, profileId) {
      await client.delete(
        `${root}/circles/${pathId(circleId)}/members/${pathId(profileId)}`,
      )
    },
    async entries(circleId, cursor) {
      return circleEntryPageSchema.parse(
        (
          await client.get(`${root}/circles/${pathId(circleId)}/posts`, {
            params: page(10, cursor),
          })
        ).data,
      )
    },
    async publish(circleId, text, key) {
      return circleEntrySchema.parse(
        (
          await client.post(
            `${root}/circles/${pathId(circleId)}/posts`,
            writeEntrySchema.parse({ text }),
            command(key),
          )
        ).data,
      )
    },
    async deleteEntry(circleId, entryId) {
      await client.delete(
        `${root}/circles/${pathId(circleId)}/posts/${pathId(entryId)}`,
      )
    },
    async comments(circleId, entryId, cursor) {
      return circleEntryPageSchema.parse(
        (
          await client.get(
            `${root}/circles/${pathId(circleId)}/posts/${pathId(entryId)}/comments`,
            { params: page(10, cursor) },
          )
        ).data,
      )
    },
    async comment(circleId, entryId, text, key) {
      return circleEntrySchema.parse(
        (
          await client.post(
            `${root}/circles/${pathId(circleId)}/posts/${pathId(entryId)}/comments`,
            writeEntrySchema.parse({ text }),
            command(key),
          )
        ).data,
      )
    },
    async deleteComment(circleId, commentId) {
      await client.delete(
        `${root}/circles/${pathId(circleId)}/comments/${pathId(commentId)}`,
      )
    },
  }
}
