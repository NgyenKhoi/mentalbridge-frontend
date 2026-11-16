import { z } from 'zod'

import {
  authorSchema,
  feedPageSchema,
  type CommunitySummary,
} from '@/community/community-contract'

// Mirrors contracts/openapi/community-social-v1.json and community-circles-v1.json (backend origin/dev).
const id = z.uuid()
const time = z.iso.datetime({ offset: true })
const cursor = id.nullable()
const length = (minimum: number, maximum: number) =>
  z.string().refine((value) => {
    const size = [...value].length
    return size >= minimum && size <= maximum
  })
const unique = <T>(values: T[]) => new Set(values).size === values.length

type Author = z.infer<typeof authorSchema>
export type MemberIdentity = Author & {
  state: 'ACTIVE'
  communityProfileId: string
}
export const memberIdentitySchema = authorSchema.refine(
  (author): author is MemberIdentity =>
    author.state === 'ACTIVE' && author.communityProfileId !== null,
)

export const friendViewSchema = z.enum(['accepted', 'incoming', 'outgoing'])
export type FriendView = z.infer<typeof friendViewSchema>

export const friendshipStateSchema = z
  .strictObject({
    state: z.enum(['SELF', 'NONE', 'OUTGOING', 'INCOMING', 'FRIENDS']),
    friendshipId: id.nullable(),
  })
  .refine((value) =>
    ['SELF', 'NONE'].includes(value.state)
      ? value.friendshipId === null
      : value.friendshipId !== null,
  )
export type FriendshipState = z.infer<typeof friendshipStateSchema>

export const friendshipSchema = z.strictObject({
  friendshipId: id,
  peer: memberIdentitySchema,
  state: z.enum(['OUTGOING', 'INCOMING', 'FRIENDS']),
  createdAt: time,
})
export type Friendship = z.infer<typeof friendshipSchema>
export const friendshipPageSchema = z.strictObject({
  items: z.array(friendshipSchema).max(50),
  nextCursor: cursor,
})
export type FriendshipPage = z.infer<typeof friendshipPageSchema>

export const memberPageSchema = z.strictObject({
  items: z.array(memberIdentitySchema).max(50),
  nextCursor: cursor,
})
export type MemberPage = z.infer<typeof memberPageSchema>

export const memberProfileSchema = z.strictObject({
  member: memberIdentitySchema,
  friendship: friendshipStateSchema,
  posts: feedPageSchema,
})
export type MemberProfile = z.infer<typeof memberProfileSchema>
export type MemberPost = CommunitySummary

export const searchTermSchema = z
  .string()
  .refine((value) => [...value].length >= 2 && [...value].length <= 80)

export const circleSchema = z.strictObject({
  id,
  name: length(1, 80),
  description: length(0, 500),
  membership: z.enum(['ACTIVE', 'PENDING']),
  role: z.enum(['OWNER', 'MEMBER']),
  memberCount: z.number().int().min(1),
  createdAt: time,
})
export type Circle = z.infer<typeof circleSchema>
export const circlePageSchema = z.strictObject({
  items: z.array(circleSchema).max(10),
  nextCursor: cursor,
})
export type CirclePage = z.infer<typeof circlePageSchema>

export const circleDetailSchema = z.strictObject({
  group: circleSchema,
  members: z
    .array(
      z.strictObject({
        profile: authorSchema,
        role: z.enum(['OWNER', 'MEMBER']),
        joinedAt: time,
      }),
    )
    .max(50),
})
export type CircleDetail = z.infer<typeof circleDetailSchema>

export const circleEntrySchema = z.strictObject({
  id,
  author: authorSchema.nullable(),
  text: length(1, 5000),
  createdAt: time,
  canDelete: z.boolean(),
})
export type CircleEntry = z.infer<typeof circleEntrySchema>
export const circleEntryPageSchema = z.strictObject({
  items: z.array(circleEntrySchema).max(10),
  nextCursor: cursor,
})
export type CircleEntryPage = z.infer<typeof circleEntryPageSchema>

export const createCircleSchema = z.strictObject({
  name: length(1, 80).refine((value) => Boolean(value.trim())),
  description: length(0, 500),
  invitees: z.array(id).max(19).refine(unique),
})
export type CreateCircle = z.infer<typeof createCircleSchema>
export const writeEntrySchema = z.strictObject({
  text: length(1, 5000).refine((value) => Boolean(value.trim())),
})
export const inviteSchema = z.strictObject({ profileId: id })
export const decisionSchema = z.strictObject({
  decision: z.enum(['ACCEPT', 'DECLINE']),
})
export type CircleDecision = z.infer<typeof decisionSchema>['decision']
// Circle writes take a UUID Idempotency-Key.
export const circleKeySchema = id
