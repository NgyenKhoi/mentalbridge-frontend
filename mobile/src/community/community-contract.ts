import { z } from 'zod'

export const communityContractVersion = '1.10.0'
const id = z.uuid()
const version = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const text = (minimum: number, maximum: number) =>
  z.string().refine((value) => {
    const length = [...value].length
    return length >= minimum && length <= maximum
  })
const nonBlank = (maximum: number) =>
  text(1, maximum).refine((value) => Boolean(value.trim()))
const unique = <T>(values: T[]) => new Set(values).size === values.length
const https = z
  .url()
  .max(2048)
  .refine((value) => {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  })
export const topicSchema = z.enum([
  'MY_STORY',
  'SMALL_MILESTONE',
  'HELPFUL_REFLECTION',
  'PEER_QUESTION',
  'EXPERIENCE_SHARING',
  'HELPFUL_RESOURCE',
])
export const avatarSchema = z.enum([
  'LEAF',
  'SUNRISE',
  'WAVE',
  'LOTUS',
  'CLOUD',
  'SPROUT',
])
export const reactionSchema = z.enum(['SUPPORT', 'RELATE', 'THANK_YOU'])
export const reportReasonSchema = z.enum([
  'HARASSMENT',
  'PRIVACY_OR_DOXXING',
  'MEDICAL_MISINFORMATION',
  'SELF_HARM_OR_CRISIS_CONCERN',
  'SPAM',
  'SEXUAL_OR_VIOLENT_CONTENT',
  'OTHER',
])
export const authorSchema = z
  .strictObject({
    communityProfileId: id.nullable(),
    displayName: text(1, 80),
    avatarPreset: avatarSchema.nullable(),
    state: z.enum(['ACTIVE', 'DELETED', 'ANONYMOUS']),
  })
  .refine((author) =>
    author.state === 'ACTIVE'
      ? author.communityProfileId !== null
      : author.communityProfileId === null && author.avatarPreset === null,
  )
export const mediaSchema = z.strictObject({
  mediaId: id,
  type: z.enum(['IMAGE', 'VIDEO']),
  url: https,
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  durationSeconds: z.number().int().positive().nullable(),
  altText: text(0, 300).nullable(),
})
const postFields = {
  postId: id,
  author: authorSchema,
  topics: z.array(topicSchema).min(1).refine(unique),
  media: z.array(mediaSchema).max(10),
  mediaAvailability: z.enum(['NONE', 'READY', 'PARTIAL', 'UNAVAILABLE']),
  counts: z.strictObject({ comments: version, reactions: version }),
  viewerState: z.strictObject({
    reaction: reactionSchema.nullable(),
    bookmarked: z.boolean(),
  }),
  publishedAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  resourceAttachment: z.strictObject({ resourceId: id }).nullable().optional(),
  sensitiveContentWarning: z.literal('SENSITIVE_CONTENT').nullable().optional(),
}
const safeMedia = (post: { mediaAvailability: string; media: unknown[] }) =>
  !['NONE', 'UNAVAILABLE'].includes(post.mediaAvailability) ||
  post.media.length === 0
export const postSummarySchema = z
  .strictObject({ ...postFields, contentPreview: text(1, 421) })
  .refine(safeMedia)
export const postDetailSchema = z
  .strictObject({ ...postFields, content: text(1, 5000) })
  .refine(safeMedia)
const cursorFields = {
  nextCursor: z.string().min(1).max(256).nullable(),
  hasMore: z.boolean(),
}
const validCursor = (page: { hasMore: boolean; nextCursor: string | null }) =>
  !page.hasMore || page.nextCursor !== null
export const feedPageSchema = z
  .strictObject({
    items: z.array(postSummarySchema).max(50),
    ...cursorFields,
  })
  .refine(validCursor)
export const topicsSchema = z
  .array(
    z.strictObject({
      code: topicSchema,
      label: text(1, 80),
      description: text(1, 240),
    }),
  )
  .refine((topics) => unique(topics.map((topic) => topic.code)))
export const postWriteSchema = z.strictObject({
  content: nonBlank(5000),
  topics: z.array(topicSchema).min(1).max(3).refine(unique),
  mediaIds: z.array(id).max(10).refine(unique),
  authorMode: z.enum(['PROFILE', 'ANONYMOUS']),
  resourceId: id.nullable(),
  sensitiveContentWarning: z.literal('SENSITIVE_CONTENT').nullable(),
})
export const commentSchema = z.strictObject({
  commentId: id,
  postId: id,
  parentCommentId: id.nullable(),
  author: authorSchema,
  content: text(1, 2000),
  state: z.enum([
    'ACTIVE',
    'OWNER_DELETED',
    'MODERATION_HIDDEN',
    'MODERATION_REMOVED',
  ]),
  version,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
})
export const commentPageSchema = z
  .strictObject({
    items: z.array(commentSchema).max(50),
    ...cursorFields,
  })
  .refine(validCursor)
