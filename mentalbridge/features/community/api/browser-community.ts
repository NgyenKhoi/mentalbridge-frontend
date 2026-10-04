import { browserApiClient } from '@/lib/api/browser-client'
import { parseOwnerVersion } from '@/lib/community/community-validation'
import type {
  CommunityAvatarPreset,
  CommunityFeedPage,
  CommunityProfile,
  CommunityPostDetail,
  CommunityPostWrite,
  CommunityTopic,
  CommunityTopicCode,
  PutCommunityProfileRequest,
  CreateMediaUploadIntentRequest,
  MediaUploadIntent,
  CommunityMediaRecord,
  CommunityComment,
  CommunityCommentPage,
  CreateCommentRequest,
  UpdateCommentRequest,
  CreateReportRequest,
  ReportTargetType,
  ReportReason,
  ModerationCase,
  CreateModerationActionRequest,
  CommunityReaction,
  PutReactionRequest,
  SupportiveReaction,
} from '@/lib/community/community-validation'

export type {
  CommunityAvatarPreset,
  CommunityFeedPage,
  CommunityProfile,
  CommunityPostDetail,
  CommunityPostWrite,
  CommunityTopic,
  CommunityTopicCode,
  PutCommunityProfileRequest,
  CreateMediaUploadIntentRequest,
  MediaUploadIntent,
  CommunityMediaRecord,
  CommunityComment,
  CommunityCommentPage,
  CreateCommentRequest,
  UpdateCommentRequest,
  CreateReportRequest,
  ReportTargetType,
  ReportReason,
  ModerationCase,
  CreateModerationActionRequest,
  CommunityReaction,
  PutReactionRequest,
  SupportiveReaction,
}

export type VersionedCommunityPost = Readonly<{
  post: CommunityPostDetail
  version: number | null
}>

export type VersionedCommunityComment = Readonly<{
  comment: CommunityComment
  version: number
}>

export async function getCommunityFeed(
  topics: CommunityTopicCode[] = [],
  cursor?: string,
) {
  const params = new URLSearchParams({ limit: '12' })
  topics.forEach((topic) => params.append('topic', topic))
  if (cursor) params.set('cursor', cursor)
  const response = await browserApiClient.get<CommunityFeedPage>(
    '/community/feed',
    { params },
  )
  return response.data
}

export async function getCommunityPost(postId: string) {
  const response = await browserApiClient.get<CommunityPostDetail>(
    `/community/posts/${encodeURIComponent(postId)}`,
  )
  return {
    post: response.data,
    version: parseOwnerVersion(response.headers.etag),
  }
}

export async function getCommunityTopics() {
  const response =
    await browserApiClient.get<CommunityTopic[]>('/community/topics')
  return response.data
}

export async function createCommunityPost(
  input: CommunityPostWrite,
  idempotencyKey: string,
): Promise<VersionedCommunityPost> {
  const response = await browserApiClient.post<CommunityPostDetail>(
    '/community/posts',
    input,
    { headers: { 'Idempotency-Key': idempotencyKey } },
  )
  return {
    post: response.data,
    version: parseOwnerVersion(response.headers.etag),
  }
}

export async function updateCommunityPost(
  postId: string,
  input: CommunityPostWrite,
  version: number,
): Promise<VersionedCommunityPost> {
  const response = await browserApiClient.patch<CommunityPostDetail>(
    `/community/posts/${encodeURIComponent(postId)}`,
    input,
    { headers: { 'If-Match': `"${version}"` } },
  )
  return {
    post: response.data,
    version: parseOwnerVersion(response.headers.etag),
  }
}

export async function deleteCommunityPost(postId: string, version: number) {
  await browserApiClient.delete(
    `/community/posts/${encodeURIComponent(postId)}`,
    { headers: { 'If-Match': `"${version}"` } },
  )
}

export async function getCommunityProfile() {
  const response =
    await browserApiClient.get<CommunityProfile>('/community/profile')
  return { data: response.data, etag: response.headers.etag ?? null }
}

export async function putCommunityProfile(
  input: PutCommunityProfileRequest,
  etag: string | null,
) {
  const response = await browserApiClient.put<CommunityProfile>(
    '/community/profile',
    input,
    { headers: etag ? { 'If-Match': etag } : undefined },
  )
  return { data: response.data, etag: response.headers.etag ?? null }
}

export async function createCommunityMediaUploadIntent(
  input: CreateMediaUploadIntentRequest,
  idempotencyKey: string,
) {
  const response = await browserApiClient.post<MediaUploadIntent>(
    '/community/media/upload-intents',
    input,
    { headers: { 'Idempotency-Key': idempotencyKey } },
  )
  return response.data
}

export async function finalizeCommunityMedia(mediaId: string) {
  const response = await browserApiClient.post<CommunityMediaRecord>(
    `/community/media/${encodeURIComponent(mediaId)}/finalize`,
  )
  return response.data
}

export async function deleteCommunityMedia(mediaId: string, version: number) {
  await browserApiClient.delete(
    `/community/media/${encodeURIComponent(mediaId)}`,
    { headers: { 'If-Match': `"${version}"` } },
  )
}

