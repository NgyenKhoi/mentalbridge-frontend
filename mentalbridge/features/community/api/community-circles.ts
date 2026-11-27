import { z } from 'zod'
import type { components } from '@/contracts/community.generated'
import { parseAuthor } from '@/lib/community/community-validation'

export type Circle = components['schemas']['CommunityCircle']
export type CircleDetail = components['schemas']['CommunityCircleDetail']
export type CircleEntry = components['schemas']['CommunityCircleEntry']
export type CirclePage = components['schemas']['CommunityCirclePage']
export type EntryPage = components['schemas']['CommunityCircleEntryPage']
const id = z.string().uuid()
const author = z.unknown().transform((value, ctx) => {
  const parsed = parseAuthor(value)
  if (!parsed) {
    ctx.addIssue({ code: 'custom', message: 'Invalid community identity' })
    return z.NEVER
  }
  return parsed
})
export const circleSchema = z.object({
  id,
  name: z.string().min(1).max(80),
  description: z.string().max(500),
  membership: z.enum(['ACTIVE', 'PENDING']),
  role: z.enum(['OWNER', 'MEMBER']),
  memberCount: z.number().int().min(1).max(50),
  createdAt: z.string().datetime(),
})
export const circleDetailSchema = z.object({
  group: circleSchema,
  members: z
    .array(
      z.object({
        profile: author,
        role: z.enum(['OWNER', 'MEMBER']),
        joinedAt: z.string().datetime(),
      }),
    )
    .max(50),
})
export const circleEntrySchema = z.object({
  id,
  author: author.nullable(),
  text: z.string().min(1).max(10000),
  createdAt: z.string().datetime(),
  canDelete: z.boolean(),
})
export const circlePageSchema = z.object({
  items: z.array(circleSchema).max(10),
  nextCursor: id.nullable(),
})
export const entryPageSchema = z.object({
  items: z.array(circleEntrySchema).max(10),
  nextCursor: id.nullable(),
})
export const createCircleSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    description: z.string().max(500),
    invitees: z
      .array(id)
      .max(19)
      .refine((ids) => new Set(ids).size === ids.length),
  })
  .strict()
export const writeCircleSchema = z
  .object({ text: z.string().trim().min(1).max(5000) })
  .strict()
export const inviteCircleSchema = z.object({ profileId: id }).strict()
export const decideCircleSchema = z
  .object({ decision: z.enum(['ACCEPT', 'DECLINE']) })
  .strict()