export const commentWriteSchema = z.strictObject({
  content: nonBlank(2000),
  parentCommentId: id.nullable(),
})
export const profileSchema = z.strictObject({
  communityProfileId: id,
  displayName: text(1, 80),
  avatarPreset: avatarSchema.nullable(),
  status: z.enum(['ACTIVE', 'DELETED']),
  version,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
})
export const profileWriteSchema = z.strictObject({
  displayName: nonBlank(80).refine((value) => value === value.trim()),
  avatarPreset: avatarSchema.nullable(),
})
export const reportWriteSchema = z.strictObject({
  targetType: z.enum(['POST', 'COMMENT']),
  targetId: id,
  reason: reportReasonSchema,
  details: text(1, 1000)
    .refine((value) => value === value.trim())
    .nullable(),
})
export const uploadWriteSchema = z
  .strictObject({
    fileName: nonBlank(255).refine(
      (value) => !/[\u0000-\u001f\u007f]/.test(value),
    ),
    mediaType: z.enum(['IMAGE', 'VIDEO']),
    mimeType: z.string(),
    sizeBytes: z.number().int().positive(),
  })
  .refine((file) =>
    file.mediaType === 'IMAGE'
      ? ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimeType) &&
        file.sizeBytes <= 10_485_760
      : ['video/mp4', 'video/webm', 'video/quicktime'].includes(
          file.mimeType,
        ) && file.sizeBytes <= 52_428_800,
  )
export const uploadIntentSchema = z.strictObject({
  mediaId: id,
  state: z.literal('PENDING'),
  version,
  uploadUrl: https.refine((value) =>
    [
      'api.cloudinary.com',
      'api-eu.cloudinary.com',
      'api-ap.cloudinary.com',
    ].includes(new URL(value).hostname),
  ),
  expiresAt: z.iso.datetime({ offset: true }),
  uploadFields: z
    .record(z.string().regex(/^[a-z][a-z0-9_]{0,63}$/), z.string().max(1024))
    .refine(
      (fields) =>
        Object.keys(fields).length >= 1 &&
        Object.keys(fields).length <= 16 &&
        !('file' in fields),
    ),
})
export const mediaRecordSchema = z.strictObject({
  mediaId: id,
  mediaType: z.enum(['IMAGE', 'VIDEO']),
  state: z.enum([
    'PENDING',
    'PROCESSING',
    'READY',
    'REJECTED',
    'DELETED',
    'EXPIRED',
  ]),
  version,
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
})
export const reactionResultSchema = z.strictObject({
  postId: id,
  reaction: reactionSchema,
})
export const etagSchema = z
  .string()
  .regex(/^"(0|[1-9]\d*)"$/)
  .refine((value) => Number.isSafeInteger(Number(value.slice(1, -1))))
export const commandKeySchema = z
  .string()
  .min(16)
  .max(128)
  .regex(/^[\x20-\x7e]+$/)
export type CommunityTopicCode = z.infer<typeof topicSchema>
export type CommunityTopic = z.infer<typeof topicsSchema>[number]
export type CommunityPost = z.infer<typeof postDetailSchema>
export type CommunitySummary = z.infer<typeof postSummarySchema>
export type CommunityPage = z.infer<typeof feedPageSchema>
export type PostWrite = z.infer<typeof postWriteSchema>
export type CommunityComment = z.infer<typeof commentSchema>
export type CommentPage = z.infer<typeof commentPageSchema>
export type CommunityProfile = z.infer<typeof profileSchema>
export type ProfileWrite = z.infer<typeof profileWriteSchema>
export type Reaction = z.infer<typeof reactionSchema>
export type ReportWrite = z.infer<typeof reportWriteSchema>
export type UploadWrite = z.infer<typeof uploadWriteSchema>
export type UploadIntent = z.infer<typeof uploadIntentSchema>
export type MediaRecord = z.infer<typeof mediaRecordSchema>
export type CommunityMedia = z.infer<typeof mediaSchema>
export type VersionedPost = { post: CommunityPost; etag: string | null }
export type VersionedProfile = { profile: CommunityProfile; etag: string }