export async function getCommunityComments(postId: string, cursor?: string) {
  const response = await browserApiClient.get<CommunityCommentPage>(
    `/community/posts/${encodeURIComponent(postId)}/comments`,
    {
      params: {
        limit: 20,
        ...(cursor ? { cursor } : {}),
      },
    },
  )
  return response.data
}

export async function createCommunityComment(
  postId: string,
  input: CreateCommentRequest,
  idempotencyKey: string,
): Promise<VersionedCommunityComment> {
  const response = await browserApiClient.post<CommunityComment>(
    `/community/posts/${encodeURIComponent(postId)}/comments`,
    input,
    { headers: { 'Idempotency-Key': idempotencyKey } },
  )
  const version = parseOwnerVersion(response.headers.etag)
  if (version === null) throw new Error('COMMUNITY_INVALID_COMMENT_VERSION')
  return { comment: response.data, version }
}

export async function updateCommunityComment(
  commentId: string,
  input: UpdateCommentRequest,
  version: number,
): Promise<VersionedCommunityComment> {
  const response = await browserApiClient.patch<CommunityComment>(
    `/community/comments/${encodeURIComponent(commentId)}`,
    input,
    { headers: { 'If-Match': `"${version}"` } },
  )
  const nextVersion = parseOwnerVersion(response.headers.etag)
  if (nextVersion === null) throw new Error('COMMUNITY_INVALID_COMMENT_VERSION')
  return { comment: response.data, version: nextVersion }
}

export async function deleteCommunityComment(
  commentId: string,
  version: number,
) {
  await browserApiClient.delete(
    `/community/comments/${encodeURIComponent(commentId)}`,
    { headers: { 'If-Match': `"${version}"` } },
  )
}

export async function putCommunityReaction(
  postId: string,
  reaction: SupportiveReaction,
) {
  const response = await browserApiClient.put<CommunityReaction>(
    `/community/posts/${encodeURIComponent(postId)}/reaction`,
    { reaction },
  )
  return response.data
}

export async function deleteCommunityReaction(postId: string) {
  await browserApiClient.delete(
    `/community/posts/${encodeURIComponent(postId)}/reaction`,
  )
}

export async function putCommunityBookmark(postId: string) {
  await browserApiClient.put(
    `/community/posts/${encodeURIComponent(postId)}/bookmark`,
  )
}

export async function deleteCommunityBookmark(postId: string) {
  await browserApiClient.delete(
    `/community/posts/${encodeURIComponent(postId)}/bookmark`,
  )
}

export async function reportCommunityContent(
  input: CreateReportRequest,
  idempotencyKey: string,
) {
  await browserApiClient.post('/community/reports', input, {
    headers: { 'Idempotency-Key': idempotencyKey },
  })
}

export async function hideCommunityContent(
  targetType: ReportTargetType,
  targetId: string,
) {
  await browserApiClient.put(
    `/community/hidden-content/${targetType}/${encodeURIComponent(targetId)}`,
  )
}

export async function blockCommunityProfile(profileId: string) {
  await browserApiClient.put(
    `/community/blocks/${encodeURIComponent(profileId)}`,
  )
}

export async function unblockCommunityProfile(profileId: string) {
  await browserApiClient.delete(
    `/community/blocks/${encodeURIComponent(profileId)}`,
  )
}

export async function getCommunityModerationCases(filters?: {
  state?: string
  targetType?: string
  priority?: string
}) {
  const response = await browserApiClient.get<ModerationCase[]>(
    '/community/admin/moderation-cases',
    { params: filters },
  )
  return response.data
}

export async function createCommunityModerationAction(
  caseId: string,
  input: CreateModerationActionRequest,
  idempotencyKey: string,
) {
  const response = await browserApiClient.post<ModerationCase>(
    `/community/admin/moderation-cases/${encodeURIComponent(caseId)}/actions`,
    input,
    { headers: { 'Idempotency-Key': idempotencyKey } },
  )
  return response.data
}

export async function uploadCommunityMedia(file: File, signal?: AbortSignal) {
  const mediaType = file.type.startsWith('image/') ? 'IMAGE' : 'VIDEO'
  const intent = await createCommunityMediaUploadIntent(
    {
      fileName: file.name,
      mediaType,
      mimeType: file.type,
      sizeBytes: file.size,
    },
    crypto.randomUUID(),
  )
  const form = new FormData()
  Object.entries(intent.uploadFields).forEach(([name, value]) =>
    form.append(name, value),
  )
  form.append('file', file, file.name)
  const upload = await fetch(intent.uploadUrl, {
    method: 'POST',
    body: form,
    redirect: 'error',
    signal,
  })
  if (!upload.ok) throw new Error('COMMUNITY_PROVIDER_UPLOAD_FAILED')
  const result = await finalizeCommunityMedia(intent.mediaId)
  if (result.state !== 'READY') throw new Error('COMMUNITY_MEDIA_REJECTED')
  return result
}
