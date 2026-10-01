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
}

export type VersionedCommunityPost = Readonly<{
  post: CommunityPostDetail
  version: number | null
}>

export async function getCommunityFeed(
  topic?: CommunityTopicCode,
  cursor?: string,
) {
  const response = await browserApiClient.get<CommunityFeedPage>(
    '/community/feed',
    {
      params: {
        limit: 12,
        ...(topic ? { topic } : {}),
        ...(cursor ? { cursor } : {}),
      },
    },
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
